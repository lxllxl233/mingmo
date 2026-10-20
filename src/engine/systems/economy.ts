import type { ContentIndex, TaxLaw } from '../../content/types';
import type { CountryState, GameState, MonthlyReport } from '../state/types';
import { aggregateCountryModifiers } from '../rules/modifiers';
import { blockadePenalty } from '../rules/naval';
import { tradePostMonthlyIncome } from './trade';
import { sakokuMonthlyIncome } from './sakoku';
import { rngFor } from '../core/rng';

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

export function governmentProfile(government: string): {
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
  const nation = state.countries[tag];
  if (!nation) return 0;
  const modifiers = aggregateCountryModifiers(state, content, tag);
  const government = content.countries.get(tag)?.government;
  const rebelDiscount = government === 'rebel' ? 0.55 : 1;
  const multiplier = 1 + (modifiers['army_upkeep_pct'] ?? 0) / 100;
  let weightedStrength = 0;
  for (const army of Object.values(state.armies)) {
    if (army.tag !== tag) continue;
    const c = army.composition;
    const strength = c.infantry + c.firearm + c.cavalry + c.artillery + c.naval;
    const template = content.armyTemplates.get(army.templateId);
    weightedStrength += strength * (template?.upkeep ?? 1);
  }
  const inflationFactor = 1 + nation.inflation / 300;
  return weightedStrength * content.balance.economy.armyUpkeepPerManMonth
    * Math.max(0.2, multiplier) * rebelDiscount * inflationFactor;
}

function lawOf(content: ContentIndex, nation: CountryState, estateKey: string): TaxLaw | undefined {
  const estate = nation.estates[estateKey];
  return estate ? content.taxLaws.get(estate.taxLaw) : undefined;
}

const POPULATION_WEIGHTS: Record<string, number> = {
  ruling: 0.12,
  merchants: 0.06,
  landlords: 0.14,
  artisans: 0.10,
  peasants: 0.58,
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
  // 未分配自动归一化：所有份额始终缩放到 100%，不再保留「未分配」黑洞。
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const scale = total > 0 ? 100 / total : 0;
  const shares: Record<string, number> = {};
  for (const key of Object.keys(raw)) {
    const percent = raw[key]! * scale;
    shares[key] = percent / 100;
    nation.allocation[key] = Math.round(percent * 10) / 10;
  }
  return { shares, minimums, unallocated: 0 };
}

