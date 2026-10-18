import { create } from 'zustand';
import type { ContentIndex } from '../../content/types';
import { content } from '../../content/browser';
import { createInitialState } from '../../engine/state/initial';
import { advanceDay } from '../../engine/tick';
import { isYearStart } from '../../engine/core/clock';
import { dispatch, type Command } from '../../engine/commands';
import type { Difficulty, GameState } from '../../engine/state/types';
import { loadLocal, saveLocal } from '../../app/save/save';
import { sound } from '../../app/audio/sound';
import { canMarchThrough } from '../../engine/rules/access';

export type PanelKey =
  | 'province'
  | 'country'
  | 'army'
  | 'estates'
  | 'budget'
  | 'focus'
  | 'research'
  | 'military'
  | 'diplomacy'
  | 'decisions'
  | 'log';

let suppressArmySelectionUntil = 0;

function findPath(content: ContentIndex, state: GameState, from: string, to: string, tag: string): string[] | null {
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
      if (!canMarchThrough(state, tag, next)) continue;
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
  speedBeforeEvent: 0 | 1 | 2 | 4;
  panel: PanelKey | null;
  countryFocus: string | null;
  diplomaticMode: boolean;
  diplomaticAnchor: string | null;
  trainingPicker: 'land' | 'navy' | null;
  trainingRequest: { kind: 'land' | 'navy'; templateId: string } | null;
  selectedProvince: string | null;
  selectedArmy: string | null;
  message: string | null;
  start: (scenarioId: string, tag: string, seed?: number, difficulty?: Difficulty) => void;
  command: (command: Command) => boolean;
  tick: () => void;
  setSpeed: (speed: 0 | 1 | 2 | 4) => void;
  selectProvince: (provinceId: string | null) => void;
  selectArmy: (armyId: string | null) => void;
  openCountry: (tag: string) => void;
  moveArmyTo: (provinceId: string) => boolean;
  appendArmyWaypoint: (provinceId: string) => boolean;
  openTrainingPicker: (kind: 'land' | 'navy') => void;
  chooseTrainingTemplate: (templateId: string) => void;
  closeTrainingPicker: () => void;
  cancelTrainingRequest: () => void;
  deployTraining: (provinceId: string) => boolean;
  openPanel: (panel: PanelKey) => void;
  closePanel: () => void;
  dismissMessage: () => void;
  acknowledgeWarAlert: () => void;
  save: (slot: string) => void;
  load: (slot: string) => void;
  reset: () => void;
}

