import type { ContentIndex, EstateKey } from '../../content/types';
import { evaluateTrigger } from '../rules/triggers';
import type { GameState } from '../state/types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estateName(content: ContentIndex, tag: string, estateKey: EstateKey): string {
  return content.countryEstates.get(tag)?.find(estate => estate.key === estateKey)?.name
    ?? content.estateDefs.get(estateKey)?.name
    ?? estateKey;
}

export function canUseTaxLaw(
  state: GameState,
  content: ContentIndex,
  tag: string,
  estateKey: EstateKey,
  lawId: string,
): boolean {
  const nation = state.countries[tag];
  const estate = nation?.estates[estateKey];
  const law = content.taxLaws.get(lawId);
  if (!nation || !estate || !law) return false;
  if (law.estate !== estateKey) return false;
  if (law.country !== undefined && law.country !== tag) return false;
  if (estate.taxLaw === lawId) return false;
  if (estate.reform !== null || estate.cooldownDays > 0) return false;
  if (law.require && !evaluateTrigger(law.require, { state, content, country: tag })) return false;
  return true;
}

export function startTaxReform(
  state: GameState,
  content: ContentIndex,
  tag: string,
  estateKey: EstateKey,
  lawId: string,
  cost = 50,
): boolean {
  const nation = state.countries[tag];
  const estate = nation?.estates[estateKey];
  if (!nation || !estate) return false;
  if (nation.politicalPower < cost) return false;
  if (!canUseTaxLaw(state, content, tag, estateKey, lawId)) return false;
  nation.politicalPower -= cost;
  estate.reform = { law: lawId, daysLeft: 90, totalDays: 90 };
  // 改革启动即视为对既得利益动手：分配锁定解除，允许把份额调到惯例以下。
  estate.allocationUnlocked = true;
  const law = content.taxLaws.get(lawId);
  state.log.push({
    day: state.day,
    category: 'estate',
    country: tag,
    text: `${estateName(content, tag, estateKey)} 税制改革开始：${law?.name ?? lawId}（90 日）`,
    severity: 'info',
  });
  return true;
}

function completeTaxReform(state: GameState, content: ContentIndex, tag: string, estateKey: EstateKey, lawId: string): void {
  const nation = state.countries[tag];
  const estate = nation?.estates[estateKey];
  const law = content.taxLaws.get(lawId);
  if (!nation || !estate || !law) return;
  const oldLaw = content.taxLaws.get(estate.taxLaw);
  const oldRate = oldLaw?.rate ?? 0;
  estate.taxLaw = law.id;
  estate.effectiveRate = law.rate;
  estate.cooldownDays = 180;
  estate.influence = clamp(estate.influence + law.influenceShift, 0, 100);

  const delta = law.rate - oldRate;
  const sensitivity = content.estateDefs.get(estateKey)?.sensitivity ?? 1;
  if (delta > 0) {
    estate.loyalty = clamp(estate.loyalty - delta * sensitivity * 50, 0, 100);
    if (law.incidence) {
      const target = nation.estates[law.incidence.estate];
      if (target) {
        target.loyalty = clamp(target.loyalty - delta * law.incidence.factor * 200, 0, 100);
      }
      for (const province of Object.values(state.provinces)) {
        if (province.controller !== tag) continue;
        province.unrest = clamp(province.unrest + delta * law.incidence.factor * 100, 0, 100);
      }
    }
  } else if (delta < 0) {
    estate.loyalty = clamp(estate.loyalty - delta * sensitivity * 20, 0, 100);
  }
  state.log.push({
    day: state.day,
    category: 'estate',
    country: tag,
    text: `${estateName(content, tag, estateKey)} 税制改革完成：${law.name}`,
    severity: 'info',
  });
}

export function advanceTaxReforms(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    for (const estate of Object.values(nation.estates)) {
      if (estate.cooldownDays > 0) estate.cooldownDays -= 1;
      if (!estate.reform) continue;
      estate.reform.daysLeft -= 1;
      if (estate.reform.daysLeft <= 0) {
        const lawId = estate.reform.law;
        estate.reform = null;
        completeTaxReform(state, content, nation.tag, estate.key, lawId);
      }
    }
  }
}
