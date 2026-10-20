import type { ContentIndex } from '../../content/types';
import type { ArmyState, CountryState, GameState } from '../state/types';
import { armyStrength } from '../state/types';
import { touchMap } from '../state/types';

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

/** 债务对战斗力的削弱：欠饷（拖欠军饷）持续时骤降至接近无战力；其他债务最多 -10%。 */
export function debtCombatPenalty(nation: CountryState): number {
  const armyPay = nation.lastReport?.expenseArmy ?? 0;
  const wageMonths = armyPay > 0 ? nation.wageArrears / armyPay : 0;
  const otherDebt = Math.max(0, nation.arrears - nation.wageArrears);
  let penalty = 0;
  if (wageMonths > 0) {
    // 欠饷：拖得越久战力越差，约 5 个月军饷后基本无战斗力（-80%）。
    penalty += Math.min(80, wageMonths * 15);
  }
  if (otherDebt > 0) {
    // 其他债务：轻微削弱，封顶 -10%（约 100 万两其他债务时达到）。
    penalty += Math.min(10, otherDebt / 100000);
  }
  const total = Math.min(90, penalty);
  return total > 0 ? -total : 0;
}

const MING_SOUTH = new Set([
  'reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_fujian',
  'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou',
]);
const MING_NORTHWEST = new Set(['reg_shaanxi', 'reg_shanxi', 'reg_henan', 'reg_hexi']);

