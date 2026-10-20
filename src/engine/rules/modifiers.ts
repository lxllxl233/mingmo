import type { ContentIndex, Effect, Modifier } from '../../content/types';
import type { CountryState, GameState } from '../state/types';
import { buildingModifiers } from '../systems/buildings';

export function addModifierInto(target: Modifier, source: Modifier): void {
  for (const key in source) {
    const value = source[key];
    if (value === undefined) continue;
    target[key] = (target[key] ?? 0) + value;
  }
}

function addEffectModifiers(target: Modifier, effects: readonly Effect[] | undefined): void {
  if (!effects) return;
  for (const effect of effects) {
    if ('addModifier' in effect) addModifierInto(target, effect.addModifier);
  }
}

/** 特权/税法的效果数组是静态内容，按对象缓存其修正，避免每次聚合重放效果。 */
const effectModifierCache = new WeakMap<object, Modifier>();

function effectModifier(source: { effects?: readonly Effect[] | undefined }): Modifier {
  const cached = effectModifierCache.get(source);
  if (cached) return cached;
  const total: Modifier = {};
  addEffectModifiers(total, source.effects);
  effectModifierCache.set(source, total);
  return total;
}

/** 永久 + 临时 + 特权 + 当前税法的修正总和。 */
export function aggregateModifiers(country: CountryState, content: ContentIndex): Modifier {
  const total: Modifier = {};
  addModifierInto(total, country.modifiers);
  for (const timed of country.timedModifiers) addModifierInto(total, timed.modifiers);
  for (const estate of Object.values(country.estates)) {
    for (const privilegeId of estate.privileges) {
      const privilege = content.privileges.get(privilegeId);
      if (privilege) addModifierInto(total, effectModifier(privilege));
    }
    const law = content.taxLaws.get(estate.taxLaw);
    if (law) addModifierInto(total, effectModifier(law));
  }
  return total;
}

export function modifierValue(modifiers: Modifier, key: string): number {
  return modifiers[key] ?? 0;
}

export interface ModifierSource {
  name: string;
  modifiers: Modifier;
}

/** 修正来源明细（基础 + 临时 + 特权 + 税法 + 建筑），供 UI 展示「谁在影响这一项」。 */
export function modifierSources(state: GameState, content: ContentIndex, tag: string): ModifierSource[] {
  const nation = state.countries[tag];
  if (!nation) return [];
  const sources: ModifierSource[] = [];
  sources.push({ name: '基础修正', modifiers: nation.modifiers });
  for (const timed of nation.timedModifiers) {
    sources.push({ name: timed.name, modifiers: timed.modifiers });
  }
  for (const estate of Object.values(nation.estates)) {
    for (const privilegeId of estate.privileges) {
      const privilege = content.privileges.get(privilegeId);
      if (privilege) sources.push({ name: privilege.name, modifiers: effectModifier(privilege) });
    }
    const law = content.taxLaws.get(estate.taxLaw);
    if (law) sources.push({ name: law.name, modifiers: effectModifier(law) });
  }
  const buildings = buildingModifiers(state, content, tag);
  if (Object.keys(buildings).length > 0) {
    sources.push({ name: '建筑', modifiers: buildings });
  }
  return sources;
}

/** 国家修正 + 已建成建筑修正。所有经济/军事/科研结算都应使用这个入口。 */
export function aggregateCountryModifiers(state: GameState, content: ContentIndex, tag: string): Modifier {
  const nation = state.countries[tag];
  if (!nation) return {};
  const total = aggregateModifiers(nation, content);
  addModifierInto(total, buildingModifiers(state, content, tag));
  return total;
}

export function grantModifier(country: CountryState, modifier: Modifier): void {
  addModifierInto(country.modifiers, modifier);
}
