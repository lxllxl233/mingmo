import type { ContentIndex, NumCmp, Trigger } from '../../content/types';
import { fromDayIndex, parseDay } from '../core/clock';
import type { GameState } from '../state/types';
import { relationKey } from '../state/types';

export interface TriggerContext {
  state: GameState;
  content: ContentIndex;
  country: string;
  province?: string;
}

function cmp(value: number, comparison: NumCmp): boolean {
  if (comparison.lt !== undefined && !(value < comparison.lt)) return false;
  if (comparison.lte !== undefined && !(value <= comparison.lte)) return false;
  if (comparison.gt !== undefined && !(value > comparison.gt)) return false;
  if (comparison.gte !== undefined && !(value >= comparison.gte)) return false;
  if (comparison.eq !== undefined && value !== comparison.eq) return false;
  return true;
}

function countryArmySize(state: GameState, tag: string): number {
  let total = 0;
  for (const army of Object.values(state.armies)) {
    if (army.tag !== tag) continue;
    const c = army.composition;
    total += c.infantry + c.firearm + c.cavalry + c.artillery + c.naval;
  }
  return total;
}

export function evaluateTrigger(trigger: Trigger, context: TriggerContext): boolean {
  const { state, content, country } = context;
  if ('all' in trigger) return trigger.all.every(item => evaluateTrigger(item, context));
  if ('any' in trigger) return trigger.any.some(item => evaluateTrigger(item, context));
  if ('not' in trigger) return !evaluateTrigger(trigger.not, context);
  if ('date' in trigger) {
    if (trigger.date.after !== undefined && state.day < parseDay(trigger.date.after)) return false;
    if (trigger.date.before !== undefined && state.day > parseDay(trigger.date.before)) return false;
    return true;
  }
  if ('owns' in trigger) return state.provinces[trigger.owns]?.owner === country;
  if ('controls' in trigger) return state.provinces[trigger.controls]?.controller === country;
  if ('atWarWith' in trigger) {
    return state.wars.some(war =>
      (war.attacker === country && war.defender === trigger.atWarWith)
      || (war.defender === country && war.attacker === trigger.atWarWith));
  }
  if ('hasFlag' in trigger) return state.countries[country]?.flags[trigger.hasFlag] === true;
  if ('notHasFlag' in trigger) return state.countries[country]?.flags[trigger.notHasFlag] !== true;
  const current = state.countries[country];
  if (!current) return false;
  if ('treasury' in trigger) return cmp(current.treasury, trigger.treasury);
  if ('stability' in trigger) return cmp(current.stability, trigger.stability);
  if ('mandate' in trigger) return cmp(current.mandate, trigger.mandate);
  if ('authority' in trigger) return cmp(current.authority, trigger.authority);
  if ('corruption' in trigger) return cmp(current.corruption, trigger.corruption);
  if ('armySize' in trigger) return cmp(countryArmySize(state, country), trigger.armySize);
  if ('provinceCount' in trigger) {
    const count = Object.values(state.provinces).filter(province => province.owner === country).length;
    return cmp(count, trigger.provinceCount);
  }
  if ('factionInfluence' in trigger) {
    return Object.entries(trigger.factionInfluence).every(([name, comparison]) =>
      cmp(current.factions[name] ?? 0, comparison));
  }
  if ('relation' in trigger) {
    return cmp(state.relations[relationKey(country, trigger.relation.target)] ?? 0, trigger.relation);
  }
  if ('year' in trigger) return cmp(fromDayIndex(state.day).year, trigger.year);
  if ('hasTech' in trigger) return current.completedTechs.includes(trigger.hasTech);
  if ('hasAdvisor' in trigger) return false;
  if ('controlsCapital' in trigger) {
    return (state.provinces[current.capital]?.controller === country) === trigger.controlsCapital;
  }
  if ('isAtWar' in trigger) {
    const atWar = state.wars.some(war => war.attacker === country || war.defender === country);
    return atWar === trigger.isAtWar;
  }
  if ('estateLoyalty' in trigger) {
    return Object.entries(trigger.estateLoyalty).every(([estate, comparison]) =>
      cmp(current.estates[estate]?.loyalty ?? 0, comparison));
  }
  if ('estateInfluence' in trigger) {
    return Object.entries(trigger.estateInfluence).every(([estate, comparison]) =>
      cmp(current.estates[estate]?.influence ?? 0, comparison));
  }
  if ('taxLaw' in trigger) return current.estates[trigger.taxLaw.estate]?.taxLaw === trigger.taxLaw.is;
  if ('hasPrivilege' in trigger) {
    return Object.values(current.estates).some(estate => estate.privileges.includes(trigger.hasPrivilege));
  }
  const exhaustive: never = trigger;
  void exhaustive;
  void content;
  return false;
}
