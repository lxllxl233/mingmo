import type { ContentIndex, TaxLaw } from '../../content/types';
import type { CountryState, GameState, MonthlyReport } from '../state/types';
import { aggregateModifiers } from '../rules/modifiers';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const multiplier = 1 + (modifiers['army_upkeep_pct'] ?? 0) / 100;
  return strength * content.balance.economy.armyUpkeepPerManMonth * Math.max(0.2, multiplier);
}

function estateShare(content: ContentIndex, tag: string, estateKey: string): number {
  return content.countryEstates.get(tag)?.find(estate => estate.key === estateKey)?.incomeShare ?? 0;
}

function lawOf(content: ContentIndex, nation: CountryState, estateKey: string): TaxLaw | undefined {
  const estate = nation.estates[estateKey];
  return estate ? content.taxLaws.get(estate.taxLaw) : undefined;
}

export function runMonthlyEconomy(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const provinces = countryProvinceList(state, content, nation.tag);
    const modifiers = aggregateModifiers(nation, content);
    const taxEfficiency = 1 + (modifiers['tax_efficiency_pct'] ?? 0) / 100;
    const tradeEfficiency = 1 + (modifiers['trade_efficiency_pct'] ?? 0) / 100;
    const officials = nation.estates['officials'];
    const adminCapacity = content.balance.economy.adminCapacityBase + (officials?.influence ?? 0) * 0.6;

    let base = 0;
    for (const entry of provinces) {
      const warDamage = 1 - entry.state.devastation / 200;
      base += (entry.def.landholding * content.balance.economy.landValuePerWan
        + entry.state.population * content.balance.economy.populationValuePerPerson) * Math.max(0.2, warDamage);
    }

    let silverIncome = 0;
    let foodIncome = 0;
    const silverByEstate: Record<string, number> = {};
    const foodByEstate: Record<string, number> = {};

    for (const estate of Object.values(nation.estates)) {
      const law = lawOf(content, nation, estate.key);
      if (!law) continue;
      const share = estateShare(content, nation.tag, estate.key);
      const annualIncome = base * share;
      estate.income = annualIncome;
      const gross = (annualIncome / 12) * law.rate;
      const evasion = clamp(
        law.evasionBase
        + (100 - estate.loyalty) / 400
        + estate.influence / 500
        - adminCapacity / 300,
        0,
        0.8,
      );
      const efficiency = law.estate === 'merchants' ? tradeEfficiency : 1;
      let collected = gross
        * law.efficiency
        * (1 - evasion)
        * (1 - nation.corruption / 300)
        * taxEfficiency
        * efficiency;
      if (estate.loyalty < 30) collected *= 0.5 + estate.loyalty / 60;
      if (estate.reform) collected *= 0.8;
      collected = Math.max(0, collected);
      estate.collected = collected;
      const silver = collected * law.silverShare;
      const food = (collected * (1 - law.silverShare)) / content.balance.economy.grainPrice;
      silverIncome += silver;
      foodIncome += food;
      silverByEstate[estate.key] = silver;
      foodByEstate[estate.key] = food;
    }

    const armyPay = monthlyArmyPay(state, content, nation.tag);
    const armyFood = armyStrengthOf(state, nation.tag) * content.balance.economy.armyFoodPerManMonth;
    const officialsPay = provinces.length * content.balance.economy.officialSalaryPerProvinceMonth;
    const dynastyEstate = nation.estates['dynasty'];
    const dynasty = dynastyEstate ? (dynastyEstate.income / 12) * 0.22 : 0;
    const expense = armyPay + officialsPay + dynasty;
    const net = silverIncome - expense;
    nation.treasury += net;

    if (nation.treasury < 0) {
      const shortfall = -nation.treasury;
      nation.treasury = 0;
      nation.arrears += shortfall;
      nation.inflation = clamp(nation.inflation + Math.min(2, shortfall / 150000), 0, 100);
    } else {
      const repayment = Math.min(nation.arrears, Math.max(0, net) * 0.15);
      nation.arrears = Math.max(0, nation.arrears - repayment);
    }

    nation.food += foodIncome;
    const population = provinces.reduce((sum, entry) => sum + entry.state.population, 0);
    const civilianFood = population * content.balance.economy.foodPerPersonMonth;
    const foodNeed = civilianFood + armyFood;
    let foodShortage = false;
    if (nation.food < foodNeed) {
      nation.food = 0;
      foodShortage = true;
      nation.stability = clamp(nation.stability - 0.8, 0, 100);
    } else {
      nation.food -= foodNeed;
    }
    nation.flags['food_shortage'] = foodShortage;

    nation.manpower += population * content.balance.economy.manpowerRegenRate;

    for (const estate of Object.values(nation.estates)) {
      const law = lawOf(content, nation, estate.key);
      if (!law) continue;
      const sensitivity = content.estateDefs.get(estate.key)?.sensitivity ?? 1;
      const pressure = (estate.customaryRate - law.rate) * sensitivity * 4;
      estate.loyalty = clamp(estate.loyalty + pressure + law.loyaltyDrift * 0.3, 0, 100);
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
    nation.stability = clamp(
      nation.stability
      + content.balance.economy.stabilityDrift
      + (modifiers['stability_monthly'] ?? 0)
      + (nation.treasury > 0 ? 0.03 : -0.12)
      + (foodShortage ? -0.2 : 0.01)
      - nation.warExhaustion / 800,
      0,
      100,
    );
    nation.mandate = clamp(
      nation.mandate + (nation.stability - 50) / 500 + (modifiers['mandate_monthly'] ?? 0),
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
      income: silverIncome,
      expense,
      net,
      silverByEstate,
      foodByEstate,
      expenseArmy: armyPay,
      expenseOfficials: officialsPay,
      expenseDynasty: dynasty,
      expenseRelief: 0,
      foodIncome,
      foodArmy: armyFood,
      foodCivilian: civilianFood,
      arrears: nation.arrears,
    };
    nation.lastReport = report;
    nation.monthlyHistory.push(report);
    if (nation.monthlyHistory.length > 24) nation.monthlyHistory.shift();
    state.stats.taxesRaised += silverIncome;

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
