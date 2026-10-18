import { z } from 'zod';

/**
 * 外层结构用 zod 严格校验；Trigger / Effect 是递归联合，
 * 用 z.unknown() 接住，交给 validate.ts 做键白名单与参数检查。
 * 这样既能在加载期报错，又不必维护两份巨大的 union schema。
 */

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'expected lower_snake id');
const tag = z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/, 'expected country tag');
const isoTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const regionSchema = z.object({
  id: z.string().regex(/^reg_[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  group: z.string().min(1).max(20),
  lon: z.number().min(60).max(160),
  lat: z.number().min(0).max(70),
  landmass: z.string(),
  populationWeight: z.number().min(0),
  development: z.number().min(0).max(100),
  dominantEstate: z.string(),
}).strict();

export const prefectureSchema = z.object({
  id: z.string().regex(/^pref_[a-z0-9_]+$/),
  name: z.string().min(1).max(20),
  regionId: z.string().regex(/^reg_[a-z0-9_]+$/),
}).strict();

export const provinceSchema = z.object({
  id: id,
  name: z.string().min(1).max(20),
  prefectureId: z.string().regex(/^pref_[a-z0-9_]+$/),
  regionId: z.string().regex(/^reg_[a-z0-9_]+$/),
  terrain: z.enum(['plains', 'hills', 'mountains', 'wetland', 'desert', 'steppe', 'jungle', 'urban']),
  isCoastal: z.boolean(),
  isRiver: z.boolean(),
  isFort: z.boolean(),
  fortLevel: z.number().int().min(0).max(10),
  population: z.number().int().min(0),
  landholding: z.number().min(0),
  development: z.number().int().min(0).max(100),
  dominantEstate: z.string(),
  supplyLimit: z.number().int().min(0),
  neighbors: z.array(id).min(1),
}).strict().superRefine((value, ctx) => {
  if (!value.isFort && value.fortLevel > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fortLevel'], message: 'fortLevel > 0 requires isFort' });
  }
  if (new Set(value.neighbors).size !== value.neighbors.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['neighbors'], message: 'duplicate neighbor' });
  }
  if (value.neighbors.includes(value.id)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['neighbors'], message: 'self neighbor' });
  }
});

export const countryStartingSchema = z.object({
  treasury: z.number(),
  food: z.number(),
  manpower: z.number(),
  politicalPower: z.number(),
  stability: z.number().min(0).max(100),
  mandate: z.number().min(0).max(100),
  corruption: z.number().min(0).max(100),
  authority: z.number().min(0).max(100),
  armyLoyalty: z.number().min(0).max(100),
  inflation: z.number().min(0).max(100),
  researchSlots: z.number().int().min(1).max(5),
  currency: z.string().optional(),
}).strict();

export const leaderSchema = z.object({
  name: z.string().min(1).max(24),
  title: z.string().min(1).max(24),
  style: z.enum(['emperor', 'khan', 'shogun', 'king', 'lama', 'director', 'tsar', 'rebel', 'general']),
  trait: z.string().min(1).max(40),
  quote: z.string().max(120).optional(),
  skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hair: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  robe: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict();

export const countrySchema = z.object({
  tag,
  name: z.string().min(1).max(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  capital: id,
  government: z.string(),
  religion: z.string(),
  culture: z.string(),
  playable: z.boolean(),
  aiPersonality: z.enum(['aggressive', 'defensive', 'opportunistic', 'mercantile', 'bureaucratic']),
  factions: z.array(z.string()).default([]),
  uniqueMechanic: z.string(),
  starting: countryStartingSchema,
  leader: leaderSchema.optional(),
  leadersByScenario: z.record(z.string(), leaderSchema).optional(),
}).strict();

export const leaderEntrySchema = leaderSchema.extend({
  tag,
  scenario: z.string().min(1).max(12),
}).strict();

export const estateDefSchema = z.object({
  key: z.string().regex(/^(dynasty|nobles|officials|gentry|merchants|peasants|soldiers|clergy|custom:[a-z0-9_]+)$/),
  name: z.string().min(1).max(12),
  nameByCountry: z.record(z.string(), z.string()).default({}),
  sensitivity: z.number().min(0.5).max(2.5),
  incomeFrom: z.enum(['land', 'trade', 'stipend', 'mixed']),
  defaultPrivileges: z.array(z.string()).default([]),
}).strict();

export const countryEstateSchema = z.object({
  key: z.string(),
  name: z.string().min(1).max(12),
  influence: z.number().min(0).max(100),
  loyalty: z.number().min(0).max(100),
  incomeShare: z.number().min(0).max(1),
  privileges: z.array(z.string()).default([]),
  taxLaw: z.string(),
  custom: z.boolean().optional(),
}).strict();

export const countryEstatesSchema = z.object({
  country: tag,
  estates: z.array(countryEstateSchema).min(4).max(9),
}).strict().superRefine((value, ctx) => {
  const sum = value.estates.reduce((total, estate) => total + estate.incomeShare, 0);
  if (Math.abs(sum - 1) > 0.01) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['estates'], message: `income_share sum ${sum} != 1` });
  }
  if (new Set(value.estates.map(estate => estate.key)).size !== value.estates.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['estates'], message: 'duplicate estate key' });
  }
});

