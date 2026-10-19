/**
 * 内容审计：找出「写了但引擎不读」的效果、死 flag、重复国策、未知引用。
 *
 * 用法：
 *   pnpm audit:content            # 报告，不失败
 *   pnpm audit:content --strict   # 有错误则 exit 1（CI 用）
 */
import { loadContentFromDirectory } from '../src/content/loader/node';
import type { ContentIndex } from '../src/content/types';
import { MODIFIER_KEYS } from '../src/content/modifierRegistry';

/**
 * 引擎真正消费的 modifier key 来自注册表。
 * 注册表之外的 key 会被 schema 拒绝；这里仍做一次运行时检查。
 */
const LIVE_MODIFIER_KEYS = MODIFIER_KEYS;

const RUNTIME_FLAGS = new Set(['food_shortage']);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bump(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function visitEffect(effect: unknown, visit: (effect: JsonRecord) => void): void {
  if (!isRecord(effect)) return;
  visit(effect);
  if (isRecord(effect.if)) {
    const thenBranch = effect.if['then'];
    const elseBranch = effect.if['else'];
    if (Array.isArray(thenBranch)) {
      for (const child of thenBranch) visitEffect(child, visit);
    }
    if (Array.isArray(elseBranch)) {
      for (const child of elseBranch) visitEffect(child, visit);
    }
  }
  if (Array.isArray(effect.randomList)) {
    for (const entry of effect.randomList) {
      if (isRecord(entry) && Array.isArray(entry['effect'])) {
        for (const child of entry['effect']) visitEffect(child, visit);
      }
    }
  }
}

function visitTrigger(trigger: unknown, visit: (trigger: JsonRecord) => void): void {
  if (!isRecord(trigger)) return;
  visit(trigger);
  for (const key of ['all', 'any'] as const) {
    const list = trigger[key];
    if (Array.isArray(list)) {
      for (const child of list) visitTrigger(child, visit);
    }
  }
  if (trigger['not'] !== undefined) visitTrigger(trigger['not'], visit);
}

interface AuditResult {
  modifierUses: Map<string, number>;
  setFlags: Map<string, number>;
  usedFlags: Map<string, number>;
  hasAdvisor: number;
  focusDeadOnly: string[];
  techDeadOnly: string[];
  focusMaterialGroups: Map<string, string[]>;
  unknownRefs: string[];
  eventsWithNoOptions: string[];
}

function modifierKeysOf(effects: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(effects)) return keys;
  for (const effect of effects) {
    visitEffect(effect, node => {
      if (isRecord(node['addModifier'])) {
        for (const key of Object.keys(node['addModifier'])) keys.add(key);
      }
    });
  }
  return keys;
}

