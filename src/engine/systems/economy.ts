import type { ContentIndex, TaxLaw } from '../../content/types';
import type { CountryState, GameState, MonthlyReport } from '../state/types';
import { aggregateModifiers } from '../rules/modifiers';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function coreResourceFactor(state: GameState, content: ContentIndex, tag: string, provinceId: string): number {
  const province = state.provinces[provinceId];
  if (!province || province.controller !== tag) return 0;
  if (province.cores.includes(tag)) return 1;
  if (content.countries.get(tag)?.government === 'rebel') return 0.45;
  const mandate = state.countries[tag]?.mandate ?? 50;
  return 0.05 + Math.max(0, Math.min(100, mandate)) / 100 * 0.25;
}

function governmentProfile(government: string): {
  tax: number;
  trade: number;
  food: number;
  manpower: number;
  stability: number;
} {
  switch (government) {
    case 'merchant_republic':
    case 'maritime':
    case 'company':
      return { tax: 0.82, trade: 1.28, food: 0.9, manpower: 0.85, stability: 0.95 };
    case 'rebel':
      return { tax: 0.78, trade: 0.75, food: 1.12, manpower: 1.2, stability: 0.9 };
    case 'khanate':
    case 'tribal_confederation':
    case 'cossack_host':
      return { tax: 0.65, trade: 0.8, food: 0.82, manpower: 1.3, stability: 0.9 };
    case 'shogunate':
      return { tax: 0.95, trade: 0.86, food: 1.04, manpower: 1.0, stability: 1.05 };
    case 'theocracy':
      return { tax: 0.88, trade: 0.82, food: 0.96, manpower: 0.95, stability: 1.12 };
    case 'bureaucratic_monarchy':
      return { tax: 0.92, trade: 0.9, food: 0.98, manpower: 0.95, stability: 1.02 };
    case 'tributary':
      return { tax: 0.8, trade: 0.92, food: 1.0, manpower: 0.9, stability: 0.95 };
    case 'military_junta':
      return { tax: 0.9, trade: 0.75, food: 0.92, manpower: 1.15, stability: 0.88 };
    default:
      return { tax: 1, trade: 1, food: 1, manpower: 1, stability: 1 };
  }
}

export function countryProvinceList(
  state: GameState,
  content: ContentIndex,
  tag: string,
): Array<{ id: string; def: NonNullable<ReturnType<ContentIndex['provinces']['get']>>; state: GameState['provinces'][string] }> {
  const result: Array<{ id: string; def: NonNullable<ReturnType<ContentIndex['provinces']['get']>>; state: GameState['provinces'][string] }> = [];
  for (const province of Object.values(state.provinces)) {
    if (province.controller !== tag) continue;
    const def = content.provinces.get(province.id);
    if (def) result.push({ id: province.id, def, state: province });
  }
  return result;
}

export function countryPopulation(state: GameState, content: ContentIndex, tag: string): number {
  return countryProvinceList(state, content, tag).reduce((sum, entry) => sum + entry.state.population, 0);
}

export function armyStrengthOf(state: GameState, tag: string): number {
  let total = 0;
  for (const army of Object.values(state.armies)) {
    if (army.tag !== tag) continue;
    const c = army.composition;
    total += c.infantry + c.firearm + c.cavalry + c.artillery + c.naval;
  }
  return total;
}

export function monthlyArmyPay(state: GameState, content: ContentIndex, tag: string): number {
  const strength = armyStrengthOf(state, tag);
  const nation = state.countries[tag];
  if (!nation) return 0;
  const modifiers = aggregateModifiers(nation, content);
  const government = content.countries.get(tag)?.government;
  const rebelDiscount = government === 'rebel' ? 0.55 : 1;
  const multiplier = 1 + (modifiers['army_upkeep_pct'] ?? 0) / 100;
  return strength * content.balance.economy.armyUpkeepPerManMonth * Math.max(0.2, multiplier) * rebelDiscount;
}

function lawOf(content: ContentIndex, nation: CountryState, estateKey: string): TaxLaw | undefined {
  const estate = nation.estates[estateKey];
  return estate ? content.taxLaws.get(estate.taxLaw) : undefined;
}

