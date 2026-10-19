import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { declareWar, resolveFinishedWars } from '../src/engine/rules/war';

describe('war resolution', () => {
  it('ends a war when one side has no controlled province left', () => {
    const content = loadContentFromDirectory();
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    declareWar(state, 'ZHENG', 'VOC', 'test', content);
    for (const province of Object.values(state.provinces)) {
      if (province.owner === 'VOC') province.controller = 'ZHENG';
    }
    for (const [id, army] of Object.entries(state.armies)) {
      if (army.tag === 'VOC') delete state.armies[id];
    }
    resolveFinishedWars(state, content);
    expect(state.wars.some(war =>
      (war.attacker === 'ZHENG' && war.defender === 'VOC')
      || (war.attacker === 'VOC' && war.defender === 'ZHENG'))).toBe(false);
    expect(state.countries['VOC']?.alive).toBe(false);
    expect(Object.values(state.provinces).filter(province => province.owner === 'VOC')).toHaveLength(0);
  });
});
