import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { canMarchThrough } from '../src/engine/rules/access';
import { addAlliance, areAllied, hasMilitaryAccess, removeAlliance } from '../src/engine/rules/diplomacy';
import { areAtWar, declareWar } from '../src/engine/rules/war';

const content = loadContentFromDirectory();

describe('diplomacy', () => {
  it('creates a symmetric alliance and grants military access', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(addAlliance(state, 'MING', 'MONGOL')).toBe(true);
    expect(areAllied(state, 'MING', 'MONGOL')).toBe(true);
    expect(areAllied(state, 'MONGOL', 'MING')).toBe(true);
    expect(hasMilitaryAccess(state, 'MONGOL', 'MING')).toBe(true);
    expect(canMarchThrough(state, 'MING', 'chahar')).toBe(true);
    expect(declareWar(state, 'MING', 'MONGOL', 'test', content)).toBeNull();
    expect(removeAlliance(state, 'MING', 'MONGOL')).toBe(true);
    expect(areAllied(state, 'MING', 'MONGOL')).toBe(false);
    expect(declareWar(state, 'MING', 'MONGOL', 'test', content)).not.toBeNull();
  });

  it('rejects alliances with a country it is at war with or bound to as a vassal', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(areAtWar(state, 'MING', 'QING')).toBe(true);
    expect(addAlliance(state, 'MING', 'QING')).toBe(false);
    expect(addAlliance(state, 'JOSEON', 'QING')).toBe(false);
    expect(areAllied(state, 'JOSEON', 'QING')).toBe(false);
    expect(state.militaryAccess['QING'] ?? []).not.toContain('JOSEON');
  });

  it('calls allies into a defensive war', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    state.truces = {};
    state.vassals = {};
    expect(addAlliance(state, 'MONGOL', 'JOSEON')).toBe(true);
    expect(declareWar(state, 'MING', 'MONGOL', 'test', content)).not.toBeNull();
    expect(areAtWar(state, 'MING', 'MONGOL')).toBe(true);
    expect(areAtWar(state, 'MING', 'JOSEON')).toBe(true);
  });
});