export function bottomClassState(
  content: ContentIndex,
  nation: CountryState,
): { popShare: number; loyalty: number } {
  let popShare = 0;
  let weightedLoyalty = 0;
  for (const key of ['peasants', 'artisans'] as const) {
    const estate = nation.estates[key];
    if (!estate) continue;
    const share = estatePopulationShare(content, nation.tag, key);
    popShare += share;
    weightedLoyalty += estate.loyalty * share;
  }
  return {
    popShare: clamp(popShare, 0, 1),
    loyalty: popShare > 0 ? weightedLoyalty / popShare : 50,
  };
}
export function runMonthlyEconomy(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const provinces = countryProvinceList(state, content, nation.tag);
    const modifiers = aggregateCountryModifiers(state, content, nation.tag);
    const government = governmentProfile(content.countries.get(nation.tag)?.government ?? 'monarchy');
    const momentum = 1 + clamp(nation.economicMomentum, -1, 1) * 0.3;
    const taxEfficiency = (1 + (modifiers['tax_efficiency_pct'] ?? 0) / 100) * government.tax * momentum;
    // 贸易效率只影响「产出换成银」的效率，不再只放大商人税，也不惩罚粮食税。
    const monetization = clamp(
      Math.max(1, government.trade) * (1 + (modifiers['trade_efficiency_pct'] ?? 0) / 100),
      0.5,
      1.8,
    );
    const rulers = nation.estates['ruling'];
    const adminCapacity = content.balance.economy.adminCapacityBase + (rulers?.influence ?? 0) * 0.6;

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
    const grainPrice = Math.max(0.1, content.balance.economy.grainPrice * (1 + nation.inflation / 200));
    let totalTax = 0;
    let foodIncome = 0;
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
      let tax = gross
        * law.efficiency
        * (1 - evasion)
        * taxEfficiency;
      if (estate.loyalty < 30) tax *= 0.5 + estate.loyalty / 60;
      if (estate.reform) tax *= 0.8;
      tax = Math.max(0, tax);
      estate.collected = tax;
      // 税制决定征收形态：银 share 经贸易货币化后计入国库，其余按粮价折算为粮食。
      const silverShare = clamp(law.silverShare, 0, 1);
      const silverTax = tax * silverShare * monetization;
      const foodTax = (tax - tax * silverShare) / grainPrice;
      totalTax += silverTax;
      foodIncome += foodTax;
      silverByEstate[estate.key] = silverTax;
      foodByEstate[estate.key] = foodTax;
      taxByEstate[estate.key] = tax;
    }

    const blockade = blockadePenalty(state, content, nation.tag);
    if (blockade > 0) totalTax *= 1 - blockade;
    const overextension = Math.min(0.25, Math.max(0, (provinces.length - 120) / 480) * 0.4);
    if (overextension > 0) totalTax *= 1 - overextension;
    const tradePostIncome = tradePostMonthlyIncome(state, content, nation.tag);
    const sakokuIncome = sakokuMonthlyIncome(state, content, nation.tag);
    const totalIncome = totalTax + tradePostIncome + sakokuIncome;
    const averageLoyalty = Object.values(nation.estates).reduce((sum, estate) => sum + estate.loyalty, 0)
      / Math.max(1, Object.values(nation.estates).length);
    const corruptionLoss = totalIncome * clamp(nation.corruption / 135, 0, 0.85);
    // 维稳成本只由基层（农民/小生产者）承担；精英忠诚通过稳定与天命影响国家。
    const bottom = bottomClassState(content, nation);
    const loyaltyCost = totalIncome * bottom.popShare * (1 - bottom.loyalty / 100) * 0.55;
    // 腐败按各阶级税基与影响力归属，Σ corruptionByEstate = corruptionLoss。
    const corruptionByEstate: Record<string, number> = {};
    const corruptionWeights: Record<string, number> = {};
    let corruptionWeightTotal = 0;
    for (const estate of Object.values(nation.estates)) {
      const weight = (taxByEstate[estate.key] ?? 0) * (0.5 + estate.influence / 100);
      corruptionWeights[estate.key] = weight;
      corruptionWeightTotal += weight;
    }
    for (const [key, weight] of Object.entries(corruptionWeights)) {
      corruptionByEstate[key] = corruptionWeightTotal > 0 ? corruptionLoss * weight / corruptionWeightTotal : 0;
    }
    const armyPay = monthlyArmyPay(state, content, nation.tag);
    const armyFood = armyStrengthOf(state, nation.tag) * content.balance.economy.armyFoodPerManMonth
      * (content.countries.get(nation.tag)?.government === 'rebel' ? 0.7 : 1);
    const pressure = content.countries.get(nation.tag)?.pressure;
    const pressureCost = pressure
      ? pressure.silverPerMonth + provinces.length * pressure.silverPerProvince
      : 0;
    // 现金瀑布：先军饷，再购粮；购粮不足不形成债务，只有军饷缺口计入欠饷。
    let priorDebt = 0;
    if (nation.treasury < 0) {
      priorDebt = -nation.treasury;
      nation.treasury = 0;
    }
    // 腐败与维稳先扣收入；维持成本（行政/军镇压力）可以超支，由国库补足。
    // 不在这里夹到 0：月报必须如实展示成本，付不出的部分月底转成事件债。
    const available = totalIncome - corruptionLoss - loyaltyCost - pressureCost;
    const cash = Math.max(0, nation.treasury);
    const liquid = Math.max(0, cash + available);
    const armyPaid = Math.min(armyPay, liquid);
    const wageShortfall = Math.max(0, armyPay - armyPaid);
    const cashAfterArmy = Math.max(0, liquid - armyPaid);
    const foodPurchaseTarget = Math.max(0, available) * clamp(nation.foodPurchasePct, 0, 100) / 100;
    const foodPurchaseSilver = Math.min(foodPurchaseTarget, cashAfterArmy);
    const trainingSilver = Math.max(0, nation.trainingSpentSilverMonth ?? 0);
    const trainingFood = Math.max(0, nation.trainingSpentFoodMonth ?? 0);
    const trainingStalledSilver = Math.max(0, nation.trainingStalledSilverMonth ?? 0);
    const trainingStalledFood = Math.max(0, nation.trainingStalledFoodMonth ?? 0);
    const foodOutput = government.food * (1 + clamp(modifiers['food_output_pct'] ?? 0, -80, 100) / 100);
    const foodPurchased = foodPurchaseSilver / grainPrice * Math.max(0.2, foodOutput);
    const famineResistance = clamp(modifiers['famine_resistance'] ?? 0, 0, 0.8);
    const net = available - armyPaid - foodPurchaseSilver - trainingSilver;
    const expense = corruptionLoss + loyaltyCost + pressureCost + armyPaid + foodPurchaseSilver + trainingSilver;
    nation.food += foodPurchased + foodIncome;
    // 训练费已在每日结算中扣除，这里只把本月累计写入报告，不重复扣款。
    // 国库不足时，付不出的部分计入事件债（非军饷），不允许出现负国库。
    let unfunded = 0;
    let treasuryAfter = cash + available - armyPaid - foodPurchaseSilver;
    if (treasuryAfter < 0) {
      unfunded = -treasuryAfter;
      treasuryAfter = 0;
    }
    nation.treasury = treasuryAfter;
    // 囤银软上限：不再直接烧银，超限部分推高腐败、通胀并压低经济动能。
    const hoardCap = 350000 + provinces.length * 3000;
    const hoardPressure = clamp((nation.treasury - hoardCap) / Math.max(1, hoardCap), 0, 1);
    const hoardLoss = 0;
    nation.trainingSpentSilverMonth = 0;
    nation.trainingSpentFoodMonth = 0;
    nation.trainingStalledSilverMonth = 0;
    nation.trainingStalledFoodMonth = 0;
    if (priorDebt > 0) nation.arrears += priorDebt;
    if (unfunded > 0) nation.arrears += unfunded;
    if (wageShortfall > 0) {
      nation.wageArrears += wageShortfall;
      nation.arrears += wageShortfall;
      nation.inflation = clamp(nation.inflation + Math.min(2, wageShortfall / 150000), 0, 100);
    }

    // 基层被过度汲取：忠诚低于 30 后逐月推高各地民怨。
    const bottomNeglect = Math.max(0, 30 - bottom.loyalty) * 0.02;
    if (bottomNeglect > 0) {
      for (const entry of provinces) {
        entry.state.unrest = clamp(entry.state.unrest + bottomNeglect, 0, 100);
      }
    }

    for (const estate of Object.values(nation.estates)) {
      const share = shares[estate.key] ?? 0;
      foodByEstate[estate.key] = (foodByEstate[estate.key] ?? 0) + foodPurchased * share;
    }

    let repayment = 0;
    if (nation.arrears > 0) {
      // 国库有盈余时优先足额补发欠饷：把国库剩余全部拿去补发，直到欠饷清零。
      // 旧版只还净收入 15%，会陷入「欠账永远还不清」的债务螺旋；改为足额补发后，回血即可真正清账。
      repayment = Math.min(nation.arrears, nation.treasury);
      // 优先补发欠饷，再还其他债务。
      const wageRepaid = Math.min(nation.wageArrears, repayment);
      nation.wageArrears = Math.max(0, nation.wageArrears - wageRepaid);
      nation.arrears = Math.max(0, nation.arrears - repayment);
      nation.treasury = Math.max(0, nation.treasury - repayment);
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
    // 本月是否足额发放军饷：只看军饷缺口，购粮不足不再算作欠饷。
    nation.flags['army_paid_in_full'] = wageShortfall <= 0;
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

    nation.manpower = Math.max(0, nation.manpower
      + weightedPopulation * content.balance.economy.manpowerRegenRate * government.manpower
      + (modifiers['manpower_monthly'] ?? 0));
    const momentumTrend = (nation.stability - 50) / 240
      + (averageLoyalty - 50) / 420
      - nation.warExhaustion / 260
      - (nation.fiscalCrisisDays > 0 ? 0.04 : 0)
      + (nation.treasury > 150000 ? 0.01 : -0.01)
      - hoardPressure * 0.05;
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
      + hoardPressure * 0.6
      + ((rulers?.loyalty ?? 50) < 30 ? 0.12 : 0)
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
    nation.inflation = clamp(
      nation.inflation - 0.04 + (modifiers['inflation_monthly'] ?? 0) + hoardPressure * 0.35,
      0,
      100,
    );

    const arrearsMonths = armyPay > 0 ? nation.arrears / armyPay : 0;
    const paidInFull = wageShortfall <= 0;
    if (paidInFull) {
      // 本月足额发放军饷：军心回升（有历史欠饷正在补发时回升稍快）。
      nation.armyLoyalty = clamp(nation.armyLoyalty + (nation.arrears > 0 ? 0.3 : 0.1), 0, 100);
    } else {
      // 本月未足额发放：军心下降，欠饷越久掉得越快。
      const drop = arrearsMonths > 3 ? 2 : 0.5;
      nation.armyLoyalty = clamp(nation.armyLoyalty - drop, 0, 100);
      if (arrearsMonths > 3 && state.day % 30 === 0) {
        state.log.push({
          day: state.day,
          category: 'military',
          country: nation.tag,
          text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 拖欠军饷 ${arrearsMonths.toFixed(1)} 个月仍未足额发放，军心 ${nation.armyLoyalty.toFixed(0)}`,
          severity: 'danger',
        });
      }
    }

    if (!paidInFull && arrearsMonths > 6 && nation.armyLoyalty < 30) {
      const mutinyRng = rngFor(state.seed, state.day, `mutiny:${nation.tag}`);
      if (mutinyRng.next() < 0.18) {
        const mutinous = Object.values(state.armies).find(army => army.tag === nation.tag);
        if (mutinous) {
          delete state.armies[mutinous.id];
          nation.armyLoyalty = clamp(nation.armyLoyalty + 8, 0, 100);
          state.log.push({
            day: state.day,
            category: 'military',
            country: nation.tag,
            text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 拖欠军饷 ${arrearsMonths.toFixed(1)} 个月，${mutinous.name} 哗变解散`,
            severity: 'danger',
          });
        }
      }
    }

    const report: MonthlyReport = {
      day: state.day,
      income: totalIncome,
      taxIncome: totalTax,
      tradePostIncome,
      sakokuIncome,
      expense: expense + repayment,
      net: net - repayment,
      silverByEstate,
      foodByEstate,
      silverByRegion,
      foodByRegion,
      allocation: { ...shares },
      taxByEstate,
      economicPie: pie / 12,
      unallocated,
      corruptionLoss,
      corruptionByEstate,
      loyaltyCost,
      bottomLoyalty: bottom.loyalty,
      bottomPopShare: bottom.popShare,
      foodPurchaseSilver,
      foodPurchaseTarget,
      foodPurchased,
      expenseArmy: armyPay,
      expenseArmyPaid: armyPaid,
      wageShortfall,
      expenseOfficials: 0,
      expenseDynasty: 0,
      expenseRelief: 0,
      expenseHoard: hoardLoss,
      hoardPressure,
      expenseCourt: pressureCost,
      expenseTraining: trainingSilver,
      foodTraining: trainingFood,
      trainingStalledSilver,
      trainingStalledFood,
      foodIncome: foodPurchased + foodIncome,
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













