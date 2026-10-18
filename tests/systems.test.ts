import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { startFocus } from '../src/engine/systems/focus';
import { startResearch } from '../src/engine/systems/research';
import { chooseEventOption } from '../src/engine/systems/events';
import { parseDay } from '../src/engine/core/clock';
import { evaluateVictory } from '../src/engine/victory';

const content = loadContentFromDirectory();

describe('focus and research', () => {
  it('completes a focus after its cost', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(startFocus(state, content, 'MING', 'ming_court_2')).toBe(true);
    for (let day = 0; day < 100; day += 1) advanceDay(state, content);
    expect(state.countries['MING']?.completedFocuses).toContain('ming_court_2');
  });

  it('completes a technology after its cost', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(startResearch(state, content, 'MING', 'mil_bow')).toBe(true);
    for (let day = 0; day < 130; day += 1) advanceDay(state, content);
    expect(state.countries['MING']?.completedTechs).toContain('mil_bow');
  });
});

describe('event chains', () => {
  it('fires the jiashen chain and follows the chosen branch', () => {
    const state = createInitialState(content, '1644', 42, 'MING');
    state.day = parseDay('1644-02-01');
    advanceDay(state, content);
    const first = state.pendingEvents.find(event => event.eventId === 'MING_e_jiashen_1');
    expect(first).toBeDefined();
    expect(chooseEventOption(state, content, 'MING_e_jiashen_1', 'summon_wu')).toBe(true);
    expect(state.countries['MING']?.flags['wu_sangui_summoned']).toBe(true);

    state.day = parseDay('1644-03-02');
    advanceDay(state, content);
    const second = state.pendingEvents.find(event => event.eventId === 'MING_e_jiashen_2');
    expect(second).toBeDefined();
    expect(chooseEventOption(state, content, 'MING_e_jiashen_2', 'open_to_qing')).toBe(true);
    expect(state.countries['MING']?.flags['wu_sangui_defected']).toBe(true);
  });
});

describe('victory', () => {
  it('detects a unified China', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    for (const province of Object.values(state.provinces)) {
      province.owner = 'MING';
      province.controller = 'MING';
    }
    state.day = parseDay('1683-12-31');
    const result = evaluateVictory(state, content);
    expect(result.reason).toBe('一统天下');
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown['疆域']).toBeGreaterThan(0);
  });
});
