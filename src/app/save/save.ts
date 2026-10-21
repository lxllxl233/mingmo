import type { EstateState, GameState } from '../../engine/state/types';
import { hashState } from '../../engine/state/hash';

export interface SaveFile {
  version: number;
  savedAt: number;
  seed: number;
  day: number;
  state: GameState;
  checksum: string;
}

export const SAVE_VERSION = 7;

const OLD_ESTATE_MAP: Record<string, string> = {
  dynasty: 'ruling',
  nobles: 'ruling',
  officials: 'ruling',
  soldiers: 'ruling',
  gentry: 'landlords',
  clergy: 'landlords',
  scholars: 'landlords',
  merchants: 'merchants',
  peasants: 'peasants',
  natives: 'peasants',
  'custom:natives': 'peasants',
};

const NEW_ESTATE_KEYS = ['ruling', 'merchants', 'landlords', 'artisans', 'peasants'] as const;
type NewEstateKey = (typeof NEW_ESTATE_KEYS)[number];

const NO_ARTISANS = new Set(['MONGOL', 'TIBET', 'NEU']);

const FALLBACK_TAX_LAW: Record<NewEstateKey, string> = {
  ruling: 'tax_officials_thin_salary',
  merchants: 'tax_merchants_inland_customs',
  landlords: 'tax_gentry_exemption',
  artisans: 'tax_artisans_guild',
  peasants: 'tax_peasants_single_whip',
};

const REMOVED_TAX_LAWS: Record<string, string> = {
  tax_nobles_full_stipend: 'tax_nobles_reduced_stipend',
  tax_dynasty_reduced: 'tax_dynasty_stipend',
  tax_dynasty_manor: 'tax_dynasty_stipend',
};

// Laws whose estate changed during the 8→5 class migration.
const MOVED_TAX_LAWS: Record<string, NewEstateKey> = {
  tax_soldiers_weisuo: 'peasants',
  tax_natives_trade: 'merchants',
};

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function mergeEstateGroup(
  estates: Record<string, EstateState>,
  oldKeys: string[],
  newKey: NewEstateKey,
): { state: EstateState; allocation: number } | null {
  const members = oldKeys.map(key => estates[key]).filter((value): value is EstateState => value !== undefined);
  if (members.length === 0) return null;
  const influenceSum = members.reduce((sum, estate) => sum + Math.max(0, estate.influence), 0);
  const weightOf = (estate: EstateState): number =>
    influenceSum > 0 ? Math.max(0, estate.influence) / influenceSum : 1 / members.length;
  const weighted = (pick: (estate: EstateState) => number): number =>
    members.reduce((sum, estate) => sum + pick(estate) * weightOf(estate), 0);
  const dominant = members.reduce((best, estate) => (estate.influence > best.influence ? estate : best), members[0]!);
  let taxLaw = REMOVED_TAX_LAWS[dominant.taxLaw] ?? dominant.taxLaw;
  if (MOVED_TAX_LAWS[taxLaw] !== undefined && MOVED_TAX_LAWS[taxLaw] !== newKey) {
    taxLaw = FALLBACK_TAX_LAW[newKey];
  }
  const reform = members.map(estate => estate.reform).find(value => value !== null) ?? null;
  return {
    state: {
      key: newKey,
      influence: clamp100(influenceSum),
      loyalty: clamp100(weighted(estate => estate.loyalty)),
      income: members.reduce((sum, estate) => sum + estate.income, 0),
      taxLaw,
      privileges: [...new Set(members.flatMap(estate => estate.privileges))],
      reform,
      allocationUnlocked: members.some(estate => estate.allocationUnlocked === true),
      cooldownDays: Math.max(...members.map(estate => estate.cooldownDays)),
      collected: members.reduce((sum, estate) => sum + estate.collected, 0),
      effectiveRate: weighted(estate => estate.effectiveRate),
      customaryRate: weighted(estate => estate.customaryRate),
    },
    allocation: 0,
  };
}

