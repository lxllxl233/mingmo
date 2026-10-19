import type { ContentIndex } from '../../content/types';
import type { ArmyState, CountryState, GameState } from '../state/types';
import { armyStrength } from '../state/types';

function crisisArmyLoss(state: GameState, army: ArmyState, rate: number): number {
  const total = armyStrength(army);
  if (total <= 0) return 0;
  const loss = Math.min(total, Math.max(1, Math.ceil(total * rate)));
  const keep = (total - loss) / total;
  army.composition.infantry = Math.floor(army.composition.infantry * keep);
  army.composition.firearm = Math.floor(army.composition.firearm * keep);
  army.composition.cavalry = Math.floor(army.composition.cavalry * keep);
  army.composition.artillery = Math.floor(army.composition.artillery * keep);
  army.composition.naval = Math.floor(army.composition.naval * keep);
  if (armyStrength(army) >= total) army.composition.infantry = Math.max(0, army.composition.infantry - 1);
  for (const war of state.wars) {
    if (war.attacker === army.tag || war.defender === army.tag) {
      war.attrition[army.tag] = (war.attrition[army.tag] ?? 0) + loss;
    }
  }
  return loss;
}

export function crisisCombatPenalty(nation: CountryState): number {
  return -Math.min(30, nation.fiscalCrisisDays * 0.12 + nation.foodCrisisDays * 0.18);
}

export function advanceCrisis(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const report = nation.lastReport;
    const fiscal = nation.treasury <= 0
      && (nation.arrears > 0 || (report?.net ?? 0) < 0);
    const food = nation.food <= 0;
    nation.fiscalCrisisDays = fiscal ? Math.min(300, nation.fiscalCrisisDays + 1) : Math.max(0, nation.fiscalCrisisDays - 2);
    nation.foodCrisisDays = food ? Math.min(300, nation.foodCrisisDays + 1) : Math.max(0, nation.foodCrisisDays - 2);

    const armies = Object.values(state.armies).filter(army => army.tag === nation.tag);
    if (nation.fiscalCrisisDays > 0) {
      const pressure = Math.min(1.5, 0.15 + nation.fiscalCrisisDays * 0.012);
      for (const army of armies) {
        army.organization = Math.max(0, army.organization - pressure);
        army.supply = Math.max(0, army.supply - pressure * 0.6);
      }
      if (nation.fiscalCrisisDays >= 30) {
        nation.stability = Math.max(0, nation.stability - 0.08);
        nation.armyLoyalty = Math.max(0, nation.armyLoyalty - 0.06);
        for (const army of armies) crisisArmyLoss(state, army, 0.0008);
      }
    }
    if (nation.foodCrisisDays > 0) {
      const pressure = Math.min(2, 0.2 + nation.foodCrisisDays * 0.015);
      for (const army of armies) {
        army.organization = Math.max(0, army.organization - pressure);
        army.supply = Math.max(0, army.supply - pressure);
      }
      if (nation.foodCrisisDays >= 20) {
        nation.stability = Math.max(0, nation.stability - 0.1);
        nation.mandate = Math.max(0, nation.mandate - 0.03);
        for (const army of armies) crisisArmyLoss(state, army, 0.0012);
      }
    }

    if (nation.fiscalCrisisDays === 8 || nation.fiscalCrisisDays === 30 || nation.fiscalCrisisDays === 90) {
      state.log.push({
        day: state.day,
        category: 'politics',
        country: nation.tag,
        text: `国库枯竭 ${nation.fiscalCrisisDays} 日：军饷拖欠，军队组织与非战斗减员加剧`,
        severity: 'danger',
      });
    }
    if (nation.foodCrisisDays === 8 || nation.foodCrisisDays === 30 || nation.foodCrisisDays === 90) {
      state.log.push({
        day: state.day,
        category: 'politics',
        country: nation.tag,
        text: `粮储断绝 ${nation.foodCrisisDays} 日：饥荒蔓延，军队与民心同时崩溃`,
        severity: 'danger',
      });
    }
    if (nation.fiscalCrisisDays >= 365 || nation.foodCrisisDays >= 365) {
      nation.alive = false;
      nation.stability = 0;
      nation.armyLoyalty = 0;
      state.log.push({
        day: state.day,
        category: 'politics',
        country: nation.tag,
        text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 因长期财政/粮食崩溃而瓦解`,
        severity: 'danger',
      });
      if (nation.tag === state.playerTag) {
        state.ended = true;
        state.victory = {
          winner: null,
          reason: nation.fiscalCrisisDays >= 365 ? '国库崩溃' : '粮荒崩溃',
          score: 0,
          breakdown: {},
        };
      }
    }
  }
}

