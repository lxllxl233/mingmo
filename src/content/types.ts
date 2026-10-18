/** 内容层与引擎共享的纯类型。所有字段名用 camelCase；YAML 由 loader 映射。 */

export type CountryTag = string;
export type ProvinceId = string;
export type PrefectureId = string;
export type RegionId = string;
export type FocusId = string;
export type EventId = string;
export type TechId = string;
export type DecisionId = string;
export type TaxLawId = string;
export type PrivilegeId = string;
export type EstateKey = string;
export type ArmyTemplateId = string;
export type GeneralId = string;
export type NamedModifierId = string;

export type Terrain =
  | 'plains' | 'hills' | 'mountains' | 'wetland'
  | 'desert' | 'steppe' | 'jungle' | 'urban';

export interface NumCmp {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  eq?: number;
}

export type Trigger =
  | { all: Trigger[] }
  | { any: Trigger[] }
  | { not: Trigger }
  | { date: { after?: string; before?: string } }
  | { owns: ProvinceId }
  | { controls: ProvinceId }
  | { atWarWith: CountryTag }
  | { hasFlag: string }
  | { notHasFlag: string }
  | { treasury: NumCmp }
  | { stability: NumCmp }
  | { mandate: NumCmp }
  | { authority: NumCmp }
  | { corruption: NumCmp }
  | { armySize: NumCmp }
  | { provinceCount: NumCmp }
  | { factionInfluence: Record<string, NumCmp> }
  | { relation: { target: CountryTag } & NumCmp }
  | { year: NumCmp }
  | { hasTech: TechId }
  | { hasAdvisor: string }
  | { controlsCapital: boolean }
  | { isAtWar: boolean }
  | { estateLoyalty: Record<EstateKey, NumCmp> }
  | { estateInfluence: Record<EstateKey, NumCmp> }
  | { taxLaw: { estate: EstateKey; is: TaxLawId } }
  | { hasPrivilege: PrivilegeId };

export type Modifier = Record<string, number>;

export type Effect =
  | { addStability: number }
  | { addMandate: number }
  | { addCorruption: number }
  | { addAuthority: number }
  | { addPoliticalPower: number }
  | { addTreasury: number }
  | { addFood: number }
  | { addManpower: number }
  | { addArmyLoyalty: number }
  | { addInflation: number }
  | { addFactionInfluence: Record<string, number> }
  | { addEstateLoyalty: { estate: EstateKey; value: number } }
  | { addEstateInfluence: { estate: EstateKey; value: number } }
  | { setTaxLaw: { estate: EstateKey; law: TaxLawId } }
  | { grantPrivilege: { estate: EstateKey; privilege: PrivilegeId } }
  | { revokePrivilege: { estate: EstateKey; privilege: PrivilegeId } }
  | { setFlag: string }
  | { clearFlag: string }
  | { addModifier: Modifier }
  | { addCountryModifier: { modifier: NamedModifierId; days: number } }
  | { addProvinceModifier: { province: ProvinceId; modifier: NamedModifierId; days: number } }
  | { changeCapital: ProvinceId }
  | { unlockUnit: string }
  | { unlockDecision: DecisionId }
  | { addTech: TechId }
  | { addCore: ProvinceId }
  | { addClaim: ProvinceId }
  | { addRelation: { target: CountryTag; value: number } }
  | { declareWar: { target: CountryTag; cb: string } }
  | { spawnArmy: { province: ProvinceId; template: ArmyTemplateId; size: number } }
  | { changeOwner: { province: ProvinceId; to: CountryTag } }
  | { triggerEvent: { id: EventId; delayDays: number } }
  | { if: { trigger: Trigger; then: Effect[]; else?: Effect[] } }
  | { randomList: Array<{ weight: number; effect: Effect[] }> };

export interface AiWeight {
  base: number;
  modifier?: Array<{ factor: number; if: Trigger }>;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  group: string;
  lon: number;
  lat: number;
  landmass: string;
  populationWeight: number;
  development: number;
  dominantEstate: EstateKey;
}

export interface PrefectureDef {
  id: PrefectureId;
  name: string;
  regionId: RegionId;
}

export interface ProvinceDef {
  id: ProvinceId;
  name: string;
  prefectureId: PrefectureId;
  regionId: RegionId;
  terrain: Terrain;
  isCoastal: boolean;
  isRiver: boolean;
  isFort: boolean;
  fortLevel: number;
  population: number;
  landholding: number;
  development: number;
  dominantEstate: EstateKey;
  supplyLimit: number;
  neighbors: ProvinceId[];
}

export interface CountryStarting {
  treasury: number;
  food: number;
  manpower: number;
  politicalPower: number;
  stability: number;
  mandate: number;
  corruption: number;
  authority: number;
  armyLoyalty: number;
  inflation: number;
  researchSlots: number;
  currency?: string;
}

