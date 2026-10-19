import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceCrisis } from '../src/engine/systems/crisis';

const content = loadContentFromDirectory();

describe('fiscal collapse', () => {
  it('partitions Ming territory instead of leaving a dead owner', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    ming.fiscalCrisisDays = 730;
    ming.treasury = 0;
    ming.arrears = 1000000;
    advanceCrisis(state, content);
    expect(ming.alive).toBe(false);
    expect(state.countries['SMING']?.alive).toBe(true);
    const orphaned = Object.values(state.provinces).filter(province =>
      province.owner === 'MING' || province.controller === 'MING');
    expect(orphaned).toHaveLength(0);
  });
});
