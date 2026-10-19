import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { dispatch } from '../src/engine/commands';
import { advanceDay } from '../src/engine/tick';
import { blockadedPorts, blockadePenalty } from '../src/engine/rules/naval';
import { declareWar } from '../src/engine/rules/war';

const content = loadContentFromDirectory();

describe('naval', () => {
  it('detects a hostile fleet blockading an enemy port', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    declareWar(state, 'MING', 'VOC', 'test', content);
    const navy = Object.values(state.armies).find(army => army.tag === 'MING' && army.composition.naval > 0);
    if (!navy) throw new Error('missing Ming navy');
    navy.province = 'anping';
    navy.movePath = [];
    navy.embarked = false;
    expect(blockadedPorts(state, content, 'VOC')).toContain('anping');
    expect(blockadePenalty(state, content, 'VOC')).toBeGreaterThan(0);
  });

  it('diverts to a friendly province when the landing fails and the origin is lost', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    declareWar(state, 'MING', 'VOC', 'test', content);
    const navy = Object.values(state.armies).find(army => army.tag === 'MING' && army.composition.naval > 0);
    if (!navy) throw new Error('missing Ming navy');
    navy.province = 'fuzhou';
    navy.movePath = [];
    navy.embarked = false;
    dispatch(state, { type: 'army.navalMove', armyId: navy.id, portId: 'anping' }, content);
    expect(navy.embarked).toBe(true);
    const target = state.provinces['anping'];
    const origin = state.provinces['fuzhou'];
    if (!target || !origin) throw new Error('missing ports');
    target.controller = 'JAPAN';
    origin.controller = 'QING';
    for (let day = 0; day < 3; day += 1) advanceDay(state, content);
    expect(navy.embarked).toBe(false);
    expect(navy.province).not.toBe('fuzhou');
    expect(state.provinces[navy.province]?.controller).toBe('MING');
  });

  it('allows an amphibious landing on an enemy port', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    declareWar(state, 'MING', 'VOC', 'test', content);
    const navy = Object.values(state.armies).find(army => army.tag === 'MING' && army.composition.naval > 0);
    if (!navy) throw new Error('missing Ming navy');
    navy.province = 'fuzhou';
    navy.movePath = [];
    navy.embarked = false;
    dispatch(state, { type: 'army.navalMove', armyId: navy.id, portId: 'anping' }, content);
    expect(navy.embarked).toBe(true);
    for (let day = 0; day < 3; day += 1) advanceDay(state, content);
    expect(navy.province).toBe('anping');
    expect(navy.embarked).toBe(false);
  });
});
