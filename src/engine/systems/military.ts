import type { ContentIndex } from '../../content/types';
import { aggregateCountryModifiers } from '../rules/modifiers';
import { areAtWar } from '../rules/war';
import type { ArmyState, GameState } from '../state/types';
import { armyStrength } from '../state/types';
import { touchMap } from '../state/types';
import { generalTraitBonus } from '../rules/generalTraits';
import { canMarchThrough } from '../rules/access';
import { crisisCombatPenalty } from './crisis';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function compositionTotal(army: ArmyState): number {
  return armyStrength(army);
}

export function pickGeneral(state: GameState, content: ContentIndex, tag: string): string | null {
  const used = new Set(Object.values(state.armies).map(army => army.general).filter((id): id is string => id !== null));
  for (const general of content.generals.values()) {
    if (general.country === tag && !used.has(general.id)) return general.id;
  }
  return null;
}

function loseStrength(army: ArmyState, losses: number): void {
  const total = compositionTotal(army);
  if (total <= 0) return;
  const ratio = Math.min(1, losses / total);
  army.composition.infantry = Math.max(0, Math.round(army.composition.infantry * (1 - ratio)));
  army.composition.firearm = Math.max(0, Math.round(army.composition.firearm * (1 - ratio)));
  army.composition.cavalry = Math.max(0, Math.round(army.composition.cavalry * (1 - ratio)));
  army.composition.artillery = Math.max(0, Math.round(army.composition.artillery * (1 - ratio)));
  army.composition.naval = Math.max(0, Math.round(army.composition.naval * (1 - ratio)));
}

function recordAttrition(state: GameState, tag: string, losses: number): void {
  if (losses <= 0) return;
  for (const war of state.wars) {
    if (war.attacker !== tag && war.defender !== tag) continue;
    war.attrition[tag] = (war.attrition[tag] ?? 0) + losses;
  }
}

function attackValue(army: ArmyState, content: ContentIndex, modifiers: Record<string, number>, corruption: number): number {
  const c = army.composition;
  const cavalryMultiplier = 1 + (modifiers['cavalry_attack_pct'] ?? 0) / 100;
  const artilleryMultiplier = 1 + (modifiers['artillery_attack_pct'] ?? 0) / 100;
  const navalMultiplier = 1 + (modifiers['naval_attack_pct'] ?? 0) / 100;
  const base = c.infantry * content.balance.military.baseAttack
    + c.firearm * content.balance.military.firearmAttack
    + c.cavalry * content.balance.military.cavalryAttack * cavalryMultiplier
    + c.artillery * content.balance.military.artillerySiege * artilleryMultiplier
    + c.naval * content.balance.military.baseAttack * 0.5 * navalMultiplier;
  const quality = (army.training / 100) * (army.equipment / 100);
  const general = army.general ? content.generals.get(army.general) : undefined;
  const command = 1 + (general?.attack ?? 0) * 0.015;
  const traits = generalTraitBonus(general?.traits ?? []);
  return base * quality * command
    * (1 + ((modifiers['army_attack_pct'] ?? 0) + traits.attackPct) / 100)
    * (1 + clamp(modifiers['discipline_pct'] ?? 0, -50, 100) / 100 * 0.6)
    * (1 - clamp(corruption, 0, 100) / 100 * 0.15)
    * (army.encircled ? 0.65 : 1);
}

