import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';

describe('content pipeline', () => {
  const content = loadContentFromDirectory();

  it('loads the full map', () => {
    expect(content.regions.size).toBe(30);
    expect(content.prefectures.size).toBe(160);
    expect(content.provinces.size).toBe(480);
  });

  it('loads every faction and its estates', () => {
    expect(content.countries.size).toBe(13);
    for (const country of content.countries.values()) {
      const estates = content.countryEstates.get(country.tag);
      expect(estates, country.tag).toBeDefined();
      expect(estates?.length, country.tag).toBeGreaterThanOrEqual(4);
      expect(content.provinces.has(country.capital), country.tag).toBe(true);
    }
  });

  it('loads tax laws and privileges', () => {
    expect(content.taxLaws.size).toBeGreaterThanOrEqual(25);
    expect(content.privileges.size).toBeGreaterThanOrEqual(9);
    for (const estate of ['dynasty', 'nobles', 'officials', 'gentry', 'merchants', 'peasants', 'soldiers', 'clergy']) {
      expect(content.taxLawsByEstate.get(estate)?.length ?? 0, estate).toBeGreaterThanOrEqual(3);
    }
  });

  it('loads three scenarios', () => {
    expect(content.scenarios.size).toBe(3);
    expect(content.scenarios.get('1627')?.startDate).toBe('1627-10-01');
    expect(content.scenarios.get('1644')?.startDate).toBe('1644-01-01');
    expect(content.scenarios.get('1650')?.startDate).toBe('1650-01-01');
  });
});