function collapseProvinces(state: GameState, content: ContentIndex, nation: CountryState): void {
  const owned = Object.values(state.provinces)
    .filter(province => province.owner === nation.tag || province.controller === nation.tag);
  if (owned.length === 0) return;
  const sming = state.countries['SMING'];
  // 大明若在 1644 年前就崩溃，南方士绅同样会拥立新君；否则 225 个省会整块落入
  // 清廷，造成 1627 剧本里清一日吞并半个中国。崩溃分家按地域处理，与南明建立事件一致。
  const canFoundSming = nation.tag === 'MING'
    && sming !== undefined
    && !sming.alive
    && state.scenarioId !== '1650'
    && (state.spectator || state.playerTag !== 'MING');
  const southern = canFoundSming
    ? owned.filter(province => MING_SOUTH.has(content.provinces.get(province.id)?.regionId ?? ''))
    : [];
  if (sming && southern.length > 0) {
    sming.alive = true;
    sming.treasury = Math.max(sming.treasury, 150000);
    sming.food = Math.max(sming.food, 200000);
    sming.manpower = Math.max(sming.manpower, 40000);
    sming.stability = Math.max(sming.stability, 35);
    const nanjing = state.provinces['nanjing'];
    sming.capital = nanjing && nanjing.owner === 'MING'
      ? 'nanjing'
      : southern[0]!.id;
  }
  for (const province of owned) {
    const def = content.provinces.get(province.id);
    let target = 'NEU';
    if (nation.tag === 'MING') {
      const region = def?.regionId ?? '';
      if (sming?.alive && MING_SOUTH.has(region)) target = 'SMING';
      // 继承者已亡时，西北与四川退回地方势力（NEU），不能整块并入清廷；
      // 否则清在崩溃日白得六十余省，1627 剧本必成滚雪球。
      else if (region === 'reg_sichuan') target = state.countries['XI']?.alive ? 'XI' : 'NEU';
      else if (MING_NORTHWEST.has(region)) target = state.countries['SHUN']?.alive ? 'SHUN' : 'NEU';
      else if (state.countries['QING']?.alive) target = 'QING';
      else if (state.countries['SHUN']?.alive) target = 'SHUN';
      else if (sming?.alive) target = 'SMING';
    } else {
      for (const neighborId of def?.neighbors ?? []) {
        const controller = state.provinces[neighborId]?.controller;
        if (controller && controller !== nation.tag && controller !== 'NEU' && state.countries[controller]?.alive) {
          target = controller;
          break;
        }
      }
    }
    province.owner = target;
    province.controller = target;
    // 南明以大明继承者自居，接收的南方省份必须同时获得核心，否则 coreResourceFactor
    // 只给 5%~30% 产出，南明建国即入不敷出，两年内二次崩溃并把地盘送给清。
    if (target === 'SMING' && !province.cores.includes('SMING')) province.cores.push('SMING');
    province.occupation = null;
    province.building = null;
    delete province.siege;
  }
  touchMap(state);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: nation.tag,
    text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 崩溃后，${owned.length} 个地区被邻国接管`,
    severity: 'danger',
  });
}

function hasNonNeutralNeighbor(state: GameState, content: ContentIndex, nation: CountryState): boolean {
  for (const province of Object.values(state.provinces)) {
    if (province.owner !== nation.tag && province.controller !== nation.tag) continue;
    const def = content.provinces.get(province.id);
    for (const neighborId of def?.neighbors ?? []) {
      const controller = state.provinces[neighborId]?.controller;
      if (controller && controller !== nation.tag && controller !== 'NEU' && state.countries[controller]?.alive) {
        return true;
      }
    }
  }
  return false;
}

export function advanceCrisis(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (nation.tag === 'NEU') continue;
    if (!nation.alive) continue;
    const report = nation.lastReport;
    const armyPay = report?.expenseArmy ?? 0;
    const arrearsMonths = armyPay > 0 ? nation.arrears / armyPay : 0;
    // 本月足额发放军饷（army_paid_in_full）时，即使仍有历史欠饷也不计入财政危机，军队可保持战力。
    const payingInFull = nation.flags['army_paid_in_full'] !== false;
    const insolvent = nation.treasury <= 0 && (nation.arrears > 0 || (report?.net ?? 0) < 0);
    const chronicDebt = nation.arrears > 0 && arrearsMonths > 6;
    const fiscal = !payingInFull && (insolvent || chronicDebt);
    const food = nation.flags['food_shortage'] === true;
    nation.fiscalCrisisDays = fiscal ? Math.min(730, nation.fiscalCrisisDays + 1) : Math.max(0, nation.fiscalCrisisDays - 2);
    nation.foodCrisisDays = food ? Math.min(365, nation.foodCrisisDays + 1) : Math.max(0, nation.foodCrisisDays - 2);

    const armies = Object.values(state.armies).filter(army => army.tag === nation.tag);
    if (nation.fiscalCrisisDays > 0) {
      const pressure = Math.min(2.5, 0.15 + nation.fiscalCrisisDays * 0.012 + arrearsMonths * 0.05);
      for (const army of armies) {
        army.organization = Math.max(0, army.organization - pressure);
        army.supply = Math.max(0, army.supply - pressure * 0.6);
      }
      if (nation.fiscalCrisisDays >= 30) {
        nation.stability = Math.max(0, nation.stability - 0.08);
        nation.armyLoyalty = Math.max(0, nation.armyLoyalty - 0.06);
        for (const army of armies) crisisArmyLoss(state, army, 0.0008);
      }
      if (arrearsMonths > 6) {
        nation.stability = Math.max(0, nation.stability - 0.05);
        nation.armyLoyalty = Math.max(0, nation.armyLoyalty - 0.05);
      }
      if (arrearsMonths > 12) {
        nation.stability = Math.max(0, nation.stability - 0.1);
        nation.armyLoyalty = Math.max(0, nation.armyLoyalty - 0.1);
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

    if (nation.fiscalCrisisDays === 8 || nation.fiscalCrisisDays === 30 || nation.fiscalCrisisDays === 90 || nation.fiscalCrisisDays === 180) {
      state.log.push({
        day: state.day,
        category: 'politics',
        country: nation.tag,
        text: `国库枯竭 ${nation.fiscalCrisisDays} 日：军饷拖欠，军队组织与非战斗减员加剧`,
        severity: 'danger',
      });
    }
    if (nation.foodCrisisDays === 8 || nation.foodCrisisDays === 30 || nation.foodCrisisDays === 90 || nation.foodCrisisDays === 180) {
      state.log.push({
        day: state.day,
        category: 'politics',
        country: nation.tag,
        text: `粮储断绝 ${nation.foodCrisisDays} 日：饥荒蔓延，军队与民心同时崩溃`,
        severity: 'danger',
      });
    }
    if ((nation.fiscalCrisisDays >= 730 || nation.foodCrisisDays >= 365)
      && (nation.tag === 'MING' || hasNonNeutralNeighbor(state, content, nation))) {
      collapseProvinces(state, content, nation);
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
      if (!state.spectator && nation.tag === state.playerTag) {
        state.ended = true;
        state.victory = {
          winner: null,
          reason: nation.fiscalCrisisDays >= 730 ? '国库崩溃' : '粮荒崩溃',
          score: 0,
          breakdown: {},
        };
      }
    }
  }
}

