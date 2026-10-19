import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { parseDay } from '../src/engine/core/clock';

describe('initial state', () => {
  const content = loadContentFromDirectory();
  const state = createInitialState(content, '1627', 42, 'MING');

  it('starts on the scenario date', () => {
    expect(state.day).toBe(parseDay('1627-10-01'));
    expect(state.scenarioId).toBe('1627');
    expect(state.playerTag).toBe('MING');
  });

  it('assigns every province to a country', () => {
    expect(Object.keys(state.provinces)).toHaveLength(480);
    for (const province of Object.values(state.provinces)) {
      expect(state.countries[province.owner], province.id).toBeDefined();
      expect(province.controller).toBe(province.owner);
    }
  });

  it('gives every country its estates and armies', () => {
    expect(Object.keys(state.countries)).toHaveLength(13);
    for (const country of Object.values(state.countries)) {
      expect(Object.keys(country.estates).length, country.tag).toBeGreaterThanOrEqual(4);
      expect(Number.isFinite(country.treasury), country.tag).toBe(true);
      expect(Number.isFinite(country.stability), country.tag).toBe(true);
    }
    expect(Object.keys(state.armies).length).toBeGreaterThan(20);
    expect(state.wars.length).toBe(3);
    expect(state.wars.map(war => war.attacker)).toEqual(expect.arrayContaining(['QING', 'SHUN', 'XI']));
  });

  it('keeps the Ming state above water at the start', () => {
    const ming = state.countries['MING'];
    expect(ming).toBeDefined();
    expect(ming?.treasury).toBe(600000);
    expect(ming?.estates['peasants']?.loyalty).toBe(30);
    const owned = Object.values(state.provinces).filter(province => province.owner === 'MING');
    expect(owned.length).toBeGreaterThan(200);
  });

  it('can start every playable faction in every scenario', () => {
    for (const scenario of content.scenarios.values()) {
      for (const tag of scenario.playableTags) {
        const started = createInitialState(content, scenario.id, 42, tag);
        expect(started.countries[tag], `${scenario.id}/${tag}`).toBeDefined();
        expect(started.provinces[started.countries[tag]?.capital ?? 'beijing']).toBeDefined();
        const focuses = content.focusesByCountry.get(tag) ?? [];
        expect(focuses.length, `${tag} focuses`).toBeGreaterThanOrEqual(40);
        expect(Object.keys(started.armies).length, `${tag} armies`).toBeGreaterThan(0);
      }
    }
  });
});


