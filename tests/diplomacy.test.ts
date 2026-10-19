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

  it('calls allies into a defensive war', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(addAlliance(state, 'MONGOL', 'JAPAN')).toBe(true);
    expect(declareWar(state, 'MING', 'MONGOL', 'test', content)).not.toBeNull();
    expect(areAtWar(state, 'MING', 'MONGOL')).toBe(true);
    expect(areAtWar(state, 'MING', 'JAPAN')).toBe(true);
  });
});
