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

export const SAVE_VERSION = 4;

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
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== SAVE_VERSION) {
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
