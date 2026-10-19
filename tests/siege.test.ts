import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { dispatch, CommandError } from '../src/engine/commands';

const content = loadContentFromDirectory();

describe('siege modes', () => {
  it('sets a siege mode for a player army', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const army = Object.values(state.armies).find(entry => entry.tag === 'MING');
    if (!army) throw new Error('missing Ming army');
    dispatch(state, { type: 'army.setSiegeMode', armyId: army.id, mode: 'assault' }, content);
    expect(army.siegeMode).toBe('assault');
  });

  it('refuses to command another country army', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const qing = Object.values(state.armies).find(entry => entry.tag === 'QING');
    if (!qing) throw new Error('missing Qing army');
    expect(() => dispatch(state, { type: 'army.setSiegeMode', armyId: qing.id, mode: 'bombard' }, content))
      .toThrow(CommandError);
  });
});