function auditContent(content: ContentIndex): AuditResult {
  const result: AuditResult = {
    modifierUses: new Map(),
    setFlags: new Map(),
    usedFlags: new Map(),
    hasAdvisor: 0,
    focusDeadOnly: [],
    techDeadOnly: [],
    focusMaterialGroups: new Map(),
    unknownRefs: [],
    eventsWithNoOptions: [],
  };

  const collectEffects = (effects: unknown, owner: string): void => {
    if (!Array.isArray(effects)) return;
    for (const effect of effects) {
      visitEffect(effect, node => {
        if (isRecord(node['addModifier'])) {
          for (const key of Object.keys(node['addModifier'])) bump(result.modifierUses, key);
        }
        if (typeof node['setFlag'] === 'string') bump(result.setFlags, node['setFlag']);
        if (isRecord(node['addCountryModifier'])) {
          const named = node['addCountryModifier']['modifier'];
          if (typeof named === 'string' && !content.namedModifiers.has(named)) {
            result.unknownRefs.push(`${owner}: unknown named modifier ${named}`);
          }
        }
        if (isRecord(node['addProvinceModifier'])) {
          const named = node['addProvinceModifier']['modifier'];
          const province = node['addProvinceModifier']['province'];
          if (typeof named === 'string' && !content.namedModifiers.has(named)) {
            result.unknownRefs.push(`${owner}: unknown named modifier ${named}`);
          }
          if (typeof province === 'string' && !content.provinces.has(province)) {
            result.unknownRefs.push(`${owner}: unknown province ${province}`);
          }
        }
        if (isRecord(node['triggerEvent'])) {
          const id = node['triggerEvent']['id'];
          if (typeof id === 'string' && !content.events.has(id)) {
            result.unknownRefs.push(`${owner}: unknown event ${id}`);
          }
        }
      });
    }
  };

  const collectTriggers = (trigger: unknown, owner: string): void => {
    visitTrigger(trigger, node => {
      if (typeof node['hasFlag'] === 'string') bump(result.usedFlags, node['hasFlag']);
      if (typeof node['notHasFlag'] === 'string') bump(result.usedFlags, node['notHasFlag']);
      if ('hasAdvisor' in node) result.hasAdvisor += 1;
      if (typeof node['owns'] === 'string' && !content.provinces.has(node['owns'])) {
        result.unknownRefs.push(`${owner}: unknown province ${node['owns']}`);
      }
      if (typeof node['controls'] === 'string' && !content.provinces.has(node['controls'])) {
        result.unknownRefs.push(`${owner}: unknown province ${node['controls']}`);
      }
      if (isRecord(node['relation'])) {
        const target = node['relation']['target'];
        if (typeof target === 'string' && !content.countries.has(target)) {
          result.unknownRefs.push(`${owner}: unknown relation target ${target}`);
        }
      }
    });
  };

  for (const named of content.namedModifiers.values()) {
    for (const key of Object.keys(named.modifiers)) bump(result.modifierUses, key);
  }

  for (const tech of content.techs.values()) {
    collectEffects(tech.effects, `tech:${tech.id}`);
    collectTriggers(tech.requiresAny, `tech:${tech.id}`);
    if (tech.country && !content.countries.has(tech.country)) {
      result.unknownRefs.push(`tech:${tech.id}: unknown country ${tech.country}`);
    }
    const keys = modifierKeysOf(tech.effects);
    if (keys.size > 0 && [...keys].every(key => !LIVE_MODIFIER_KEYS.has(key))) {
      result.techDeadOnly.push(tech.id);
    }
  }

  for (const focus of content.focuses.values()) {
    collectEffects(focus.completionEffect, `focus:${focus.id}`);
    collectTriggers(focus.available, `focus:${focus.id}`);
    if (!content.countries.has(focus.country)) {
      result.unknownRefs.push(`focus:${focus.id}: unknown country ${focus.country}`);
    }
    for (const id of focus.prerequisites) {
      if (!content.focuses.has(id)) result.unknownRefs.push(`focus:${focus.id}: unknown prerequisite ${id}`);
    }
    for (const id of focus.prerequisitesAny) {
      if (!content.focuses.has(id)) result.unknownRefs.push(`focus:${focus.id}: unknown prerequisiteAny ${id}`);
    }
    for (const id of focus.mutuallyExclusive) {
      if (!content.focuses.has(id)) result.unknownRefs.push(`focus:${focus.id}: unknown exclusion ${id}`);
    }
    const keys = modifierKeysOf(focus.completionEffect);
    if (keys.size > 0 && [...keys].every(key => !LIVE_MODIFIER_KEYS.has(key))) {
      result.focusDeadOnly.push(focus.id);
    }
    const material = focus.completionEffect.filter(effect => !isRecord(effect) || !('setFlag' in effect));
    const signature = JSON.stringify(material);
    const group = result.focusMaterialGroups.get(signature) ?? [];
    group.push(focus.id);
    result.focusMaterialGroups.set(signature, group);
  }

  for (const decision of content.decisions.values()) {
    collectEffects(decision.effect, `decision:${decision.id}`);
    collectTriggers(decision.visible, `decision:${decision.id}`);
    collectTriggers(decision.available, `decision:${decision.id}`);
    if (!content.countries.has(decision.country)) {
      result.unknownRefs.push(`decision:${decision.id}: unknown country ${decision.country}`);
    }
  }

  for (const law of content.taxLaws.values()) {
    collectEffects(law.effects, `tax:${law.id}`);
    collectTriggers(law.require, `tax:${law.id}`);
  }

  for (const privilege of content.privileges.values()) {
    collectEffects(privilege.effects, `privilege:${privilege.id}`);
    collectEffects(privilege.revoke.effects, `privilege:${privilege.id}`);
  }

  for (const event of content.events.values()) {
    if (event.options.length === 0) result.eventsWithNoOptions.push(event.id);
    collectTriggers(event.trigger, `event:${event.id}`);
    for (const option of event.options) {
      collectEffects(option.effect, `event:${event.id}`);
      collectTriggers(option.trigger, `event:${event.id}`);
    }
    if (event.country && event.country !== 'any' && !content.countries.has(event.country)) {
      result.unknownRefs.push(`event:${event.id}: unknown country ${event.country}`);
    }
    if (event.chain && !content.eventChains.has(event.chain)) {
      result.unknownRefs.push(`event:${event.id}: unknown chain ${event.chain}`);
    }
  }

  for (const chain of content.eventChains.values()) {
    for (const stage of chain.stages) {
      if (!content.events.has(stage)) result.unknownRefs.push(`chain:${chain.id}: unknown stage ${stage}`);
    }
    collectEffects(chain.onComplete, `chain:${chain.id}`);
  }

  for (const general of content.generals.values()) {
    if (!content.countries.has(general.country)) {
      result.unknownRefs.push(`general:${general.id}: unknown country ${general.country}`);
    }
  }

  for (const scenario of content.scenarios.values()) {
    for (const war of scenario.initialWars) {
      if (!content.countries.has(war.attacker)) result.unknownRefs.push(`scenario:${scenario.id}: unknown attacker ${war.attacker}`);
      if (!content.countries.has(war.defender)) result.unknownRefs.push(`scenario:${scenario.id}: unknown defender ${war.defender}`);
    }
    for (const army of scenario.armies) {
      if (!content.countries.has(army.tag)) result.unknownRefs.push(`scenario:${scenario.id}: unknown army tag ${army.tag}`);
      if (!content.provinces.has(army.province)) result.unknownRefs.push(`scenario:${scenario.id}: unknown army province ${army.province}`);
      if (!content.armyTemplates.has(army.template)) result.unknownRefs.push(`scenario:${scenario.id}: unknown army template ${army.template}`);
    }
  }

  return result;
}