function defenseValue(
  army: ArmyState,
  content: ContentIndex,
  modifiers: Record<string, number>,
  terrain: keyof typeof content.balance.military.terrainDefense,
  corruption: number,
  isFort: boolean,
): number {
  const c = army.composition;
  const cavalryMultiplier = 1 + (modifiers['cavalry_attack_pct'] ?? 0) / 200;
  const artilleryMultiplier = 1 + (modifiers['artillery_attack_pct'] ?? 0) / 200;
  const navalMultiplier = 1 + (modifiers['naval_attack_pct'] ?? 0) / 100;
  const base = c.infantry * content.balance.military.baseDefense
    + c.firearm * content.balance.military.baseDefense * 1.2
    + c.cavalry * content.balance.military.baseDefense * 0.8 * cavalryMultiplier
    + c.artillery * content.balance.military.baseDefense * 0.6 * artilleryMultiplier
    + c.naval * content.balance.military.baseDefense * 0.5 * navalMultiplier;
  const quality = (army.training / 100) * (army.equipment / 100);
  const terrainBonus = 1 + (content.balance.military.terrainDefense[terrain] ?? 0);
  const fortBonus = isFort ? 1 + (modifiers['fort_defense_pct'] ?? 0) / 100 : 1;
  const general = army.general ? content.generals.get(army.general) : undefined;
  const command = 1 + (general?.defense ?? 0) * 0.015;
  const traits = generalTraitBonus(general?.traits ?? []);
  return base * quality * terrainBonus * fortBonus * command
    * (1 + ((modifiers['army_defense_pct'] ?? 0) + traits.defensePct) / 100)
    * (1 + clamp(modifiers['discipline_pct'] ?? 0, -50, 100) / 100 * 0.6)
    * (1 - clamp(corruption, 0, 100) / 100 * 0.15)
    * (army.encircled ? 0.65 : 1)
    * (1 + Math.min(0.2, (army.entrenchment ?? 0) * 0.025));
}

function movementFactor(
  state: GameState,
  army: ArmyState,
  nation: GameState['countries'][string],
  content: ContentIndex,
  terrain: string,
): number {
  const total = Math.max(1, compositionTotal(army));
  const cavalryShare = army.composition.cavalry / total;
  const artilleryShare = army.composition.artillery / total;
  let factor = 1 + Math.min(0.15, nation.completedTechs.length * 0.004);
  const modifiers = aggregateCountryModifiers(state, content, nation.tag);
  factor *= 1 + (modifiers['movement_speed_pct'] ?? 0) / 100;
  const template = content.armyTemplates.get(army.templateId);
  factor *= 1 + ((template?.movement ?? 3) - 3) * 0.03;
  if ((terrain === 'steppe' || terrain === 'plains' || terrain === 'desert') && cavalryShare > 0.3) {
    factor *= 1.16;
  }
  if ((terrain === 'mountains' || terrain === 'hills' || terrain === 'wetland' || terrain === 'jungle')
    && artilleryShare > 0.08) {
    factor *= 0.8;
  }
  if (terrain === 'mountains' && cavalryShare > 0.35) factor *= 0.88;
  if ((terrain === 'jungle' || terrain === 'wetland') && cavalryShare > 0.35) factor *= 0.9;
  return clamp(factor, 0.55, 1.45);
}

function friendlyRetreat(state: GameState, content: ContentIndex, army: ArmyState): string | null {
  const def = content.provinces.get(army.province);
  if (!def) return null;
  const candidates = def.neighbors
    .map(id => ({ id, province: state.provinces[id], def: content.provinces.get(id) }))
    .filter((entry): entry is { id: string; province: NonNullable<typeof entry.province>; def: NonNullable<typeof entry.def> } =>
      entry.province !== undefined && entry.def !== undefined);
  const friendly = candidates
    .filter(entry => entry.province.controller === army.tag)
    .sort((a, b) => (b.province.controller === army.tag ? 1 : 0) - (a.province.controller === army.tag ? 1 : 0));
  if (friendly[0]) return friendly[0].id;
  const safe = candidates.filter(entry => entry.province.controller === 'NEU');
  return safe[0]?.id ?? null;
}

function retreatOrDestroy(state: GameState, content: ContentIndex, army: ArmyState, provinceName: string): void {
  if (army.encircled) {
    const destroyed = compositionTotal(army);
    for (const war of state.wars) {
      if (war.attacker === army.tag || war.defender === army.tag) {
        war.casualties[army.tag] = (war.casualties[army.tag] ?? 0) + destroyed;
      }
    }
    delete state.armies[army.id];
    state.log.push({
      day: state.day,
      category: 'military',
      text: `${content.countries.get(army.tag)?.name ?? army.tag} 在 ${provinceName} 被围歼`,
      severity: 'danger',
    });
    return;
  }
  const retreat = friendlyRetreat(state, content, army);
  if (retreat) {
    army.province = retreat;
    army.organization = 10;
    army.movePath = [];
    army.stance = 'hold';
    army.entrenchment = 0;
    loseStrength(army, Math.max(0, compositionTotal(army) * 0.1));
  } else {
    const destroyed = compositionTotal(army);
    for (const war of state.wars) {
      if (war.attacker === army.tag || war.defender === army.tag) {
        war.casualties[army.tag] = (war.casualties[army.tag] ?? 0) + destroyed;
      }
    }
    delete state.armies[army.id];
  }
  state.log.push({
    day: state.day,
    category: 'military',
    text: `${content.countries.get(army.tag)?.name ?? army.tag} 在 ${provinceName} ${retreat ? '溃退' : '被合围歼灭'}`,
    severity: 'danger',
  });
}

