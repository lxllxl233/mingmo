import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { normalizeValue } from '../src/content/loader/normalize';

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
      expect(estates?.length, country.tag).toBeGreaterThanOrEqual(3);
      expect(content.provinces.has(country.capital), country.tag).toBe(true);
    }
  });

  it('keeps faction and estate ids opaque while camelizing the field name', () => {
    expect(normalizeValue({ add_faction_influence: { scholar_gentry: 4 } }))
      .toEqual({ addFactionInfluence: { scholar_gentry: 4 } });
    expect(normalizeValue({ estate_loyalty: { eunuch_faction: { gte: 50 } } }))
      .toEqual({ estateLoyalty: { eunuch_faction: { gte: 50 } } });
  });

  it('loads tax laws and privileges', () => {
    expect(content.taxLaws.size).toBeGreaterThanOrEqual(25);
    expect(content.privileges.size).toBeGreaterThanOrEqual(9);
    for (const estate of ['ruling', 'merchants', 'landlords', 'artisans', 'peasants'] as const) {
      expect(content.taxLawsByEstate.get(estate)?.length ?? 0, estate).toBeGreaterThanOrEqual(3);
    }
  });

  it('loads three scenarios', () => {
    expect(content.scenarios.size).toBe(3);
    expect(content.scenarios.get('1627')?.startDate).toBe('1627-10-01');
    expect(content.scenarios.get('1644')?.startDate).toBe('1644-01-01');
    expect(content.scenarios.get('1650')?.startDate).toBe('1650-01-01');
  });

  it('loads a mechanic event for every playable faction', () => {
    expect(content.events.size).toBeGreaterThanOrEqual(200);
    const ids = [
      'MING_e_jisi_crisis', 'QING_e_haircut', 'SHUN_e_beijing_treasury',
      'SMING_e_hongguang', 'ZHENG_e_taiwan', 'MONGOL_e_chahar_submit',
      'JAPAN_e_sakoku_edict', 'JOSEON_e_bingzi',
      'MING_e_court_deadlock', 'QING_e_banner_review', 'SHUN_e_confiscation_debate',
      'SMING_e_legitimacy_dispute', 'ZHENG_e_sea_route', 'MONGOL_e_kurultai',
      'JAPAN_e_sakoku_pressure', 'JOSEON_e_tribute_or_north',
    ];
    for (const id of ids) expect(content.events.has(id), id).toBe(true);
  });

  it('gives each focus branch distinct rewards', () => {
    const court = content.focuses.get('ming_court_1');
    const fiscal = content.focuses.get('ming_fiscal_1');
    const qing = content.focuses.get('qing_banner_1');
    expect(court).toBeDefined();
    expect(fiscal).toBeDefined();
    expect(qing).toBeDefined();
    expect(court?.completionEffect).not.toEqual(fiscal?.completionEffect);
    expect(court?.completionEffect).not.toEqual(qing?.completionEffect);
  });
});
