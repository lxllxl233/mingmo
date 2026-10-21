import type { EstateKey, Modifier } from '../../content/types';

export interface TimedModifier {
  id: string;
  name: string;
  modifiers: Modifier;
  daysLeft: number;
  source: string;
  /** 添加当天不递减，保证计时修正覆盖完整的 daysLeft 天。旧存档缺省。 */
  addedDay?: number;
}

export interface ProvinceState {
  id: string;
  owner: string;
  controller: string;
  population: number;
  cores: string[];
  claims: string[];
  coreWork?: {
    country: string;
    progress: number;
    totalDays: number;
  } | null;
  occupation?: {
    country: string;
    progress: number;
    days: number;
  } | null;
  unrest: number;
  devastation: number;
  modifiers: TimedModifier[];
  buildings: string[];
  building: {
    id: string;
    by: string;
    daysLeft: number;
    totalDays: number;
  } | null;
  siege?: {
    attacker: string;
    progress: number;
    days: number;
  };
}

export interface EstateState {
  key: EstateKey;
  influence: number;
  loyalty: number;
  income: number;
  taxLaw: string;
  privileges: string[];
  reform: { law: string; daysLeft: number; totalDays: number } | null;
  /** 是否已通过税制改革打破该阶级的分配锁定（影响力越大，可下调幅度越小）。 */
  allocationUnlocked: boolean;
  cooldownDays: number;
  collected: number;
  effectiveRate: number;
  customaryRate: number;
}

export interface ResearchSlot {
  techId: string;
  progress: number;
  slot: number;
}