export const useGameStore = create<UiStore>((set, get) => ({
  content,
  game: null,
  version: 0,
  speed: 0,
  speedBeforeEvent: 0,
  panel: null,
  countryFocus: null,
  diplomaticMode: false,
  diplomaticAnchor: null,
  trainingPicker: null,
  trainingRequest: null,
  selectedProvince: null,
  selectedArmy: null,
  message: null,

  start: (scenarioId, tag, seed = 42, difficulty = 'normal') => {
    const game = createInitialState(content, scenarioId, seed, tag, difficulty);
    sound.play('command');
    set({
      game,
      version: 0,
      speed: 0,
      speedBeforeEvent: 0,
      panel: null,
      countryFocus: null,
      diplomaticMode: false,
      diplomaticAnchor: null,
      trainingPicker: null,
      trainingRequest: null,
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
      const pending = next.pendingEvents.some(event => event.country === next.playerTag);
      if (pending && get().speed !== 0) {
        set({ speedBeforeEvent: get().speed, speed: 0 });
      } else if (!pending && get().speed === 0 && get().speedBeforeEvent !== 0 && !next.ended) {
        set({ speed: get().speedBeforeEvent, speedBeforeEvent: 0 });
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
      set({ speedBeforeEvent: speed, speed: 0 });
      return;
    }
    const alertCount = game.warAlerts.length;
    advanceDay(game, content);
    const next = { ...game };
    const pendingAfterTick = next.pendingEvents.some(event => event.country === next.playerTag);
    const newWarAlert = next.warAlerts.length > alertCount;
    if (pendingAfterTick || newWarAlert) {
      set({ game: next, version: get().version + 1, speedBeforeEvent: speed, speed: 0 });
    } else {
      set({ game: next, version: get().version + 1 });
    }
    if (isYearStart(game.day)) {
      try {
        saveLocal('auto', next);
      } catch {
        // 存档失败不应中断模拟；UI 顶栏会显示最近一次消息。
      }
    }
    if (next.ended) set({ speed: 0 });
  },

  setSpeed: speed => set({ speed, speedBeforeEvent: speed === 0 ? get().speedBeforeEvent : 0 }),
  selectProvince: provinceId => {
    const state = get();
    sound.play('click');
    if (state.selectedArmy) {
      set({
        selectedArmy: null,
        selectedProvince: provinceId,
        countryFocus: null,
        diplomaticMode: false,
        diplomaticAnchor: null,
        panel: provinceId ? 'province' : null,
      });
      return;
    }
    if (state.panel === 'military') {
      set({ selectedProvince: provinceId });
      return;
    }
    set({ selectedProvince: provinceId, selectedArmy: null, countryFocus: null, diplomaticMode: false, diplomaticAnchor: null, panel: provinceId ? 'province' : null });
  },
  selectArmy: armyId => {
    if (armyId && Date.now() < suppressArmySelectionUntil) return;
    const { game } = get();
    if (armyId && (!game || game.armies[armyId]?.tag !== game.playerTag)) {
      sound.play('error');
      set({ message: '只能选择本国军队' });
      return;
    }
    sound.play('click');
    const selected = armyId ? game?.armies[armyId] : null;
    if (selected) sound.playArmySelect(selected.tag, selected.composition);
    set({
      selectedArmy: armyId,
      panel: armyId ? 'army' : null,
      countryFocus: null,
      diplomaticMode: false,
      diplomaticAnchor: null,
    });
  },
  openCountry: tag => {
    sound.play('click');
    set({
      countryFocus: tag,
      diplomaticMode: true,
      diplomaticAnchor: tag,
      panel: 'country',
      selectedArmy: null,
    });
  },
  moveArmyTo: provinceId => {
    const { game, selectedArmy } = get();
    if (!game || !selectedArmy) return false;
    const army = game.armies[selectedArmy];
    if (!army || army.tag !== game.playerTag) return false;
    if (army.province === provinceId) {
      set({ message: '军团已在目标省份' });
      return false;
    }
    const path = findPath(content, game, army.province, provinceId, army.tag);
    if (!path || path.length === 0) {
      sound.play('error');
      set({ message: '没有可通行的行军路线' });
      return false;
    }
    return get().command({ type: 'army.move', armyId: selectedArmy, path });
  },
  appendArmyWaypoint: provinceId => {
    const { game, selectedArmy, content } = get();
    if (!game || !selectedArmy) return false;
    const army = game.armies[selectedArmy];
    if (!army || army.tag !== game.playerTag) return false;
    const from = army.movePath[army.movePath.length - 1] ?? army.province;
    if (from === provinceId) return false;
    const suffix = findPath(content, game, from, provinceId, army.tag);
    if (!suffix || suffix.length === 0) {
      sound.play('error');
      set({ message: '无法追加这段行军路线：需要本国或交战地区' });
      return false;
    }
    const path = [...army.movePath, ...suffix];
    const ok = get().command({ type: 'army.move', armyId: selectedArmy, path });
    if (ok) set({ message: '已追加行军路线（Ctrl+右键继续追加）' });
    return ok;
  },
  openTrainingPicker: kind => {
    sound.play('click');
    set({ trainingPicker: kind, trainingRequest: null, panel: 'military', diplomaticMode: false, diplomaticAnchor: null });
  },
  chooseTrainingTemplate: templateId => {
    const kind = get().trainingPicker;
    if (!kind) return;
    set({
      trainingPicker: null,
      trainingRequest: { kind, templateId },
      message: '请在地图上选择部署省份：陆军选我方省份，水军选我方港口。',
      panel: null,
    });
  },
  closeTrainingPicker: () => set({ trainingPicker: null }),
  cancelTrainingRequest: () => set({ trainingRequest: null, message: null }),
  deployTraining: provinceId => {
    const { trainingRequest, game } = get();
    if (!game || !trainingRequest) return false;
    const template = content.armyTemplates.get(trainingRequest.templateId);
    const province = content.provinces.get(provinceId);
    const provinceState = game.provinces[provinceId];
    if (!template || !province || !provinceState) return false;
    if (provinceState.controller !== game.playerTag) {
      set({ message: '只能部署到本国控制的省份' });
      return false;
    }
    if (trainingRequest.kind === 'navy' && !province.isPort) {
      set({ message: '水军只能部署到我方港口' });
      sound.play('error');
      return false;
    }
    const ok = get().command({ type: 'army.recruit', province: provinceId, template: trainingRequest.templateId, size: 2 });
    if (ok) {
      suppressArmySelectionUntil = Date.now() + 700;
      set({ trainingRequest: null, panel: 'military', message: '已加入训练队列，完成后在此省份成军。' });
    }
    return ok;
  },
  openPanel: panel => set({ panel, diplomaticMode: false, diplomaticAnchor: null }),
  closePanel: () => set({ panel: null, diplomaticMode: false, diplomaticAnchor: null }),
  dismissMessage: () => set({ message: null }),
  acknowledgeWarAlert: () => {
    const { game, speedBeforeEvent } = get();
    if (!game || game.warAlerts.length === 0) return;
    const next = { ...game, warAlerts: game.warAlerts.slice(1) };
    const stillPaused = next.warAlerts.length > 0
      || next.pendingEvents.some(event => event.country === next.playerTag);
    set({
      game: next,
      version: get().version + 1,
      speed: stillPaused ? 0 : speedBeforeEvent,
      speedBeforeEvent: stillPaused ? speedBeforeEvent : 0,
      message: null,
    });
  },
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
        speedBeforeEvent: 0,
        panel: null,
        countryFocus: null,
        diplomaticMode: false,
        diplomaticAnchor: null,
        trainingPicker: null,
        trainingRequest: null,
        selectedProvince: game.countries[game.playerTag]?.capital ?? null,
        selectedArmy: null,
        message: `已读取 ${slot}`,
      });
    } catch (error) {
      sound.play('error');
      set({ message: error instanceof Error ? error.message : '读档失败' });
    }
  },
  reset: () => set({ game: null, speed: 0, speedBeforeEvent: 0, panel: null, countryFocus: null, diplomaticMode: false, diplomaticAnchor: null, trainingPicker: null, trainingRequest: null, selectedProvince: null, selectedArmy: null, message: null }),
}));
