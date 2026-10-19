import type { ContentIndex, Effect, Modifier } from '../../content/types';
import type { CountryState, GameState } from '../state/types';
import { buildingModifiers } from '../systems/buildings';

export function addModifierInto(target: Modifier, source: Modifier): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function addEffectModifiers(target: Modifier, effects: readonly Effect[] | undefined): void {
  if (!effects) return;
  for (const effect of effects) {
    if ('addModifier' in effect) addModifierInto(target, effect.addModifier);
  }
}

/** 永久 + 临时 + 特权 + 当前税法的修正总和。 */
export function aggregateModifiers(country: CountryState, content: ContentIndex): Modifier {
  const total: Modifier = {};
  addModifierInto(total, country.modifiers);
  for (const timed of country.timedModifiers) addModifierInto(total, timed.modifiers);
  for (const estate of Object.values(country.estates)) {
    for (const privilegeId of estate.privileges) {
      const privilege = content.privileges.get(privilegeId);
      if (privilege) addEffectModifiers(total, privilege.effects);
    }
    const law = content.taxLaws.get(estate.taxLaw);
    if (law) addEffectModifiers(total, law.effects);
  }
  return total;
}

export function modifierValue(modifiers: Modifier, key: string): number {
  return modifiers[key] ?? 0;
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