export interface AiState {
  target: string | null;
  lastWarDay: number;
  focusId: string | null;
  stance: 'expand' | 'defend' | 'economy';
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface WarAlert {
  warId: string;
  attacker: string;
  defender: string;
  goal: string;
  day: number;
}

export interface BattleState {
  id: string;
  provinceId: string;
  attacker: string;
  defender: string;
  startDay: number;
  days: number;
  attackerStrength: number;
  defenderStrength: number;
  attackerOrganization: number;
  defenderOrganization: number;
}

export interface PeaceOffer {
  id: string;
  warId: string;
  proposer: string;
  terms: 'white' | 'status' | 'demand';
  day: number;
}

export interface MonthlyReport {
  day: number;
  income: number;
  /** 各阶级税收入（银），不含贸易站与锁国收入。 */
  taxIncome?: number;
  tradePostIncome?: number;
  sakokuIncome?: number;
  expense: number;
  net: number;
  silverByEstate: Record<string, number>;
  foodByEstate: Record<string, number>;
  silverByRegion?: Record<string, number>;
  foodByRegion?: Record<string, number>;
  allocation?: Record<string, number>;
  taxByEstate?: Record<string, number>;
  economicPie?: number;
  unallocated?: number;
  corruptionLoss?: number;
  corruptionByEstate?: Record<string, number>;
  loyaltyCost?: number;
  /** 基层（农民/小生产者）忠诚与人口占比；维稳成本只由基层承担。 */
  bottomLoyalty?: number;
  bottomPopShare?: number;
  foodPurchaseSilver?: number;
  /** 玩家设定的购粮目标支出；现金不足时实际购粮更少，不形成债务。 */
  foodPurchaseTarget?: number;
  foodPurchased?: number;
  expenseArmy: number;
  /** 本月实际支付的军饷；expenseArmy 为应付军饷。 */
  expenseArmyPaid?: number;
  wageShortfall?: number;
  expenseOfficials: number;
  expenseDynasty: number;
  expenseRelief: number;
  expenseHoard?: number;
  hoardPressure?: number;
  expenseCourt?: number;
  expenseTraining?: number;
  foodTraining?: number;
  /** 当月训练因缺银/缺粮停滞的日次（停滞不形成债务）。 */
  trainingStalledSilver?: number;
  trainingStalledFood?: number;
  foodIncome?: number;
  foodArmy?: number;
  foodCivilian?: number;
  arrears: number;
}

export interface CountryState {
  tag: string;
  alive: boolean;
  capital: string;
  treasury: number;
  food: number;
  manpower: number;
  politicalPower: number;
  arrears: number;
  /** 债务中的「欠饷」部分（拖欠的军饷）；欠饷持续会直接重创军队战斗力并禁止募新兵。 */
  wageArrears: number;
  stability: number;
  mandate: number;
  corruption: number;
  authority: number;
  armyLoyalty: number;
  inflation: number;
  warExhaustion: number;
  economicMomentum: number;
  fiscalCrisisDays: number;
  foodCrisisDays: number;
  allocation: Record<string, number>;
  foodPurchasePct: number;
  estates: Record<string, EstateState>;
  factions: Record<string, number>;
  focus: { id: string; progress: number } | null;
  completedFocuses: string[];
  research: ResearchSlot[];
  researchSlots: number;
  completedTechs: string[];
  unlockedUnits: string[];
  unlockedDecisions: string[];
  flags: Record<string, boolean>;
  modifiers: Modifier;
  timedModifiers: TimedModifier[];
  cooldowns: Record<string, number>;
  tradePosts: string[];
  /** 记仇：被宣战/被背盟后对目标势力累积的怨气（targetTag → 强度），AI 优先报复。 */
  grudges: Record<string, number>;
  ai: AiState;
  monthlyHistory: MonthlyReport[];
  lastReport: MonthlyReport | null;
  /** 本月训练累计支出（每日扣款，月报只做对账，不重复扣）。 */
  trainingSpentSilverMonth?: number;
  trainingSpentFoodMonth?: number;
  trainingStalledSilverMonth?: number;
  trainingStalledFoodMonth?: number;
}

export type SiegeMode = 'siege' | 'assault' | 'bombard' | 'negotiate';

export interface ArmyState {
  id: string;
  tag: string;
  name: string;
  province: string;
  history: string[];
  movePath: string[];
  moveProgress: number;
  templateId: string;
  embarked: boolean;
  navalTarget: string | null;
  navalOrigin: string | null;
  navalProgress: number;
  composition: {
    infantry: number;
    firearm: number;
    cavalry: number;
    artillery: number;
    naval: number;
  };
  maxStrength: number;
  organization: number;
  training: number;
  equipment: number;
  supply: number;
  encircled: boolean;
  encircledDays: number;
  sourceEstate: string;
  general: string | null;
  entrenchment: number;
  forcedMarch: boolean;
  siegeMode?: SiegeMode;
  stance: 'hold' | 'move' | 'siege' | 'battle';
}

export interface WarState {
  id: string;
  attacker: string;
  defender: string;
  startDay: number;
  warGoal: string;
  exhaustion: Record<string, number>;
  casualties: Record<string, number>;
  attrition: Record<string, number>;
}

export interface QueuedEvent {
  eventId: string;
  country: string;
  province?: string;
  dueDay: number;
  attempts?: number;
}

export interface PendingEvent {
  eventId: string;
  country: string;
  province?: string;
  firedDay: number;
}

export interface LogEntry {
  day: number;
  category: 'economy' | 'military' | 'diplomacy' | 'politics' | 'estate' | 'disaster' | 'event' | 'system';
  country?: string;
  text: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface GameStats {
  eventsFired: number;
  battles: number;
  sieges: number;
  provincesCaptured: number;
  taxesRaised: number;
  moneyPrinted: number;
  famines: number;
}

export interface VictoryResult {
  winner: string | null;
  reason: string;
  score: number;
  breakdown: Record<string, number>;
}

export interface TrainingItem {
  id: string;
  tag: string;
  province: string;
  templateId: string;
  size: number;
  daysLeft: number;
  totalDays: number;
  costSilver: number;
  costFood: number;
  paidSilver: number;
  paidFood: number;
}

export interface GameState {
  version: number;
  seed: number;
  day: number;
  playerTag: string;
  scenarioId: string;
  spectator: boolean;
  /** 地图脏标记：owner/controller 变化时自增；渲染层据此决定是否重绘。 */
  mapRevision: number;
  countries: Record<string, CountryState>;
  provinces: Record<string, ProvinceState>;
  armies: Record<string, ArmyState>;
  training: TrainingItem[];
  wars: WarState[];
  battles: BattleState[];
  peaceOffers: PeaceOffer[];
  truces: Record<string, number>;
  vassals: Record<string, string>;
  lastTribute: Record<string, number>;
  relations: Record<string, number>;
  alliances: Record<string, string[]>;
  militaryAccess: Record<string, string[]>;
  eventQueue: QueuedEvent[];
  pendingEvents: PendingEvent[];
  firedEvents: Record<string, number>;
  log: LogEntry[];
  nextArmyId: number;
  nextTrainingId: number;
  nextWarId: number;
  difficulty: Difficulty;
  warAlerts: WarAlert[];
  stats: GameStats;
  ended: boolean;
  victory: VictoryResult | null;
}

export function relationKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function touchMap(state: GameState): void {
  state.mapRevision = (state.mapRevision ?? 0) + 1;
}

export function armyStrength(army: ArmyState): number {
  const c = army.composition;
  return c.infantry + c.firearm + c.cavalry + c.artillery + c.naval;
}