export interface LeaderDef {
  name: string;
  title: string;
  style: 'emperor' | 'khan' | 'shogun' | 'king' | 'lama' | 'director' | 'tsar' | 'rebel' | 'general';
  trait: string;
  quote?: string;
  skin: string;
  hair: string;
  robe: string;
  accent: string;
}

export interface LeaderEntry extends LeaderDef {
  tag: CountryTag;
  scenario: string;
}

export interface CountryDef {
  tag: CountryTag;
  name: string;
  color: string;
  capital: ProvinceId;
  government: string;
  religion: string;
  culture: string;
  playable: boolean;
  aiPersonality: 'aggressive' | 'defensive' | 'opportunistic' | 'mercantile' | 'bureaucratic';
  factions: string[];
  uniqueMechanic: string;
  starting: CountryStarting;
  leader?: LeaderDef;
  leadersByScenario?: Record<string, LeaderDef>;
}

export interface EstateDef {
  key: EstateKey;
  name: string;
  nameByCountry: Record<string, string>;
  sensitivity: number;
  incomeFrom: 'land' | 'trade' | 'stipend' | 'mixed';
  defaultPrivileges: PrivilegeId[];
}

export interface CountryEstateConfig {
  key: EstateKey;
  name: string;
  influence: number;
  loyalty: number;
  incomeShare: number;
  privileges: PrivilegeId[];
  taxLaw: TaxLawId;
  custom?: boolean;
}

export interface TaxLaw {
  id: TaxLawId;
  country?: CountryTag;
  estate: EstateKey;
  name: string;
  desc: string;
  rate: number;
  efficiency: number;
  evasionBase: number;
  silverShare: number;
  loyaltyDrift: number;
  influenceShift: number;
  incidence?: { estate: EstateKey; factor: number };
  require?: Trigger;
  effects?: Effect[];
  aiWeight: number;
}

export interface Privilege {
  id: PrivilegeId;
  estate: EstateKey;
  name: string;
  desc: string;
  effects: Effect[];
  revoke: {
    cost: { politicalPower?: number; treasury?: number };
    effects: Effect[];
  };
  aiKeep: number;
}

export interface Focus {
  id: FocusId;
  country: CountryTag;
  branch: string;
  name: string;
  desc: string;
  x: number;
  y: number;
  costDays: number;
  prerequisites: FocusId[];
  prerequisitesAny: FocusId[];
  mutuallyExclusive: FocusId[];
  available?: Trigger;
  completionEffect: Effect[];
  aiWillDo: AiWeight;
  historicalContext?: string;
  repeatable?: boolean;
}

export type FocusKind = 'court' | 'economy' | 'military' | 'diplomacy' | 'reform' | 'navy' | 'unique';

export interface FocusPackFocus {
  id: FocusId;
  name: string;
  tier: number;
  desc?: string;
}

export interface FocusPackBranch {
  name: string;
  kind: FocusKind;
  desc: string;
  modifier?: Modifier;
  focuses: FocusPackFocus[];
}

export interface FocusPack {
  country: CountryTag;
  branches: FocusPackBranch[];
  exclusions?: string[][];
}

export interface EventOption {
  id: string;
  name: string;
  tooltip?: string;
  trigger?: Trigger;
  aiChance?: number;
  effect: Effect[];
}

export interface EventDef {
  id: EventId;
  title: string;
  desc: string;
  historicalContext?: string;
  scope: 'country' | 'province' | 'estate';
  country?: CountryTag | 'any';
  estate?: EstateKey;
  trigger: Trigger;
  mtth?: number;
  fireOnce: boolean;
  repeatable?: boolean;
  cooldownDays?: number;
  chain?: string;
  weight?: number;
  options: EventOption[];
  aiChoice?: string;
}

export interface EventChain {
  id: string;
  name: string;
  stages: EventId[];
  onComplete: Effect[];
}

export interface Tech {
  id: TechId;
  name: string;
  desc: string;
  category: 'military' | 'agriculture' | 'administration' | 'fiscal' | 'thought';
  era: number;
  costDays: number;
  prerequisites: TechId[];
  requiresAny?: Trigger;
  effects: Effect[];
  unlocks: { units?: string[]; buildings?: string[]; decisions?: string[] };
  aiWeight: number;
}

export interface Decision {
  id: DecisionId;
  country: CountryTag;
  name: string;
  desc: string;
  visible?: Trigger;
  available?: Trigger;
  cost: { treasury?: number; politicalPower?: number; food?: number };
  cooldownDays: number;
  effect: Effect[];
}

