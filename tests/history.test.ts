import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { parseDay } from '../src/engine/core/clock';
import { createInitialState } from '../src/engine/state/initial';
import { applyHistoricalTimeline } from '../src/engine/systems/history';

describe('historical timeline', () => {
  const content = loadContentFromDirectory();

  it('moves 1627 into the 1644, 1650, 1662 and 1683 map phases', () => {
    const state = createInitialState(content, '1627', 42, 'MING', undefined, true);
    state.day = parseDay('1644-01-02');
    applyHistoricalTimeline(state, content);
    expect(state.countries['MING']?.alive).toBe(false);
    expect(Object.values(state.provinces).filter(province => province.owner === 'QING').length).toBeGreaterThan(60);
    expect(Object.values(state.provinces).filter(province => province.owner === 'SMING').length).toBeGreaterThan(100);
    expect(Object.values(state.provinces).filter(province => province.owner === 'ZHENG').length).toBeGreaterThan(0);

    state.day = parseDay('1650-01-02');
    applyHistoricalTimeline(state, content);
    expect(state.countries['SHUN']?.alive).toBe(false);
    expect(Object.values(state.provinces).filter(province => province.owner === 'QING').length).toBeGreaterThan(200);

    state.day = parseDay('1662-01-02');
    applyHistoricalTimeline(state, content);
    expect(state.countries['SMING']?.alive).toBe(false);
    expect(state.countries['XI']?.alive).toBe(false);
    expect(Object.values(state.provinces).filter(province => province.owner === 'QING').length).toBeGreaterThan(300);

    state.day = parseDay('1683-01-02');
    applyHistoricalTimeline(state, content);
    expect(state.countries['ZHENG']?.alive).toBe(false);
  });
});
