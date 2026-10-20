import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { canMarchThrough } from '../src/engine/rules/access';
import {
  addAlliance,
  alliesOf,
  areAllied,
  grantMilitaryAccess,
  hasMilitaryAccess,
  improveRelation,
  removeAlliance,
  revokeMilitaryAccess,
} from '../src/engine/rules/diplomacy';
import { areAtWar, declareWar } from '../src/engine/rules/war';
import { relationKey } from '../src/engine/state/types';

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

  it('clamps relations to the -100..100 range', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const key = relationKey('MONGOL', 'JAPAN');
    state.relations[key] = 90;
    improveRelation(state, 'JAPAN', 'MONGOL', 50);
    expect(state.relations[key]).toBe(100);
    improveRelation(state, 'MONGOL', 'JAPAN', -500);
    expect(state.relations[key]).toBe(-100);
    improveRelation(state, 'MONGOL', 'MONGOL', 50);
    expect(state.relations[key]).toBe(-100);
  });

  it('grants and revokes military access idempotently', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(hasMilitaryAccess(state, 'MING', 'VOC')).toBe(false);
    expect(grantMilitaryAccess(state, 'MING', 'VOC')).toBe(true);
    expect(grantMilitaryAccess(state, 'MING', 'VOC')).toBe(false);
    expect(hasMilitaryAccess(state, 'MING', 'VOC')).toBe(true);
    expect(grantMilitaryAccess(state, 'MING', 'MING')).toBe(false);
    expect(revokeMilitaryAccess(state, 'MING', 'VOC')).toBe(true);
    expect(revokeMilitaryAccess(state, 'MING', 'VOC')).toBe(false);
    expect(hasMilitaryAccess(state, 'MING', 'VOC')).toBe(false);
  });

  it('allows alliance with one’s own vassal but not another power’s vassal', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(addAlliance(state, 'JOSEON', 'JAPAN')).toBe(false);
    expect(addAlliance(state, 'MING', 'JOSEON')).toBe(true);
    expect(areAllied(state, 'MING', 'JOSEON')).toBe(true);
  });

  it('filters dead allies out of the ally list', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    state.vassals = {};
    expect(addAlliance(state, 'MONGOL', 'JOSEON')).toBe(true);
    expect(alliesOf(state, 'MONGOL')).toEqual(['JOSEON']);
    const joseon = state.countries['JOSEON'];
    if (!joseon) throw new Error('missing JOSEON');
    joseon.alive = false;
    expect(alliesOf(state, 'MONGOL')).toEqual([]);
  });
});
