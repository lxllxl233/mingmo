import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import type { GameState } from '../src/engine/state/types';

const content = loadContentFromDirectory();
const tags = [...content.countries.keys()];

function signature(state: GameState): string {
  const provinces = Object.values(state.provinces)
    .map(province => `${province.id}:${province.owner}:${province.controller}`)
    .sort()
    .join('|');
  const wars = state.wars
    .map(war => `${war.attacker}>${war.defender}:${war.warGoal}`)
    .sort()
    .join('|');
  const alive = Object.values(state.countries)
    .filter(country => country.alive)
    .map(country => country.tag)
    .sort()
    .join(',');
  return `${provinces}\n${wars}\n${alive}`;
}

describe('scenario consistency', () => {
  for (const scenario of content.scenarios.values()) {
    it(`${scenario.id} starts with the same world for every player tag`, () => {
      const snapshots = tags.map(tag => signature(createInitialState(content, scenario.id, 42, tag)));
      expect(new Set(snapshots).size).toBe(1);
    });
  }

  it('1644 still has Ming, Shun and the two opening wars when the player is Qing', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    expect(state.countries['MING']?.alive).toBe(true);
    expect(state.countries['SHUN']?.alive).toBe(true);
    expect(state.wars.some(war => war.attacker === 'QING' && war.defender === 'MING')).toBe(true);
    expect(state.wars.some(war => war.attacker === 'SHUN' && war.defender === 'MING')).toBe(true);
  });

  it('1650 keeps Zheng in Fujian and the Qing-Zheng war when the player is Qing', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    const zhengProvinces = Object.values(state.provinces).filter(province => province.owner === 'ZHENG');
    expect(zhengProvinces.length).toBeGreaterThan(0);
    expect(state.wars.some(war => war.attacker === 'QING' && war.defender === 'ZHENG')).toBe(true);
  });
});
