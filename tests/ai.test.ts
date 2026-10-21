import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { canStartScriptedWar, historicalWarTarget, manageableWarTarget } from '../src/engine/systems/ai';

const content = loadContentFromDirectory();

describe('historical war targeting', () => {
  it('keeps distant or hopeless powers out of the anti-Ming coalition', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    // 西藏/荷兰/沙俄会把大明识别为霸主，但实际打不到或打不过，只能回落到自己的历史目标或按兵不动。
    for (const tag of ['TIBET', 'VOC', 'RUSSIA']) {
      expect(manageableWarTarget(state, content, tag)?.target).not.toBe('MING');
    }
    // 郑氏在 1627 的历史目标是荷兰人，而不是跨海硬撼大明。
    expect(manageableWarTarget(state, content, 'ZHENG')?.target).toBe('VOC');
    // 蒙古与后金才是大明真正的地缘对手。
    expect(manageableWarTarget(state, content, 'MONGOL')?.target).toBe('MING');
    expect(manageableWarTarget(state, content, 'QING')?.target).toBe('MING');
  });

  it('rejects scripted wars that are geographically impossible or hopeless', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(canStartScriptedWar(state, content, 'TIBET', { target: 'MING', dominant: true })).toBe(false);
    expect(canStartScriptedWar(state, content, 'VOC', { target: 'MING', dominant: true })).toBe(false);
    expect(canStartScriptedWar(state, content, 'RUSSIA', { target: 'MING', dominant: true })).toBe(false);
    expect(canStartScriptedWar(state, content, 'MONGOL', { target: 'MING', dominant: true })).toBe(true);
    expect(canStartScriptedWar(state, content, 'QING', { target: 'MING', dominant: true })).toBe(true);
  });

  it('lets the 1650 anti-Qing powers fight the dominant Qing', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    expect(historicalWarTarget(state, 'SMING')?.target).toBe('QING');
    expect(historicalWarTarget(state, 'ZHENG')?.target).toBe('QING');
    expect(historicalWarTarget(state, 'MONGOL')?.target).toBe('QING');
    expect(historicalWarTarget(state, 'TIBET')?.target).toBe('QING');
  });
});