function migrateEstatesV7(state: GameState): void {
  for (const nation of Object.values(state.countries)) {
    const old = nation.estates;
    const groups: Record<string, string[]> = {
      ruling: [],
      merchants: [],
      landlords: [],
      peasants: [],
    };
    for (const key of Object.keys(old)) {
      const target = OLD_ESTATE_MAP[key];
      if (target && groups[target]) groups[target]!.push(key);
    }
    const next: Record<string, EstateState> = {};
    for (const key of NEW_ESTATE_KEYS) {
      if (key === 'artisans') continue;
      const merged = mergeEstateGroup(old, groups[key] ?? [], key);
      if (merged) next[key] = merged.state;
    }
    if (!NO_ARTISANS.has(nation.tag)) {
      next.artisans = {
        key: 'artisans',
        influence: 5,
        loyalty: 45,
        income: 0,
        taxLaw: FALLBACK_TAX_LAW.artisans,
        privileges: ['priv_artisan_guild'],
        reform: null,
        allocationUnlocked: false,
        cooldownDays: 0,
        collected: 0,
        effectiveRate: 0.04,
        customaryRate: 0.04,
      };
    }
    // Preserve any custom estates not covered by the fixed 5-class set.
    for (const [key, estate] of Object.entries(old)) {
      if (!OLD_ESTATE_MAP[key] && !next[key]) next[key] = estate;
    }
    const keys = Object.keys(next);
    const influenceTotal = keys.reduce((sum, key) => sum + next[key]!.influence, 0);
    if (influenceTotal > 100) {
      for (const key of keys) next[key]!.influence = clamp100(next[key]!.influence * 100 / influenceTotal);
    }

    const allocation: Record<string, number> = {};
    for (const key of keys) allocation[key] = 0;
    for (const [oldKey, estateKey] of Object.entries(OLD_ESTATE_MAP)) {
      if (allocation[estateKey] === undefined) continue;
      allocation[estateKey]! += nation.allocation?.[oldKey] ?? 0;
    }
    if (!NO_ARTISANS.has(nation.tag)) {
      allocation.artisans = (allocation.artisans ?? 0) + (nation.allocation?.artisans ?? 0) || 5;
    }
    const allocTotal = Object.values(allocation).reduce((sum, value) => sum + value, 0);
    if (allocTotal > 0) {
      for (const key of Object.keys(allocation)) allocation[key] = allocation[key]! * 100 / allocTotal;
    } else {
      for (const key of Object.keys(allocation)) allocation[key] = 100 / Math.max(1, Object.keys(allocation).length);
    }
    nation.estates = next;
    nation.allocation = allocation;
    nation.lastReport = null;
    nation.monthlyHistory = [];
  }
  for (const army of Object.values(state.armies)) {
    army.sourceEstate = OLD_ESTATE_MAP[army.sourceEstate] ?? army.sourceEstate;
  }
}

export function encodeSave(state: GameState): string {
  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    seed: state.seed,
    day: state.day,
    state,
    checksum: hashState(state),
  };
  return JSON.stringify(payload);
}