function resolveProvinceBattles(state: GameState, content: ContentIndex): void {
  const groups = new Map<string, ArmyState[]>();
  for (const army of Object.values(state.armies)) {
    if (army.embarked) continue;
    const list = groups.get(army.province) ?? [];
    list.push(army);
    groups.set(army.province, list);
  }
  for (const [provinceId, armies] of groups) {
    const province = state.provinces[provinceId];
    const def = content.provinces.get(provinceId);
    if (!province || !def) continue;
    const defenders = armies.filter(army => army.tag === province.controller);
    const attackers = armies.filter(army => army.tag !== province.controller && areAtWar(state, army.tag, province.controller));
    if (defenders.length === 0 || attackers.length === 0) continue;
    const controller = state.countries[province.controller];
    if (!controller) continue;
    const frontage = content.balance.military.terrainWidth[def.terrain] ?? 20;
    const widthOf = (army: ArmyState) => Math.max(1, Math.ceil(compositionTotal(army) / 1000));
    const selectFront = (list: ArmyState[]): ArmyState[] => {
      const sorted = [...list].sort((a, b) => compositionTotal(b) - compositionTotal(a));
      const selected: ArmyState[] = [];
      let used = 0;
      for (const army of sorted) {
        const width = widthOf(army);
        if (used + width > frontage && selected.length > 0) continue;
        selected.push(army);
        used += width;
        if (used >= frontage) break;
      }
      return selected;
    };
    const frontDefenders = selectFront(defenders);
    const frontAttackers = selectFront(attackers);
    for (const army of [...defenders, ...attackers]) {
      if (!frontDefenders.includes(army) && !frontAttackers.includes(army)) {
        if (army.stance === 'battle') army.stance = 'hold';
      }
    }
    const modsFor = (tag: string): Record<string, number> => {
      const nation = state.countries[tag];
      const mods = nation ? aggregateCountryModifiers(state, content, tag) : {};
      if (nation) {
        mods['army_attack_pct'] = (mods['army_attack_pct'] ?? 0) + crisisCombatPenalty(nation)
          + (nation.armyLoyalty - 50) / 10;
        mods['army_defense_pct'] = (mods['army_defense_pct'] ?? 0) + crisisCombatPenalty(nation)
          + (nation.armyLoyalty - 50) / 10;
      }
      return mods;
    };
    const attackPower = frontAttackers.reduce((sum, army) =>
      sum + attackValue(army, content, modsFor(army.tag), state.countries[army.tag]?.corruption ?? 0), 0);
    const defensePower = frontDefenders.reduce((sum, army) =>
      sum + defenseValue(army, content, modsFor(army.tag), def.terrain, state.countries[army.tag]?.corruption ?? 0, def.isFort), 0);
    const defenderHit = (attackPower / (defensePower + 100)) * 7 * Math.max(0.6, frontAttackers.length / Math.max(1, frontDefenders.length));
    const attackerHit = (defensePower / (attackPower + 100)) * 4.2 * Math.max(0.6, frontDefenders.length / Math.max(1, frontAttackers.length));
    const beforeStrength = new Map<string, number>();
    for (const army of [...frontAttackers, ...frontDefenders]) {
      beforeStrength.set(army.id, compositionTotal(army));
    }
    for (const army of frontDefenders) {
      const share = compositionTotal(army) / Math.max(1, frontDefenders.reduce((sum, entry) => sum + compositionTotal(entry), 0));
      army.organization = clamp(army.organization - defenderHit * share, 0, 100);
      loseStrength(army, attackPower * 0.0005 * share * (army.encircled ? 1.6 : 1));
      army.stance = 'battle';
    }
    for (const army of frontAttackers) {
      const share = compositionTotal(army) / Math.max(1, frontAttackers.reduce((sum, entry) => sum + compositionTotal(entry), 0));
      army.organization = clamp(army.organization - attackerHit * share, 0, 100);
      loseStrength(army, defensePower * 0.00028 * share * (army.encircled ? 1.6 : 1));
      army.stance = 'battle';
    }
    for (const army of [...frontAttackers, ...frontDefenders]) {
      const before = beforeStrength.get(army.id) ?? 0;
      const after = compositionTotal(army);
      const war = state.wars.find(entry =>
        (entry.attacker === army.tag || entry.defender === army.tag)
        && (entry.attacker === province.controller || entry.defender === province.controller));
      if (war && before > after) war.casualties[army.tag] = (war.casualties[army.tag] ?? 0) + Math.round(before - after);
    }
    if (frontDefenders.some(army => army.organization <= 0) || frontAttackers.some(army => army.organization <= 0)) {
      for (const army of [...frontDefenders, ...frontAttackers]) {
        if (army.organization > 0 || !state.armies[army.id]) continue;
        retreatOrDestroy(state, content, army, def.name);
      }
    }
    state.stats.battles += 1;
    const battle = state.battles.find(entry => entry.provinceId === provinceId)
      ?? {
        id: `battle_${provinceId}`,
        provinceId,
        attacker: frontAttackers[0]?.tag ?? '',
        defender: province.controller,
        startDay: state.day,
        days: 0,
        attackerStrength: 0,
        defenderStrength: 0,
        attackerOrganization: 0,
        defenderOrganization: 0,
      };
    battle.attacker = frontAttackers[0]?.tag ?? battle.attacker;
    battle.defender = province.controller;
    battle.days = state.day - battle.startDay + 1;
    battle.attackerStrength = frontAttackers.reduce((sum, army) => sum + compositionTotal(army), 0);
    battle.defenderStrength = frontDefenders.reduce((sum, army) => sum + compositionTotal(army), 0);
    battle.attackerOrganization = frontAttackers.reduce((sum, army) => sum + army.organization, 0) / Math.max(1, frontAttackers.length);
    battle.defenderOrganization = frontDefenders.reduce((sum, army) => sum + army.organization, 0) / Math.max(1, frontDefenders.length);
    if (!state.battles.includes(battle)) state.battles.push(battle);
    state.log.push({
      day: state.day,
      category: 'military',
      text: `战线 ${def.name}：${content.countries.get(frontAttackers[0]?.tag ?? '')?.name ?? '进攻方'} 以 ${frontAttackers.length} 支前锋进攻，守军 ${frontDefenders.length} 支`,
      severity: 'warning',
    });
  }
  state.battles = state.battles.filter(battle => {
    const province = state.provinces[battle.provinceId];
    if (!province) return false;
    return Object.values(state.armies).some(army =>
      army.tag === battle.attacker
      && army.province === battle.provinceId
      && Object.values(state.armies).some(other =>
        other.tag === province.controller
        && other.province === battle.provinceId
        && areAtWar(state, army.tag, other.tag)));
  });
  for (const army of Object.values(state.armies)) {
    if (army.stance !== 'battle') continue;
    const hasEnemy = Object.values(state.armies).some(other =>
      other.id !== army.id
      && other.province === army.province
      && other.tag !== army.tag
      && areAtWar(state, army.tag, other.tag));
    if (!hasEnemy) army.stance = 'hold';
  }
}

