import { create } from 'zustand';
import type { ContentIndex } from '../../content/types';
import { content } from '../../content/browser';
import { createInitialState } from '../../engine/state/initial';
import { advanceDay } from '../../engine/tick';
import { isYearStart } from '../../engine/core/clock';
import { dispatch, type Command } from '../../engine/commands';
import type { GameState } from '../../engine/state/types';
import { loadLocal, saveLocal } from '../../app/save/save';
import { sound } from '../../app/audio/sound';

export type PanelKey =
  | 'province'
  | 'country'
  | 'estates'
  | 'budget'
  | 'focus'
  | 'research'
  | 'military'
  | 'diplomacy'
  | 'decisions'
  | 'log';

function findPath(content: ContentIndex, from: string, to: string): string[] | null {
  if (from === to) return [];
  const queue: Array<{ id: string; path: string[] }> = [{ id: from, path: [] }];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const def = content.provinces.get(current.id);
    if (!def) continue;
    for (const next of def.neighbors) {
      if (seen.has(next)) continue;
      seen.add(next);
      const path = [...current.path, next];
      if (next === to) return path;
      if (path.length < 80) queue.push({ id: next, path });
    }
  }
  return null;
}

interface UiStore {
  content: ContentIndex;
  game: GameState | null;
  version: number;
  speed: 0 | 1 | 2 | 4;
  panel: PanelKey | null;
  countryFocus: string | null;
  selectedProvince: string | null;
  selectedArmy: string | null;
  message: string | null;
  start: (scenarioId: string, tag: string, seed?: number) => void;
  command: (command: Command) => boolean;
  tick: () => void;
  setSpeed: (speed: 0 | 1 | 2 | 4) => void;
  selectProvince: (provinceId: string | null) => void;
  selectArmy: (armyId: string | null) => void;
  openCountry: (tag: string) => void;
  moveArmyTo: (provinceId: string) => boolean;
  openPanel: (panel: PanelKey) => void;
  closePanel: () => void;
  dismissMessage: () => void;
  save: (slot: string) => void;
  load: (slot: string) => void;
  reset: () => void;
}

export const useGameStore = create<UiStore>((set, get) => ({
  content,
  game: null,
  version: 0,
  speed: 0,
  panel: null,
  countryFocus: null,
  selectedProvince: null,
  selectedArmy: null,
  message: null,

  start: (scenarioId, tag, seed = 42) => {
    const game = createInitialState(content, scenarioId, seed, tag);
    sound.play('command');
    set({
      game,
      version: 0,
      speed: 0,
      panel: null,
      countryFocus: null,
      selectedProvince: game.countries[tag]?.capital ?? null,
      selectedArmy: null,
      message: null,
    });
  },

  command: command => {
    const { game } = get();
    if (!game) return false;
    try {
      dispatch(game, command, content);
      const next = { ...game };
      set({ game: next, version: get().version + 1, message: null });
      sound.play('command');
      if (next.pendingEvents.some(event => event.country === next.playerTag) && get().speed !== 0) {
        set({ speed: 0 });
      }
      return true;
    } catch (error) {
      sound.play('error');
      set({ message: error instanceof Error ? error.message : '操作失败' });
      return false;
    }
  },

  tick: () => {
    const { game, speed } = get();
    if (!game || speed === 0 || game.ended) return;
    if (game.pendingEvents.some(event => event.country === game.playerTag)) {
      set({ speed: 0 });
      return;
    }
    advanceDay(game, content);
    const next = { ...game };
    set({ game: next, version: get().version + 1 });
    if (isYearStart(game.day)) {
      try {
        saveLocal('auto', next);
      } catch {
        // 存档失败不应中断模拟；UI 顶栏会显示最近一次消息。
      }
    }
    if (next.ended) set({ speed: 0 });
  },

  setSpeed: speed => set({ speed }),
  selectProvince: provinceId => {
    const state = get();
    sound.play('click');
    if (state.panel === 'military') {
      set({ selectedProvince: provinceId });
      return;
    }
    set({ selectedProvince: provinceId, selectedArmy: null, countryFocus: null, panel: provinceId ? 'province' : null });
  },
  selectArmy: armyId => {
    sound.play('click');
    set({ selectedArmy: armyId, panel: 'military', countryFocus: null });
  },
  openCountry: tag => {
    sound.play('click');
    set({ countryFocus: tag, panel: 'country', selectedArmy: null });
  },
  moveArmyTo: provinceId => {
    const { game, selectedArmy } = get();
    if (!game || !selectedArmy) return false;
    const army = game.armies[selectedArmy];
    if (!army) return false;
    if (army.province === provinceId) {
      set({ message: '军团已在目标省份' });
      return false;
    }
    const path = findPath(content, army.province, provinceId);
    if (!path || path.length === 0) {
      sound.play('error');
      set({ message: '没有可通行的行军路线' });
      return false;
    }
    return get().command({ type: 'army.move', armyId: selectedArmy, path });
  },
  openPanel: panel => set({ panel }),
  closePanel: () => set({ panel: null }),
  dismissMessage: () => set({ message: null }),
  save: slot => {
    const { game } = get();
    if (!game) return;
    try {
      saveLocal(slot, game);
      sound.play('save');
      set({ message: `已保存到 ${slot}` });
    } catch (error) {
      sound.play('error');
      set({ message: error instanceof Error ? error.message : '保存失败' });
    }
  },
  load: slot => {
    try {
      const game = loadLocal(slot);
      sound.play('save');
      set({
        game,
        version: get().version + 1,
        speed: 0,
        panel: null,
        countryFocus: null,
        selectedProvince: game.countries[game.playerTag]?.capital ?? null,
        selectedArmy: null,
        message: `已读取 ${slot}`,
      });
    } catch (error) {
      sound.play('error');
      set({ message: error instanceof Error ? error.message : '读档失败' });
    }
  },
  reset: () => set({ game: null, speed: 0, panel: null, countryFocus: null, selectedProvince: null, selectedArmy: null, message: null }),
}));
