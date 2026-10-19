import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { buildingModifiers, startBuilding } from '../src/engine/systems/buildings';

const content = loadContentFromDirectory();

describe('province buildings', () => {
  it('starts, completes and contributes a modifier', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const provinceId = state.countries['MING']?.capital ?? 'beijing';
    expect(state.provinces[provinceId]?.controller).toBe('MING');
    const nation = state.countries['MING'];
    if (!nation) throw new Error('missing MING');
    nation.treasury = 1000000;
    nation.food = 1000000;
    const def = content.buildings.get('bld_granary');
    expect(def).toBeDefined();
    expect(startBuilding(state, content, 'MING', provinceId, 'bld_granary')).toBe(true);
    expect(state.provinces[provinceId]?.building?.id).toBe('bld_granary');
    for (let day = 0; day < (def?.days ?? 90); day += 1) advanceDay(state, content);
    expect(state.provinces[provinceId]?.buildings).toContain('bld_granary');
    expect(state.provinces[provinceId]?.building).toBeNull();
    const modifiers = buildingModifiers(state, content, 'MING');
    expect(modifiers['food_output_pct'] ?? 0).toBeGreaterThan(0);
  });

  it('refuses to build in a province controlled by another country', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const nation = state.countries['MING'];
    if (!nation) throw new Error('missing MING');
    nation.treasury = 1000000;
    nation.food = 1000000;
    expect(startBuilding(state, content, 'MING', 'shenyang', 'bld_granary')).toBe(false);
  });
});
