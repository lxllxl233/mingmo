import type { GameState } from '../../engine/state/types';
import { hashState } from '../../engine/state/hash';

export interface SaveFile {
  version: number;
  savedAt: number;
  seed: number;
  day: number;
  state: GameState;
  checksum: string;
}

export const SAVE_VERSION = 6;

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
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4 && parsed.version !== 5 && parsed.version !== SAVE_VERSION) {
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