export function decodeSave(text: string): GameState {
  let parsed: SaveFile;
  try {
    parsed = JSON.parse(text) as SaveFile;
  } catch {
    throw new Error('存档不是合法 JSON');
  }
  if (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > SAVE_VERSION) {
    throw new Error(`存档版本 ${parsed.version} 与当前版本 ${SAVE_VERSION} 不兼容`);
  }
  const checksum = hashState(parsed.state);
  if (checksum !== parsed.checksum) {
    throw new Error('存档校验失败：文件可能已损坏');
  }
  if (parsed.version <= 2) {
    for (const army of Object.values(parsed.state.armies)) {
      if (!Array.isArray(army.history)) army.history = [];
      if (typeof army.embarked !== 'boolean') army.embarked = false;
      if (army.navalTarget === undefined) army.navalTarget = null;
      if (typeof army.navalProgress !== 'number') army.navalProgress = 0;
    }
  }
  if (parsed.version <= 3) {
    if (!Array.isArray(parsed.state.training)) parsed.state.training = [];
    if (typeof parsed.state.nextTrainingId !== 'number') parsed.state.nextTrainingId = 0;
  }
  if (parsed.state.difficulty !== 'easy' && parsed.state.difficulty !== 'hard') {
    parsed.state.difficulty = 'normal';
  }
  if (typeof parsed.state.spectator !== 'boolean') parsed.state.spectator = false;
  if (typeof parsed.state.mapRevision !== 'number') parsed.state.mapRevision = 0;
  for (const nation of Object.values(parsed.state.countries)) {
    if (typeof nation.fiscalCrisisDays !== 'number') nation.fiscalCrisisDays = 0;
    if (typeof nation.foodCrisisDays !== 'number') nation.foodCrisisDays = 0;
    if (typeof nation.economicMomentum !== 'number') nation.economicMomentum = 0;
    if (!nation.allocation || typeof nation.allocation !== 'object') {
      const keys = Object.keys(nation.estates);
      nation.allocation = {};
      for (const key of keys) nation.allocation[key] = 100 / Math.max(1, keys.length);
    }

    if (typeof nation.foodPurchasePct !== 'number') nation.foodPurchasePct = 30;
    if (!Array.isArray(nation.tradePosts)) nation.tradePosts = [];
    if (!nation.grudges || typeof nation.grudges !== 'object' || Array.isArray(nation.grudges)) nation.grudges = {};
    if (typeof nation.wageArrears !== 'number') nation.wageArrears = 0;
    for (const estate of Object.values(nation.estates)) {
      // v7 之前的存档没有该字段：默认仍受既得利益锁定。
      if (typeof estate.allocationUnlocked !== 'boolean') estate.allocationUnlocked = false;
    }
  }
  if (!Array.isArray(parsed.state.warAlerts)) parsed.state.warAlerts = [];
  if (!Array.isArray(parsed.state.battles)) parsed.state.battles = [];
  if (!Array.isArray(parsed.state.peaceOffers)) parsed.state.peaceOffers = [];
  if (parsed.version <= 4 && !parsed.state.truces) parsed.state.truces = {};
  if (parsed.version <= 5) {
    if (!parsed.state.vassals) parsed.state.vassals = {};
    if (!parsed.state.lastTribute) parsed.state.lastTribute = {};
  }
  if (!parsed.state.alliances) parsed.state.alliances = {};
  if (!parsed.state.militaryAccess) parsed.state.militaryAccess = {};
  for (const army of Object.values(parsed.state.armies)) {
    if (typeof army.templateId !== 'string') army.templateId = '';
    if (typeof army.entrenchment !== 'number') army.entrenchment = 0;
    if (typeof army.forcedMarch !== 'boolean') army.forcedMarch = false;
    if (army.siegeMode === undefined) army.siegeMode = 'siege';
    if (typeof army.encircled !== 'boolean') army.encircled = false;
    if (typeof army.encircledDays !== 'number') army.encircledDays = 0;
    if (army.navalOrigin === undefined) army.navalOrigin = null;
    for (const key of ['infantry', 'firearm', 'cavalry', 'artillery', 'naval'] as const) {
      const value = army.composition[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) army.composition[key] = 0;
    }
    if (typeof army.maxStrength !== 'number' || !Number.isFinite(army.maxStrength)) {
      army.maxStrength = army.composition.infantry + army.composition.firearm
        + army.composition.cavalry + army.composition.artillery + army.composition.naval;
    }
  }
  for (const province of Object.values(parsed.state.provinces)) {
    if (province.occupation === undefined) province.occupation = null;
    if (!Array.isArray(province.buildings)) province.buildings = [];
    if (province.building === undefined) province.building = null;
  }
  for (const war of parsed.state.wars) {
    if (!war.casualties) war.casualties = { [war.attacker]: 0, [war.defender]: 0 };
    if (!war.attrition) war.attrition = { [war.attacker]: 0, [war.defender]: 0 };
  }
  // 旧版按势力汇总伤亡时曾重复计数；将不可能超过现役规模的数量压回合理范围。
  for (const war of parsed.state.wars) {
    for (const tag of [war.attacker, war.defender]) {
      const strength = Object.values(parsed.state.armies)
        .filter(army => army.tag === tag)
        .reduce((sum, army) => sum + (army.maxStrength || 0), 0);
      const cap = Math.max(10000, strength * 6);
      const value = war.casualties[tag] ?? 0;
      if (!Number.isFinite(value)) war.casualties[tag] = 0;
      else if (value > cap) war.casualties[tag] = cap;
    }
  }
  if (parsed.version <= 6) migrateEstatesV7(parsed.state);
  return parsed.state;
}

const KEY_PREFIX = 'jiashen.save.';

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function saveLocal(slot: string, state: GameState): void {
  const store = storage();
  if (!store) throw new Error('当前环境不支持本地存档');
  store.setItem(`${KEY_PREFIX}${slot}`, encodeSave(state));
}

export function loadLocal(slot: string): GameState {
  const store = storage();
  if (!store) throw new Error('当前环境不支持本地存档');
  const text = store.getItem(`${KEY_PREFIX}${slot}`);
  if (!text) throw new Error('没有找到存档');
  return decodeSave(text);
}

export function hasLocal(slot: string): boolean {
  const store = storage();
  return store !== null && store.getItem(`${KEY_PREFIX}${slot}`) !== null;
}


