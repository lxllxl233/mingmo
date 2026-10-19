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
import { musicForFaction } from '../../app/audio/music';
import { canMarchThrough } from '../../engine/rules/access';

export type PanelKey =
  | 'province'
  | 'country'
  | 'army'
  | 'armyList'
  | 'core'
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
  speed: 0 | 1 | 2 | 4 | 8 | 16 | 32;
  speedBeforeEvent: 0 | 1 | 2 | 4 | 8 | 16 | 32;
  panel: PanelKey | null;
  countryFocus: string | null;
  diplomaticMode: boolean;
  diplomaticAnchor: string | null;
  trainingPicker: 'land' | 'navy' | null;
  trainingRequest: { kind: 'land' | 'navy'; templateId: string } | null;
  selectedProvince: string | null;
  selectedArmy: string | null;
  armyStack: string[] | null;
  selectedBattle: string | null;
  peaceWarId: string | null;
  message: string | null;
  start: (scenarioId: string, tag: string, seed?: number, difficulty?: Difficulty) => void;
  startSpectator: (scenarioId: string, seed?: number, difficulty?: Difficulty) => void;
  command: (command: Command) => boolean;
  tick: () => void;
  setSpeed: (speed: 0 | 1 | 2 | 4 | 8 | 16 | 32) => void;
  selectProvince: (provinceId: string | null) => void;
  selectArmy: (armyId: string | null) => void;
  clearArmySelection: () => void;
  openArmyStack: (armyIds: string[]) => void;
  closeArmyStack: () => void;
  openBattle: (battleId: string) => void;
  closeBattle: () => void;
  openPeace: (warId: string) => void;
  closePeace: () => void;
  openCountry: (tag: string) => void;
  moveArmyTo: (provinceId: string) => boolean;
  moveArmyGroupTo: (provinceId: string) => boolean;
  appendArmyGroupWaypoint: (provinceId: string) => boolean;
  stopArmyGroup: () => boolean;
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
  armyStack: null,
  selectedBattle: null,
  peaceWarId: null,
  message: null,

  start: (scenarioId, tag, seed = 42, difficulty = 'normal') => {
    const game = createInitialState(content, scenarioId, seed, tag, difficulty);
    sound.unlock();
    sound.setMusicPlaylist(musicForFaction(tag, scenarioId));
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
      armyStack: null,
      selectedBattle: null,
      peaceWarId: null,
      message: null,
    });
  },

  startSpectator: (scenarioId, seed = 42, difficulty = 'normal') => {
    const game = createInitialState(content, scenarioId, seed, 'MING', difficulty, true);
    sound.unlock();
    sound.setMusicPlaylist(musicForFaction('MING', scenarioId));
    sound.play('command');
    set({
      game,
      version: 0,
      speed: 1,
      speedBeforeEvent: 0,
      panel: null,
      countryFocus: null,
      diplomaticMode: false,
      diplomaticAnchor: null,
      trainingPicker: null,
      trainingRequest: null,
      selectedProvince: null,
      selectedArmy: null,
      armyStack: null,
      selectedBattle: null,
      peaceWarId: null,
      message: '看海模式：全图视野，所有势力由 AI 推演。',
    });
  },

  command: command => {    const { game } = get();
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
    if (!game.spectator && game.pendingEvents.some(event => event.country === game.playerTag)) {
      set({ speedBeforeEvent: speed, speed: 0 });
      return;
    }
    const alertCount = game.warAlerts.length;
    const offerCount = game.peaceOffers.length;
    advanceDay(game, content);
    const next = { ...game };
    const pendingAfterTick = next.pendingEvents.some(event => event.country === next.playerTag);
    const newWarAlert = next.warAlerts.length > alertCount;
    const newPeaceOffer = next.peaceOffers.length > offerCount;
    if (!next.spectator && (pendingAfterTick || newWarAlert || newPeaceOffer)) {
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
    const selected = get().selectedArmy;
    if (selected && !next.armies[selected]) {
      set({ selectedArmy: null, panel: null, armyStack: null });
    }
  },

  setSpeed: speed => set({ speed, speedBeforeEvent: speed === 0 ? get().speedBeforeEvent : 0 }),
  selectProvince: provinceId => {
    const state = get();
    sound.play('click');
    if (state.selectedArmy) {
      set({
        selectedArmy: null,
        armyStack: null,
        selectedProvince: provinceId,
        countryFocus: null,
        diplomaticMode: false,
        diplomaticAnchor: null,
        panel: provinceId ? 'province' : null,
      });
      return;
    }
    if (state.panel === 'military') {
      set({ selectedProvince: provinceId, armyStack: null });
      return;
    }
    set({ selectedProvince: provinceId, selectedArmy: null, armyStack: null, countryFocus: null, diplomaticMode: false, diplomaticAnchor: null, panel: provinceId ? 'province' : null });
  },
  selectArmy: armyId => {
    if (armyId && Date.now() < suppressArmySelectionUntil) return;
    const { game } = get();
    if (armyId && (!game || (!game.spectator && game.armies[armyId]?.tag !== game.playerTag))) {
      sound.play('error');
      set({ message: '只能选择本国军队' });
      return;
    }
    sound.play('click');
    const selected = armyId ? game?.armies[armyId] : null;
    if (selected) sound.playArmySelect(selected.tag, selected.composition);
    set({
      selectedArmy: armyId,
      armyStack: null,
      panel: armyId ? 'army' : null,
      countryFocus: null,
      diplomaticMode: false,
      diplomaticAnchor: null,
    });
  },
  clearArmySelection: () => {
    const panel = get().panel;
    set({
      selectedArmy: null,
      armyStack: null,
      panel: panel === 'army' || panel === 'armyList' ? null : panel,
    });
  },
  openArmyStack: armyIds => {
    const { game } = get();
    const armies = armyIds
      .map(id => game?.armies[id])
      .filter((army): army is NonNullable<typeof army> => army !== undefined);
    const leader = armies[0];
    if (leader) {
      const composition = armies.reduce((sum, army) => ({
        infantry: sum.infantry + army.composition.infantry,
        firearm: sum.firearm + army.composition.firearm,
        cavalry: sum.cavalry + army.composition.cavalry,
        artillery: sum.artillery + army.composition.artillery,
        naval: sum.naval + army.composition.naval,
      }), { infantry: 0, firearm: 0, cavalry: 0, artillery: 0, naval: 0 });
      sound.playArmySelect(leader.tag, composition);
    }
    set({ armyStack: [...armyIds], selectedArmy: null, panel: 'armyList' });
  },
  closeArmyStack: () => set({ armyStack: null, panel: null }),
  openBattle: battleId => set({ selectedBattle: battleId, armyStack: null }),
  closeBattle: () => set({ selectedBattle: null }),
  openPeace: warId => set({
    peaceWarId: warId,
    speedBeforeEvent: get().speed !== 0 ? get().speed : get().speedBeforeEvent,
    speed: 0,
    panel: null,
    armyStack: null,
    selectedBattle: null,
  }),
  closePeace: () => {
    const { speedBeforeEvent, game } = get();
    const stillPaused = Boolean(game?.pendingEvents.length || game?.warAlerts.length || game?.peaceOffers.length);
    set({
      peaceWarId: null,
      speed: stillPaused ? 0 : speedBeforeEvent,
      speedBeforeEvent: stillPaused ? speedBeforeEvent : 0,
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
    if (!game || game.spectator || !selectedArmy) return false;
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
  moveArmyGroupTo: provinceId => {
    const { game, armyStack, content } = get();
    if (!game || game.spectator || !armyStack || armyStack.length === 0) return false;
    let moved = 0;
    for (const armyId of armyStack) {
      const army = game.armies[armyId];
      if (!army || army.tag !== game.playerTag || army.province === provinceId) continue;
      const path = findPath(content, game, army.province, provinceId, army.tag);
      if (!path || path.length === 0) continue;
      if (get().command({ type: 'army.move', armyId, path })) moved += 1;
    }
    if (moved === 0) {
      sound.play('error');
      set({ message: '选中的军团没有可通行的统一行军路线' });
      return false;
    }
    set({ message: `${moved} 支军团已统一向目标行军` });
    return true;
  },
  appendArmyGroupWaypoint: provinceId => {
    const { game, armyStack, content } = get();
    if (!game || game.spectator || !armyStack || armyStack.length === 0) return false;
    let moved = 0;
    for (const armyId of armyStack) {
      const army = game.armies[armyId];
      if (!army || army.tag !== game.playerTag) continue;
      const from = army.movePath[army.movePath.length - 1] ?? army.province;
      if (from === provinceId) continue;
      const suffix = findPath(content, game, from, provinceId, army.tag);
      if (!suffix || suffix.length === 0) continue;
      const path = [...army.movePath, ...suffix];
      if (get().command({ type: 'army.move', armyId, path })) moved += 1;
    }
    if (moved === 0) {
      sound.play('error');
      set({ message: '选中的军团无法追加这段统一路线' });
      return false;
    }
    set({ message: `已为 ${moved} 支军团追加统一路线（Ctrl+右键继续追加）` });
    return true;
  },
  stopArmyGroup: () => {
    const { game, armyStack } = get();
    if (!game || game.spectator || !armyStack || armyStack.length === 0) return false;
    let stopped = 0;
    for (const armyId of armyStack) {
      const army = game.armies[armyId];
      if (!army || army.tag !== game.playerTag) continue;
      if (army.movePath.length === 0 && !army.embarked && army.stance === 'hold') continue;
      if (get().command({ type: 'army.stop', armyId })) stopped += 1;
    }
    if (stopped === 0) {
      set({ message: '选中的军团没有正在进行的行军' });
      return false;
    }
    set({ message: `${stopped} 支军团已取消移动` });
    return true;
  },
  appendArmyWaypoint: provinceId => {
    const { game, selectedArmy, content } = get();
    if (!game || game.spectator || !selectedArmy) return false;
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
  reset: () => set({ game: null, speed: 0, speedBeforeEvent: 0, panel: null, countryFocus: null, diplomaticMode: false, diplomaticAnchor: null, trainingPicker: null, trainingRequest: null, selectedProvince: null, selectedArmy: null, armyStack: null, selectedBattle: null, peaceWarId: null, message: null }),
}));




