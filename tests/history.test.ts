import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { parseDay } from '../src/engine/core/clock';
import { createInitialState } from '../src/engine/state/initial';
import { maybeFoundSouthernMing } from '../src/engine/systems/southernMing';

describe('southern Ming emergence', () => {
  const content = loadContentFromDirectory();

  function fallOfBeijing(player: string) {
    const state = createInitialState(content, '1627', 42, player, 'normal', false);
    state.day = parseDay('1644-06-01');
    const beijing = state.provinces['beijing'];
    if (beijing) {
      beijing.owner = 'SHUN';
      beijing.controller = 'SHUN';
    }
    return state;
  }

  it('does not found Southern Ming when the player is Ming', () => {
    const state = fallOfBeijing('MING');
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(false);
  });

  it('founds Southern Ming from AI Ming territory after Beijing falls', () => {
    const state = fallOfBeijing('QING');
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(true);
    const southern = Object.values(state.provinces).filter(province => province.owner === 'SMING');
    expect(southern.length).toBeGreaterThan(100);
    expect(state.countries['SMING']?.capital).toBe('nanjing');
  });

  it('does not found Southern Ming before 1644', () => {
    const state = createInitialState(content, '1627', 42, 'QING');
    const beijing = state.provinces['beijing'];
    if (beijing) {
      beijing.owner = 'SHUN';
      beijing.controller = 'SHUN';
    }
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(false);
  });
});
