import type { Modifier } from '../../content/types';

export interface TimedModifier {
  id: string;
  name: string;
  modifiers: Modifier;
  daysLeft: number;
  source: string;
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
  siege?: {
    attacker: string;
    progress: number;
    days: number;
  };
}

export interface EstateState {
  key: string;
  influence: number;
  loyalty: number;
  income: number;
  taxLaw: string;
  privileges: string[];
  reform: { law: string; daysLeft: number; totalDays: number } | null;
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

export interface MonthlyReport {
  day: number;
  income: number;
  expense: number;
  net: number;
  silverByEstate: Record<string, number>;
  foodByEstate: Record<string, number>;
  expenseArmy: number;
  expenseOfficials: number;
  expenseDynasty: number;
  expenseRelief: number;
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
  stability: number;
  mandate: number;
  corruption: number;
  authority: number;
  armyLoyalty: number;
  inflation: number;
  warExhaustion: number;
  fiscalCrisisDays: number;
  foodCrisisDays: number;
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
  ai: AiState;
  monthlyHistory: MonthlyReport[];
  lastReport: MonthlyReport | null;
}

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
  sourceEstate: string;
  general: string | null;
  entrenchment: number;
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
  countries: Record<string, CountryState>;
  provinces: Record<string, ProvinceState>;
  armies: Record<string, ArmyState>;
  training: TrainingItem[];
  wars: WarState[];
  truces: Record<string, number>;
  vassals: Record<string, string>;
  lastTribute: Record<string, number>;
  relations: Record<string, number>;
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

export function armyStrength(army: ArmyState): number {
  const c = army.composition;
  return c.infantry + c.firearm + c.cavalry + c.artillery + c.naval;
}
