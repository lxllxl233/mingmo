import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { maybeFoundSouthernMing } from '../src/engine/systems/southernMing';
import { parseDay } from '../src/engine/core/clock';

const SOUTHERN_REGIONS = new Set([
  'reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_fujian',
  'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou',
]);

const content = loadContentFromDirectory();

function fallOfBeijing(playerTag: string, spectator = false) {
  const state = createInitialState(content, '1644', 42, playerTag, 'normal', spectator);
  state.day = parseDay('1644-06-01');
  const beijing = state.provinces['beijing'];
  if (beijing) beijing.controller = 'QING';
  return state;
}

describe('Southern Ming founding', () => {
  it('does not found Southern Ming before 1644', () => {
    const state = createInitialState(content, '1627', 42, 'QING');
    state.day = parseDay('1643-12-31');
    const beijing = state.provinces['beijing'];
    if (beijing) beijing.controller = 'QING';
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(false);
  });

  it('does not transfer the player’s own territory when playing Ming', () => {
    const state = fallOfBeijing('MING');
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(false);
    const southern = Object.values(state.provinces).filter(province => province.owner === 'MING');
    expect(southern.length).toBeGreaterThan(0);
  });

  it('does not fire while Beijing still holds for Ming', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    state.day = parseDay('1644-06-01');
    expect(state.provinces['beijing']?.controller).toBe('MING');
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(false);
  });

  it('is disabled in the 1650 scenario even if Southern Ming has fallen', () => {
    const state = createInitialState(content, '1650', 42, 'QING');
    state.day = parseDay('1650-06-01');
    const sming = state.countries['SMING'];
    if (!sming) throw new Error('missing SMING');
    sming.alive = false;
    const beijing = state.provinces['beijing'];
    if (beijing) beijing.controller = 'QING';
    maybeFoundSouthernMing(state, content);
    expect(sming.alive).toBe(false);
  });

  it('founds Southern Ming for spectators and hands over southern cores', () => {
    const state = fallOfBeijing('MING', true);
    const southern = Object.values(state.provinces).filter(province => {
      const regionId = content.provinces.get(province.id)?.regionId ?? '';
      return province.owner === 'MING' && province.controller === 'MING' && SOUTHERN_REGIONS.has(regionId);
    });
    expect(southern.length).toBeGreaterThan(1);
    maybeFoundSouthernMing(state, content);
    const sming = state.countries['SMING'];
    expect(sming?.alive).toBe(true);
    expect(sming?.capital).toBe('nanjing');
    expect(state.provinces['nanjing']?.owner).toBe('SMING');
    for (const province of southern) {
      expect(province.owner).toBe('SMING');
      expect(province.controller).toBe('SMING');
      expect(province.cores).toContain('SMING');
    }
    // 北方省份仍归大明，不随南明建立而转移。
    expect(state.provinces['beijing']?.owner).toBe('MING');
  });

  it('does not run twice', () => {
    const state = fallOfBeijing('MING', true);
    maybeFoundSouthernMing(state, content);
    const sming = state.countries['SMING'];
    if (!sming) throw new Error('missing SMING');
    const logLength = state.log.length;
    const capital = sming.capital;
    maybeFoundSouthernMing(state, content);
    expect(state.log.length).toBe(logLength);
    expect(sming.capital).toBe(capital);
  });
});