function captureProvince(state: GameState, content: ContentIndex, army: ArmyState, provinceId: string): void {
  const province = state.provinces[provinceId];
  const def = content.provinces.get(provinceId);
  if (!province || !def) return;
  const oldOwner = province.owner;
  province.controller = army.tag;
  touchMap(state);
  province.coreWork = null;
  province.occupation = null;
  delete province.siege;
  province.unrest = clamp(province.unrest + 8, 0, 100);
  province.devastation = clamp(province.devastation + 4, 0, 100);
  state.stats.provincesCaptured += 1;
  state.log.push({
    day: state.day,
    category: 'military',
    text: `${content.countries.get(army.tag)?.name ?? army.tag} 占领 ${def.name}`,
    severity: 'warning',
  });
  if (oldOwner !== army.tag) {
    const old = state.countries[oldOwner];
    if (old && old.capital === provinceId) {
      old.mandate = clamp(old.mandate - content.balance.politics.mandateLossOnCapital, 0, 100);
      state.log.push({
        day: state.day,
        category: 'politics',
        country: oldOwner,
        text: `京师 ${def.name} 失陷，天命 -${content.balance.politics.mandateLossOnCapital}`,
        severity: 'danger',
      });
    }
  }
}

function isSupplied(state: GameState, content: ContentIndex, army: ArmyState): boolean {
  const current = state.provinces[army.province];
  const def = content.provinces.get(army.province);
  if (!current || !def) return false;
  const friendly = (id: string): boolean => {
    const province = state.provinces[id];
    return province !== undefined && province.controller === army.tag;
  };
  if (!friendly(army.province)) {
    if (!def.isCoastal) return false;
    const seaSupplied = def.neighbors.some(neighbor => {
      const neighborDef = content.provinces.get(neighbor);
      return neighborDef?.isPort === true && friendly(neighbor);
    });
    if (!seaSupplied) return false;
    return true;
  } else if (def.isPort) {
    return true;
  }
  const capital = state.countries[army.tag]?.capital;
  const sources = new Set<string>();
  if (capital && friendly(capital)) sources.add(capital);
  for (const province of Object.values(state.provinces)) {
    if (friendly(province.id) && province.cores.includes(army.tag)) sources.add(province.id);
  }
  if (sources.has(army.province)) return true;
  const queue = [army.province];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    const provinceDef = content.provinces.get(id);
    if (!provinceDef) continue;
    for (const neighbor of provinceDef.neighbors) {
      if (seen.has(neighbor)) continue;
      if (!friendly(neighbor)) continue;
      if (sources.has(neighbor)) return true;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

function updateEncirclement(state: GameState, content: ContentIndex, army: ArmyState): void {
  if (army.embarked) {
    army.encircled = false;
    army.encircledDays = 0;
    return;
  }
  const supplied = isSupplied(state, content, army);
  if (supplied) {
    if (army.encircled) {
      state.log.push({
        day: state.day,
        category: 'military',
        country: army.tag,
        text: `${army.name} 与本土恢复联系，解除包围`,
        severity: 'info',
      });
    }
    army.encircled = false;
    army.encircledDays = 0;
    return;
  }
  if (!army.encircled) {
    army.encircled = true;
    army.encircledDays = 0;
    army.movePath = [];
    if (army.stance === 'move') army.stance = 'hold';
    state.log.push({
      day: state.day,
      category: 'military',
      country: army.tag,
      text: `${army.name} 与本土联系被切断，陷入包围`,
      severity: 'danger',
    });
  }
  army.encircledDays += 1;
  army.movePath = [];
  if (army.encircledDays > 7) {
    const before = compositionTotal(army);
    const rate = Math.min(0.035, 0.012 + (army.encircledDays - 7) * 0.0006);
    loseStrength(army, Math.max(1, Math.round(before * rate)));
    recordAttrition(state, army.tag, Math.max(0, before - compositionTotal(army)));
    army.organization = clamp(army.organization - 2.2, 0, 100);
    army.supply = clamp(army.supply - 3, 0, 100);
    army.entrenchment = 0;
    if (army.encircledDays === 8 || army.encircledDays === 30) {
      state.log.push({
        day: state.day,
        category: 'military',
        country: army.tag,
        text: `${army.name} 被围 ${army.encircledDays} 日，粮尽兵疲，开始减员`,
        severity: 'danger',
      });
    }
  }
}
export function advanceArmies(state: GameState, content: ContentIndex): void {
  resolveProvinceBattles(state, content);
  for (const army of Object.values(state.armies)) {
    if (!state.armies[army.id]) continue;
    updateEncirclement(state, content, army);
    if (army.stance === 'battle') continue;
    const nation = state.countries[army.tag];
    if (!nation?.alive) continue;
    const armyModifiers = aggregateCountryModifiers(state, content, army.tag);
    const currentDef = content.provinces.get(army.province);
    if (!currentDef) continue;
    const armyGeneral = army.general ? content.generals.get(army.general) : undefined;
    const armyTraits = generalTraitBonus(armyGeneral?.traits ?? []);

    if (army.embarked) {
      army.stance = 'move';
      army.navalProgress = (army.navalProgress ?? 0) + 1 / 3;
      if (army.navalProgress >= 1) {
        const target = army.navalTarget;
        const targetProvince = target ? state.provinces[target] : undefined;
        if (target && targetProvince && targetProvince.controller === army.tag) {
          army.history = [...army.history, army.province].slice(-8);
          army.province = target;
        } else if (army.navalOrigin && state.provinces[army.navalOrigin]?.controller === army.tag) {
          army.province = army.navalOrigin;
          state.log.push({
            day: state.day,
            category: 'military',
            country: army.tag,
            text: `${army.name} 登陆受阻，撤回 ${content.provinces.get(army.navalOrigin)?.name ?? army.navalOrigin}`,
            severity: 'warning',
          });
        }
        army.embarked = false;
        army.navalTarget = null;
        army.navalOrigin = null;
        army.navalProgress = 0;
        army.stance = 'hold';
      }
      continue;
    }

    const supplied = isSupplied(state, content, army);
    if (supplied) {
      army.supply = clamp(army.supply + content.balance.military.supplyRecovery + (armyModifiers['supply_limit_add'] ?? 0) * 0.5, 0, 100);
    } else {
      army.supply = clamp(army.supply - content.balance.military.supplyDecay, 0, 100);
      const before = compositionTotal(army);
      const attrition = Math.max(1, Math.round(before * 0.001));
      loseStrength(army, attrition);
      recordAttrition(state, army.tag, Math.max(0, before - compositionTotal(army)));
    }
    if (army.supply < 20) army.organization = clamp(army.organization - 0.5, 0, 100);
    const supplyCapacity = content.provinces.get(army.province)?.supplyLimit ?? 0;
    if (supplyCapacity > 0 && compositionTotal(army) > supplyCapacity * 2) {
      army.supply = clamp(army.supply - content.balance.military.supplyDecay * 0.5, 0, 100);
    }
    if (army.supply > 40) {
      army.organization = clamp(
        army.organization
        + 0.25 * (1 + armyTraits.organizationPct / 100)
        + (armyModifiers['morale_add'] ?? 0) * 0.02,
        0,
        100,
      );
      if (army.movePath.length === 0 && army.stance === 'hold') {
        army.entrenchment = Math.min(5, (army.entrenchment ?? 0) + 0.2);
      }
    }
    if (army.forcedMarch && army.movePath.length > 0) {
      army.organization = clamp(army.organization - 0.35, 0, 100);
      army.supply = clamp(army.supply - 0.25, 0, 100);
    }

    const provinceHere = state.provinces[army.province];
    const hostileHere = provinceHere
      ? provinceHere.controller !== army.tag
        && provinceHere.controller !== 'NEU'
        && areAtWar(state, army.tag, provinceHere.controller)
      : false;
    if (army.movePath.length > 0 && (army.forcedMarch || !hostileHere)) {
      const next = army.movePath[0];
      if (!next || !currentDef.neighbors.includes(next)) {
        army.movePath = [];
        army.stance = 'hold';
        continue;
      }
      const nextDef = content.provinces.get(next);
      const general = army.general ? content.generals.get(army.general) : undefined;
      const traits = generalTraitBonus(general?.traits ?? []);
      const cost = (content.balance.military.movementCost[nextDef?.terrain ?? 'plains'] ?? 1)
        * Math.max(0.55, 1 - traits.movePct / 100);
      const terrainFactor = movementFactor(state, army, nation, content, nextDef?.terrain ?? 'plains');
      army.stance = 'move';
      army.entrenchment = 0;
      army.moveProgress += (terrainFactor / (4 * cost)) * (army.forcedMarch ? 1.35 : 1);
      if (army.moveProgress >= 1) {
        army.history = [...army.history, army.province].slice(-8);
        army.province = next;
        army.movePath.shift();
        army.moveProgress = 0;
      }
    }
    if (army.forcedMarch && army.movePath.length > 0) continue;

    const province = state.provinces[army.province];
    if (!province || province.controller === army.tag) {
      if (province) {
        delete province.siege;
        province.occupation = null;
      }
      continue;
    }
    const enemiesHere = Object.values(state.armies).some(other =>
      other.id !== army.id
      && other.province === army.province
      && other.tag !== army.tag
      && areAtWar(state, army.tag, other.tag));
    if (enemiesHere) continue;
    if (province.controller !== 'NEU' && !areAtWar(state, army.tag, province.controller)) continue;
    if (currentDef.isFort) {
      const siege = province.siege?.attacker === army.tag
        ? province.siege
        : { attacker: army.tag, progress: 0, days: 0 };
      province.siege = siege;
      province.occupation = null;
      const artillery = army.composition.artillery;
      const general = army.general ? content.generals.get(army.general) : undefined;
      const traits = generalTraitBonus(general?.traits ?? []);
      const siegeSpeed = (8 + artillery / 120)
        * (1 + traits.siegePct / 100)
        * (1 + (armyModifiers['siege_speed_pct'] ?? 0) / 100);
      siege.progress += siegeSpeed;
      siege.days += 1;
      if (siege.progress >= currentDef.fortLevel * 100) {
        captureProvince(state, content, army, army.province);
        state.stats.sieges += 1;
      }
    } else {
      const occupation = province.occupation?.country === army.tag
        ? province.occupation
        : { country: army.tag, progress: 0, days: 0 };
      province.occupation = occupation;
      const artillery = army.composition.artillery;
      const speed = 8 + artillery / 100 + Math.max(0, province.unrest) / 12;
      occupation.progress += speed;
      occupation.days += 1;
      if (occupation.progress >= 100) {
        captureProvince(state, content, army, army.province);
      }
    }
  }
}

export function splitArmy(state: GameState, _content: ContentIndex, armyId: string, amount: number): string | null {
  const army = state.armies[armyId];
  if (!army || amount <= 0) return null;
  const total = compositionTotal(army);
  if (total <= 1) return null;
  const take = Math.min(Math.floor(amount), total - 1);
  if (take <= 0) return null;
  const ratio = take / total;
  const id = `army_${state.nextArmyId}`;
  state.nextArmyId += 1;
  const split: ArmyState = {
    ...army,
    id,
    name: `${army.name} 分营`,
    history: [],
    movePath: [],
    moveProgress: 0,
    embarked: false,
    navalTarget: null,
    navalOrigin: null,
    navalProgress: 0,
    composition: {
      infantry: Math.floor(army.composition.infantry * ratio),
      firearm: Math.floor(army.composition.firearm * ratio),
      cavalry: Math.floor(army.composition.cavalry * ratio),
      artillery: Math.floor(army.composition.artillery * ratio),
      naval: Math.floor(army.composition.naval * ratio),
    },
    maxStrength: take,
    general: null,
    entrenchment: 0,
    forcedMarch: false,
    stance: 'hold',
  };
  const splitTotal = compositionTotal(split);
  if (splitTotal < take) split.composition.infantry += take - splitTotal;
  army.composition.infantry -= split.composition.infantry;
  army.composition.firearm -= split.composition.firearm;
  army.composition.cavalry -= split.composition.cavalry;
  army.composition.artillery -= split.composition.artillery;
  army.composition.naval -= split.composition.naval;
  army.maxStrength = Math.max(1, (army.maxStrength ?? total) - take);
  state.armies[id] = split;
  return id;
}
export function recruitArmy(
  state: GameState,
  content: ContentIndex,
  tag: string,
  provinceId: string,
  templateId: string,
  size: number,
): boolean {
  const nation = state.countries[tag];
  const template = content.armyTemplates.get(templateId);
  const province = state.provinces[provinceId];
  if (!nation || !template || !province) return false;
  if (province.controller !== tag) return false;
  const silverCost = size * 5000;
  const manpowerCost = size * 1000;
  if (nation.treasury < silverCost || nation.manpower < manpowerCost) return false;
  nation.treasury -= silverCost;
  nation.manpower -= manpowerCost;
  const id = `army_${state.nextArmyId}`;
  state.nextArmyId += 1;
  state.armies[id] = {
    id,
    tag,
    name: `${content.countries.get(tag)?.name ?? tag} ${template.name}`,
    province: provinceId,
    history: [],
    movePath: [],
    moveProgress: 0,
    templateId,
    embarked: false,
    navalTarget: null,
    navalOrigin: null,
    navalProgress: 0,
    composition: {
      infantry: template.composition.infantry * size,
      firearm: template.composition.firearm * size,
      cavalry: template.composition.cavalry * size,
      artillery: template.composition.artillery * size,
      naval: template.composition.naval * size,
    },
    organization: content.balance.military.baseOrganization,
    maxStrength: (template.composition.infantry + template.composition.firearm
      + template.composition.cavalry + template.composition.artillery + template.composition.naval) * size,
    training: template.training,
    equipment: template.equipment,
    supply: 100,
    encircled: false,
    encircledDays: 0,
    sourceEstate: template.sourceEstate,
    general: pickGeneral(state, content, tag),
    entrenchment: 0,
    forcedMarch: false,
    stance: 'hold',
  };
  const estate = nation.estates[template.sourceEstate];
  if (estate) estate.loyalty = clamp(estate.loyalty - 1, 0, 100);
  state.log.push({
    day: state.day,
    category: 'military',
    country: tag,
    text: `征募 ${template.name} ${size} 营，耗银 ${silverCost}`,
    severity: 'info',
  });
  return true;
}

export function replenishArmies(state: GameState, content: ContentIndex): void {
  for (const army of Object.values(state.armies)) {
    const nation = state.countries[army.tag];
    if (!nation?.alive || nation.manpower <= 0) continue;
    if (army.stance === 'battle' || army.embarked || army.movePath.length > 0 || army.encircled) continue;
    if (army.supply < 20 || army.organization < 20) continue;
    const total = compositionTotal(army);
    const missing = Math.max(0, (army.maxStrength ?? total) - total);
    if (missing <= 0) continue;
    const template = content.armyTemplates.get(army.templateId);
    if (!template) continue;
    const templateTotal = template.composition.infantry + template.composition.firearm
      + template.composition.cavalry + template.composition.artillery + template.composition.naval;
    if (templateTotal <= 0) continue;
    const amount = Math.min(missing, Math.max(1, Math.ceil(army.maxStrength * 0.008)), Math.floor(nation.manpower));
    if (amount <= 0) continue;
    const ratios = {
      infantry: template.composition.infantry / templateTotal,
      firearm: template.composition.firearm / templateTotal,
      cavalry: template.composition.cavalry / templateTotal,
      artillery: template.composition.artillery / templateTotal,
      naval: template.composition.naval / templateTotal,
    };
    army.composition.infantry += Math.floor(amount * ratios.infantry);
    army.composition.firearm += Math.floor(amount * ratios.firearm);
    army.composition.cavalry += Math.floor(amount * ratios.cavalry);
    army.composition.artillery += Math.floor(amount * ratios.artillery);
    army.composition.naval += Math.floor(amount * ratios.naval);
    const added = compositionTotal(army) - total;
    if (added < amount) army.composition.infantry += amount - added;
    nation.manpower = Math.max(0, nation.manpower - amount);
  }
}


export function cleanupEmptyArmies(state: GameState): void {
  for (const army of Object.values(state.armies)) {
    if (compositionTotal(army) > 0) continue;
    delete state.armies[army.id];
    state.log.push({
      day: state.day,
      category: 'military',
      country: army.tag,
      text: `${army.name} 已全军覆没`,
      severity: 'danger',
    });
  }
}

export function setArmyPath(
  state: GameState,
  content: ContentIndex,
  armyId: string,
  path: string[],
): boolean {  const army = state.armies[armyId];
  if (!army) return false;
  if (army.encircled) return false;
  if (path.length === 0) {
    army.movePath = [];
    army.stance = 'hold';
    return true;
  }
  const newPathKey = path.join('|');
  const oldPathKey = army.movePath.join('|');
  const from = content.provinces.get(army.province);
  if (!from) return false;
  let current = army.province;
  for (const next of path) {
    const currentDef = content.provinces.get(current);
    if (!currentDef || !currentDef.neighbors.includes(next)) return false;
    if (!canMarchThrough(state, army.tag, next)) return false;
    current = next;
  }
  if (newPathKey !== oldPathKey) {
    army.history = [];
    army.moveProgress = 0;
    army.entrenchment = 0;
  }
  army.movePath = [...path];
  army.stance = 'move';
  return true;
}