const costSchema = z.object({
  politicalPower: z.number().int().min(1).optional(),
  treasury: z.number().int().min(1).optional(),
  food: z.number().int().min(1).optional(),
}).strict();

export const taxLawSchema = z.object({
  id: z.string().regex(/^tax_[a-z0-9_]+$/),
  country: tag.optional(),
  estate: z.string(),
  name: z.string().min(1).max(20),
  desc: z.string().min(1).max(400),
  rate: z.number().min(0).max(0.30),
  efficiency: z.number().min(0).max(1),
  evasionBase: z.number().min(0).max(0.50),
  silverShare: z.number().min(0).max(1),
  loyaltyDrift: z.number().min(-5).max(5),
  influenceShift: z.number().min(-30).max(30),
  incidence: z.object({ estate: z.string(), factor: z.number().min(0).max(1) }).strict().optional(),
  require: z.unknown().optional(),
  effects: z.array(z.unknown()).optional(),
  aiWeight: z.number().min(0).max(100),
}).strict();

export const privilegeSchema = z.object({
  id: z.string().regex(/^priv_[a-z0-9_]+$/),
  estate: z.string(),
  name: z.string().min(1).max(20),
  desc: z.string().min(1).max(400),
  effects: z.array(z.unknown()).min(1),
  revoke: z.object({ cost: costSchema, effects: z.array(z.unknown()).min(1) }).strict(),
  aiKeep: z.number().min(0).max(100),
}).strict();

export const focusSchema = z.object({
  id: id,
  country: tag,
  branch: z.string().min(1).max(16),
  name: z.string().min(1).max(40),
  desc: z.string().min(1).max(600),
  x: z.number().int().min(-20).max(80),
  y: z.number().int().min(-20).max(80),
  costDays: z.number().int().min(30).max(240),
  prerequisites: z.array(id).default([]),
  prerequisitesAny: z.array(id).default([]),
  mutuallyExclusive: z.array(id).default([]),
  available: z.unknown().optional(),
  completionEffect: z.array(z.unknown()).min(1),
  aiWillDo: z.object({
    base: z.number().min(0).max(100),
    modifier: z.array(z.object({ factor: z.number(), if: z.unknown() }).strict()).optional(),
  }).strict(),
  historicalContext: z.string().max(400).optional(),
  repeatable: z.boolean().optional(),
}).strict();

export const eventOptionSchema = z.object({
  id: id,
  name: z.string().min(1).max(40),
  tooltip: z.string().max(400).optional(),
  trigger: z.unknown().optional(),
  aiChance: z.number().min(0).max(100).optional(),
  effect: z.array(z.unknown()).min(1),
}).strict();

export const eventSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  title: z.string().min(1).max(40),
  desc: z.string().min(1).max(1200),
  historicalContext: z.string().max(400).optional(),
  scope: z.enum(['country', 'province', 'estate']),
  country: z.union([tag, z.literal('any')]).optional(),
  estate: z.string().optional(),
  trigger: z.unknown(),
  mtth: z.number().int().min(1).max(36500).optional(),
  fireOnce: z.boolean().default(true),
  repeatable: z.boolean().optional(),
  cooldownDays: z.number().int().min(0).max(3650).optional(),
  chain: z.string().optional(),
  weight: z.number().min(0).max(1000).optional(),
  options: z.array(eventOptionSchema).min(2).max(4),
  aiChoice: id.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.scope === 'country' && !value.country) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['country'], message: 'scope=country requires country' });
  }
  if (value.scope === 'estate' && !value.estate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['estate'], message: 'scope=estate requires estate' });
  }
  if (new Set(value.options.map(option => option.id)).size !== value.options.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'duplicate option id' });
  }
});