export interface ArmyTemplate {
  id: ArmyTemplateId;
  name: string;
  composition: { infantry: number; firearm: number; cavalry: number; artillery: number; naval: number };
  sourceEstate: EstateKey;
  upkeep: number;
  training: number;
  equipment: number;
  movement: number;
}

export interface General {
  id: GeneralId;
  name: string;
  country: CountryTag;
  attack: number;
  defense: number;
  maneuver: number;
  siege: number;
  loyalty: number;
  traits: string[];
}

export interface NamedModifier {
  id: NamedModifierId;
  name: string;
  modifiers: Modifier;
}

export interface ScenarioDef {
  id: string;
  name: string;
  startDate: string;
  description: string;
  playerHints: string[];
  playableTags: CountryTag[];
  regionOwners: Record<RegionId, CountryTag>;
  provinceOverrides: Record<ProvinceId, CountryTag>;
  countryOverrides: Record<CountryTag, Partial<CountryStarting>>;
  armies: Array<{ tag: CountryTag; template: ArmyTemplateId; province: ProvinceId; size: number }>;
  initialWars: Array<{ attacker: CountryTag; defender: CountryTag; goal?: string }>;
  initialEvents: EventId[];
}

export interface Balance {
  economy: {
    landValuePerWan: number;
    populationValuePerPerson: number;
    grainPrice: number;
    adminCapacityBase: number;
    armyUpkeepPerManMonth: number;
    officialSalaryPerProvinceMonth: number;
    dynastyStipendBaseMonth: number;
    disasterReliefCost: number;
    foodPerPersonMonth: number;
    manpowerRegenRate: number;
    customaryTaxRate: number;
    corruptionDrift: number;
    stabilityDrift: number;
    unrestDecay: number;
    unrestFromTax: number;
    rebelUnrestThreshold: number;
  };
  military: {
    baseOrganization: number;
    baseAttack: number;
    baseDefense: number;
    firearmAttack: number;
    cavalryAttack: number;
    artillerySiege: number;
    terrainDefense: Record<Terrain, number>;
    terrainWidth: Record<Terrain, number>;
    movementCost: Record<Terrain, number>;
    supplyRecovery: number;
    supplyDecay: number;
    routOrganization: number;
    routStrengthKeep: number;
  };
  politics: {
    lowStabilityThreshold: number;
    lowLoyaltyThreshold: number;
    rebelLoyaltyThreshold: number;
    mandateLossOnCapital: number;
    maxCorruption: number;
  };
  ai: {
    aggression: number;
    minArmyRatio: number;
    peaceExhaustion: number;
    recruitTreasuryFloor: number;
  };
}

export interface MapGeo {
  version: number;
  bounds: [number, number, number, number];
  provinces: Record<ProvinceId, Array<[number, number]>>;
  land: Array<Array<[number, number]>>;
  otherRegions: Array<{ name: string; points: Array<[number, number]> }>;
  seaLabels: Array<{ name: string; lon: number; lat: number }>;
}

export interface ContentIndex {
  regions: ReadonlyMap<RegionId, RegionDef>;
  prefectures: ReadonlyMap<PrefectureId, PrefectureDef>;
  provinces: ReadonlyMap<ProvinceId, ProvinceDef>;
  countries: ReadonlyMap<CountryTag, CountryDef>;
  estateDefs: ReadonlyMap<EstateKey, EstateDef>;
  countryEstates: ReadonlyMap<CountryTag, CountryEstateConfig[]>;
  taxLaws: ReadonlyMap<TaxLawId, TaxLaw>;
  privileges: ReadonlyMap<PrivilegeId, Privilege>;
  focuses: ReadonlyMap<FocusId, Focus>;
  events: ReadonlyMap<EventId, EventDef>;
  eventChains: ReadonlyMap<string, EventChain>;
  techs: ReadonlyMap<TechId, Tech>;
  decisions: ReadonlyMap<DecisionId, Decision>;
  armyTemplates: ReadonlyMap<ArmyTemplateId, ArmyTemplate>;
  generals: ReadonlyMap<GeneralId, General>;
  namedModifiers: ReadonlyMap<NamedModifierId, NamedModifier>;
  scenarios: ReadonlyMap<string, ScenarioDef>;
  balance: Balance;
  geo: MapGeo;
  focusesByCountry: ReadonlyMap<CountryTag, Focus[]>;
  techsByCategory: ReadonlyMap<Tech['category'], Tech[]>;
  eventsByCountry: ReadonlyMap<CountryTag, EventDef[]>;
  provincesByPrefecture: ReadonlyMap<PrefectureId, ProvinceDef[]>;
  provincesByRegion: ReadonlyMap<RegionId, ProvinceDef[]>;
  taxLawsByEstate: ReadonlyMap<EstateKey, TaxLaw[]>;
}