function main(): void {
  const strict = process.argv.includes('--strict');
  const content = loadContentFromDirectory();
  const result = auditContent(content);

  const modifierEntries = [...result.modifierUses.entries()].sort((a, b) => b[1] - a[1]);
  const dead = modifierEntries.filter(([key]) => !LIVE_MODIFIER_KEYS.has(key));
  const live = modifierEntries.filter(([key]) => LIVE_MODIFIER_KEYS.has(key));
  const totalUses = modifierEntries.reduce((sum, [, count]) => sum + count, 0);
  const deadUses = dead.reduce((sum, [, count]) => sum + count, 0);

  const markerFlags = new Set([...content.focuses.keys(), ...content.decisions.keys()]);
  const deadSetFlags = [...result.setFlags.keys()]
    .filter(flag => !result.usedFlags.has(flag) && !markerFlags.has(flag) && !RUNTIME_FLAGS.has(flag))
    .sort();
  const deadUsedFlags = [...result.usedFlags.keys()]
    .filter(flag => !result.setFlags.has(flag) && !RUNTIME_FLAGS.has(flag))
    .sort();

  const duplicateGroups = [...result.focusMaterialGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('=== 内容审计 ===');
  console.log(`provinces=${content.provinces.size} events=${content.events.size} focuses=${content.focuses.size} techs=${content.techs.size} laws=${content.taxLaws.size} decisions=${content.decisions.size} generals=${content.generals.size}`);
  console.log(`modifier uses: total=${totalUses} live=${totalUses - deadUses} dead=${deadUses} (${totalUses > 0 ? ((deadUses / totalUses) * 100).toFixed(1) : '0'}%)`);

  console.log('\n--- 引擎不消费的 modifier ---');
  for (const [key, count] of dead) console.log(`DEAD ${key.padEnd(26)} ${count}`);

  console.log('\n--- 引擎消费的 modifier ---');
  for (const [key, count] of live) console.log(`LIVE ${key.padEnd(26)} ${count}`);

  console.log(`\n--- 只有无效修正的国策：${result.focusDeadOnly.length} ---`);
  console.log(result.focusDeadOnly.slice(0, 40).join(', ') || '(none)');

  console.log(`\n--- 只有无效修正的科技：${result.techDeadOnly.length} ---`);
  console.log(result.techDeadOnly.join(', ') || '(none)');

  console.log(`\n--- hasAdvisor 触发器：${result.hasAdvisor} ---`);

  console.log(`\n--- 死 flag（set 但从不 check）：${deadSetFlags.length} ---`);
  console.log(deadSetFlags.slice(0, 60).join(', ') || '(none)');
  console.log(`--- 死 flag（check 但从不 set）：${deadUsedFlags.length} ---`);
  console.log(deadUsedFlags.slice(0, 60).join(', ') || '(none)');

  console.log(`\n--- 重复国策效果组（去掉 setFlag 后）：${duplicateGroups.length} 组 ---`);
  for (const [signature, ids] of duplicateGroups.slice(0, 12)) {
    console.log(`x${ids.length} ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ' …' : ''}`);
    console.log(`   ${signature.slice(0, 180)}`);
  }

  console.log(`\n--- 未知引用：${result.unknownRefs.length} ---`);
  for (const ref of result.unknownRefs.slice(0, 80)) console.log(ref);
  if (result.unknownRefs.length > 80) console.log(`…还有 ${result.unknownRefs.length - 80} 条`);

  const errors = deadUses + result.focusDeadOnly.length + result.techDeadOnly.length
    + result.hasAdvisor + deadUsedFlags.length + result.unknownRefs.length;
  const warnings = deadSetFlags.length + duplicateGroups.length + result.eventsWithNoOptions.length;

  console.log(`\n=== 汇总：errors=${errors} warnings=${warnings}（deadUses=${deadUses}, deadFocus=${result.focusDeadOnly.length}, deadTech=${result.techDeadOnly.length}, hasAdvisor=${result.hasAdvisor}, deadUsedFlags=${deadUsedFlags.length}, unknownRefs=${result.unknownRefs.length}; warnings: deadSetFlags=${deadSetFlags.length}, duplicateFocusGroups=${duplicateGroups.length}, emptyEvents=${result.eventsWithNoOptions.length}）===`);
  if (warnings > 0) {
    console.log('警告项属于内容质量问题（死 flag/重复国策），Q4 内容生产阶段清零；当前不阻断 Q1。');
  }

  if (strict && errors > 0) {
    console.error('audit:content 失败：存在无效修正/死引用。');
    process.exitCode = 1;
  }
}

main();