export const eventChainSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  name: z.string().min(1).max(40),
  stages: z.array(z.string()).min(2).max(6),
  onComplete: z.array(z.unknown()).default([]),
}).strict();

export const techSchema = z.object({
  id: id,
  name: z.string().min(1).max(40),
  desc: z.string().min(1).max(800),
  category: z.enum(['military', 'agriculture', 'administration', 'fiscal', 'thought']),
  era: z.number().int().min(1600).max(1700),
  costDays: z.number().int().min(60).max(400),
  prerequisites: z.array(id).default([]),
  requiresAny: z.unknown().optional(),
  effects: z.array(z.unknown()).min(1),
  unlocks: z.object({
    units: z.array(z.string()).default([]),
    buildings: z.array(z.string()).default([]),
    decisions: z.array(z.string()).default([]),
  }).strict().default({ units: [], buildings: [], decisions: [] }),
  aiWeight: z.number().min(0).max(100),
}).strict();

export const decisionSchema = z.object({
  id: id,
  country: tag,
  name: z.string().min(1).max(40),
  desc: z.string().min(1).max(600),
  visible: z.unknown().optional(),
  available: z.unknown().optional(),
  cost: costSchema.default({}),
  cooldownDays: z.number().int().min(0).max(3650),
  effect: z.array(z.unknown()).min(1),
}).strict();

export const armyTemplateSchema = z.object({
  id: id,
  name: z.string().min(1).max(20),
  composition: z.object({
    infantry: z.number().int().min(0),
    firearm: z.number().int().min(0),
    cavalry: z.number().int().min(0),
    artillery: z.number().int().min(0),
    naval: z.number().int().min(0),
  }).strict(),
  sourceEstate: z.string(),
  upkeep: z.number().min(0),
  training: z.number().min(0).max(100),
  equipment: z.number().min(0).max(100),
  movement: z.number().min(1).max(10),
}).strict();

export const generalSchema = z.object({
  id: id,
  name: z.string().min(1).max(20),
  country: tag,
  attack: z.number().min(0).max(10),
  defense: z.number().min(0).max(10),
  maneuver: z.number().min(0).max(10),
  siege: z.number().min(0).max(10),
  loyalty: z.number().min(0).max(100),
  traits: z.array(z.string()).default([]),
}).strict();

export const namedModifierSchema = z.object({
  id: id,
  name: z.string().min(1).max(20),
  modifiers: z.record(z.string(), z.number()),
}).strict();

export const scenarioSchema = z.object({
  id: z.string().min(1).max(20),
  name: z.string().min(1).max(30),
  startDate: isoTimestamp,
  description: z.string().min(1).max(600),
  playerHints: z.array(z.string()).default([]),
  playableTags: z.array(tag).default([]),
  regionOwners: z.record(z.string(), tag),
  provinceOverrides: z.record(z.string(), tag).default({}),
  countryOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  armies: z.array(z.object({
    tag,
    template: id,
    province: id,
    size: z.number().int().min(1).max(20),
  }).strict()).default([]),
  initialWars: z.array(z.object({
    attacker: tag,
    defender: tag,
    goal: z.string().optional(),
  }).strict()).default([]),
  initialEvents: z.array(z.string()).default([]),
}).strict();

export const balanceSchema = z.object({
  economy: z.record(z.string(), z.number()),
  military: z.object({
    baseOrganization: z.number(),
    baseAttack: z.number(),
    baseDefense: z.number(),
    firearmAttack: z.number(),
    cavalryAttack: z.number(),
    artillerySiege: z.number(),
    terrainDefense: z.record(z.string(), z.number()),
    terrainWidth: z.record(z.string(), z.number()),
    movementCost: z.record(z.string(), z.number()),
    supplyRecovery: z.number(),
    supplyDecay: z.number(),
    routOrganization: z.number(),
    routStrengthKeep: z.number(),
  }).strict(),
  politics: z.object({
    lowStabilityThreshold: z.number(),
    lowLoyaltyThreshold: z.number(),
    rebelLoyaltyThreshold: z.number(),
    mandateLossOnCapital: z.number(),
    maxCorruption: z.number(),
  }).strict(),
  ai: z.object({
    aggression: z.number(),
    minArmyRatio: z.number(),
    peaceExhaustion: z.number(),
    recruitTreasuryFloor: z.number(),
  }).strict(),
}).strict();