const POPULATION_WEIGHTS: Record<string, number> = {
  dynasty: 0.015,
  nobles: 0.035,
  officials: 0.045,
  gentry: 0.14,
  merchants: 0.06,
  peasants: 0.56,
  soldiers: 0.08,
  clergy: 0.04,
};

export function estatePopulationShare(content: ContentIndex, tag: string, estateKey: string): number {
  const configs = content.countryEstates.get(tag) ?? [];
  const total = configs.reduce((sum, config) => sum + (POPULATION_WEIGHTS[config.key] ?? 0.05), 0);
  return total > 0 ? (POPULATION_WEIGHTS[estateKey] ?? 0.05) / total : 0;
}
export function stabilityFactor(stability: number): number {
  return 0.38 + Math.max(0, Math.min(100, stability)) / 220;
}

export function minimumAllocationShare(influence: number): number {
  return Math.min(45, 2 + Math.max(0, influence) * 0.13);
}

function normalizedAllocation(
  content: ContentIndex,
  nation: CountryState,
): { shares: Record<string, number>; minimums: Record<string, number>; unallocated: number } {
  const configs = content.countryEstates.get(nation.tag) ?? [];
  const keys = configs.length > 0 ? configs.map(config => config.key) : Object.keys(nation.estates);
  const raw: Record<string, number> = {};
  const minimums: Record<string, number> = {};
  for (const key of keys) {
    const estate = nation.estates[key];
    if (!estate) continue;
    minimums[key] = minimumAllocationShare(estate.influence);
    raw[key] = Math.max(minimums[key], nation.allocation[key] ?? 100 / Math.max(1, keys.length));
  }
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const scale = total > 100 ? 100 / total : 1;
  const shares: Record<string, number> = {};
  for (const key of Object.keys(raw)) {
    const percent = raw[key]! * scale;
    shares[key] = percent / 100;
    nation.allocation[key] = Math.round(percent * 10) / 10;
  }
  return { shares, minimums, unallocated: Math.max(0, 1 - Object.values(shares).reduce((sum, value) => sum + value, 0)) };
}
export function runMonthlyEconomy(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const provinces = countryProvinceList(state, content, nation.tag);
    const modifiers = aggregateModifiers(nation, content);
    const government = governmentProfile(content.countries.get(nation.tag)?.government ?? 'monarchy');
    const momentum = 1 + clamp(nation.economicMomentum, -1, 1) * 0.3;
    const taxEfficiency = (1 + (modifiers['tax_efficiency_pct'] ?? 0) / 100) * government.tax * momentum;
    const tradeEfficiency = (1 + (modifiers['trade_efficiency_pct'] ?? 0) / 100) * government.trade * momentum;
    const officials = nation.estates['officials'];
    const adminCapacity = content.balance.economy.adminCapacityBase + (officials?.influence ?? 0) * 0.6;

    let base = 0;
    let weightedPopulation = 0;
    const baseByRegion: Record<string, number> = {};
    for (const entry of provinces) {
      const warDamage = 1 - entry.state.devastation / 200;
      const coreFactor = coreResourceFactor(state, content, nation.tag, entry.id);
      weightedPopulation += entry.state.population * coreFactor;
      const contribution = (entry.def.landholding * content.balance.economy.landValuePerWan
        + entry.state.population * content.balance.economy.populationValuePerPerson)
        * Math.max(0.2, warDamage) * coreFactor;
      base += contribution;
      const regionId = entry.def.regionId;
      baseByRegion[regionId] = (baseByRegion[regionId] ?? 0) + contribution;
    }

    const stabilityMultiplier = stabilityFactor(nation.stability);
    const pie = base * stabilityMultiplier;
    const { shares, unallocated } = normalizedAllocation(content, nation);
    let totalTax = 0;
    const silverByEstate: Record<string, number> = {};
    const foodByEstate: Record<string, number> = {};
    const taxByEstate: Record<string, number> = {};
    for (const estate of Object.values(nation.estates)) {
      const law = lawOf(content, nation, estate.key);
      const share = shares[estate.key] ?? 0;
      if (!law) continue;
      const allocatedAnnual = pie * share;
      estate.income = allocatedAnnual;
      const gross = (allocatedAnnual / 12) * law.rate;
      const evasion = clamp(
        law.evasionBase
        + (100 - estate.loyalty) / 400
        + estate.influence / 500
        - adminCapacity / 300,
        0,
        0.8,
      );
      const efficiency = law.estate === 'merchants' ? tradeEfficiency : 1;
      let tax = gross
        * law.efficiency
        * (1 - evasion)
        * taxEfficiency
        * efficiency;
      if (estate.loyalty < 30) tax *= 0.5 + estate.loyalty / 60;
      if (estate.reform) tax *= 0.8;
      tax = Math.max(0, tax);
      estate.collected = tax;
      totalTax += tax;
      silverByEstate[estate.key] = tax;
      taxByEstate[estate.key] = tax;
    }

    const averageLoyalty = Object.values(nation.estates).reduce((sum, estate) => sum + estate.loyalty, 0)
      / Math.max(1, Object.values(nation.estates).length);
    const corruptionLoss = totalTax * clamp(nation.corruption / 135, 0, 0.85);
    const loyaltyCost = totalTax * (1 - averageLoyalty / 100) * 0.42;
    const armyPay = monthlyArmyPay(state, content, nation.tag);
    const armyFood = armyStrengthOf(state, nation.tag) * content.balance.economy.armyFoodPerManMonth
      * (content.countries.get(nation.tag)?.government === 'rebel' ? 0.7 : 1);
    const availableBeforeFood = Math.max(0, totalTax - corruptionLoss - loyaltyCost);
    const foodPurchaseSilver = availableBeforeFood * clamp(nation.foodPurchasePct, 0, 100) / 100;
    const foodOutput = government.food * (1 + clamp(modifiers['food_output_pct'] ?? 0, -80, 100) / 100);
    const foodPurchased = foodPurchaseSilver / Math.max(0.1, content.balance.economy.grainPrice) * Math.max(0.2, foodOutput);
    const famineResistance = clamp(modifiers['famine_resistance'] ?? 0, 0, 0.8);
    const hoardCap = 500000 + provinces.length * 4000;
    const hoardLoss = nation.treasury > hoardCap ? (nation.treasury - hoardCap) * 0.08 : 0;
    const net = availableBeforeFood - foodPurchaseSilver - armyPay - hoardLoss;
    const expense = corruptionLoss + loyaltyCost + armyPay + foodPurchaseSilver + hoardLoss;
    nation.food += foodPurchased;
    nation.treasury += net;

    for (const estate of Object.values(nation.estates)) {
      const share = shares[estate.key] ?? 0;
      foodByEstate[estate.key] = foodPurchased * share;
    }

    if (nation.treasury < 0) {
      const shortfall = -nation.treasury;
      nation.treasury = 0;
      nation.arrears += shortfall;
      nation.inflation = clamp(nation.inflation + Math.min(2, shortfall / 150000), 0, 100);
    } else {
      const repayment = Math.min(nation.arrears, Math.max(0, net) * 0.15);
      nation.arrears = Math.max(0, nation.arrears - repayment);
    }

    let foodShortage = false;
    if (nation.food < armyFood) {
      nation.food = 0;
      foodShortage = true;
      nation.stability = clamp(nation.stability - 0.4 * (1 - famineResistance), 0, 100);
      nation.armyLoyalty = clamp(nation.armyLoyalty - 0.2 * (1 - famineResistance), 0, 100);
    } else {
      nation.food -= armyFood;
    }
    nation.flags['food_shortage'] = foodShortage;
    if (foodShortage) {
      for (const estate of Object.values(nation.estates)) {
        estate.loyalty = clamp(estate.loyalty - 0.8 * (1 - famineResistance), 0, 100);
      }
    }
    const silverByRegion: Record<string, number> = {};
    const foodByRegion: Record<string, number> = {};
    for (const [regionId, regionBase] of Object.entries(baseByRegion)) {
      if (base <= 0) continue;
      silverByRegion[regionId] = totalTax * (regionBase / base);
      foodByRegion[regionId] = foodPurchased * (regionBase / base);
    }

    nation.manpower += weightedPopulation * content.balance.economy.manpowerRegenRate * government.manpower;
    const momentumTrend = (nation.stability - 50) / 240
      + (averageLoyalty - 50) / 420
      - nation.warExhaustion / 260
      - (nation.fiscalCrisisDays > 0 ? 0.04 : 0)
      + (nation.treasury > hoardCap ? -0.03 : nation.treasury > 150000 ? 0.01 : -0.01);
    nation.economicMomentum = clamp(nation.economicMomentum * 0.985 + momentumTrend * 0.08, -1, 1);

    for (const estate of Object.values(nation.estates)) {
      const law = lawOf(content, nation, estate.key);
      if (!law) continue;
      const sensitivity = content.estateDefs.get(estate.key)?.sensitivity ?? 1;
      const fairness = ((shares[estate.key] ?? 0) - estatePopulationShare(content, nation.tag, estate.key)) * 3;
      const pressure = (estate.customaryRate - law.rate) * sensitivity * 4;
      estate.loyalty = clamp(estate.loyalty + fairness + pressure + law.loyaltyDrift * 0.3, 0, 100);
      estate.customaryRate += (law.rate - estate.customaryRate) * 0.02;
      estate.effectiveRate = law.rate;
    }

    nation.corruption = clamp(
      nation.corruption + content.balance.economy.corruptionDrift
      + (modifiers['corruption_monthly'] ?? 0)
      + ((officials?.loyalty ?? 50) < 30 ? 0.12 : 0)
      - nation.authority / 1000,
      0,
      100,
    );
    const loyaltyWeight = Object.values(nation.estates).reduce((sum, estate) => sum + Math.max(1, estate.influence), 0);
    const weightedLoyalty = Object.values(nation.estates).reduce(
      (sum, estate) => sum + estate.loyalty * Math.max(1, estate.influence),
      0,
    ) / Math.max(1, loyaltyWeight);
    const stabilityTarget = clamp(weightedLoyalty * government.stability, 0, 100);
    nation.stability = clamp(
      nation.stability
      + (stabilityTarget - nation.stability) * 0.12
      + content.balance.economy.stabilityDrift * 0.4
      + (modifiers['stability_monthly'] ?? 0)
      + (nation.treasury > 0 ? 0.02 : -0.08)
      + (foodShortage ? -0.25 : 0.01)
      - nation.warExhaustion / 1000,
      0,
      100,
    );
    nation.mandate = clamp(
      nation.mandate
      + (averageLoyalty - 50) / 600
      + (nation.stability - 50) / 1000
      - nation.corruption / 1200
      + (modifiers['mandate_monthly'] ?? 0),
      0,
      100,
    );
    nation.inflation = clamp(nation.inflation - 0.04, 0, 100);

    const arrearsMonths = armyPay > 0 ? nation.arrears / armyPay : 0;
    if (arrearsMonths > 3) {
      nation.armyLoyalty = clamp(nation.armyLoyalty - 2, 0, 100);
      if (state.day % 30 === 0) {
        state.log.push({
          day: state.day,
          category: 'military',
          country: nation.tag,
          text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 欠饷 ${arrearsMonths.toFixed(1)} 个月，军心 ${nation.armyLoyalty.toFixed(0)}`,
          severity: 'danger',
        });
      }
    } else {
      nation.armyLoyalty = clamp(nation.armyLoyalty + 0.1, 0, 100);
    }

    const report: MonthlyReport = {
      day: state.day,
      income: totalTax,
      expense,
      net,
      silverByEstate,
      foodByEstate,
      silverByRegion,
      foodByRegion,
      allocation: { ...shares },
      taxByEstate,
      economicPie: pie / 12,
      unallocated,
      corruptionLoss,
      loyaltyCost,
      foodPurchaseSilver,
      foodPurchased,
      expenseArmy: armyPay,
      expenseOfficials: 0,
      expenseDynasty: 0,
      expenseRelief: 0,
      expenseHoard: hoardLoss,
      expenseCourt: 0,
      foodIncome: foodPurchased,
      foodArmy: armyFood,
      foodCivilian: 0,
      arrears: nation.arrears,
    };
    nation.lastReport = report;
    nation.monthlyHistory.push(report);
    if (nation.monthlyHistory.length > 24) nation.monthlyHistory.shift();
    state.stats.taxesRaised += totalTax;

    if (net < 0 && nation.treasury < 100000 && state.day % 90 === 0) {
      state.log.push({
        day: state.day,
        category: 'economy',
        country: nation.tag,
        text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 月净收入 ${Math.round(net)} 两，银库见底`,
        severity: 'warning',
      });
    }
  }
}













