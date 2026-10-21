import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { minimumAllocationShare } from '../src/engine/systems/economy';

const content = loadContentFromDirectory();

function startup(scenarioId: string) {
  return createInitialState(content, scenarioId, 42, 'MING', 'normal', true);
}

function armyStrength(state: ReturnType<typeof startup>, tag: string): number {
  return Object.values(state.armies)
    .filter(army => army.tag === tag)
    .reduce((sum, army) => sum + army.maxStrength, 0);
}

function topFaction(factions: Record<string, number>): string {
  return Object.entries(factions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

describe('historical starting conditions', () => {
  it('reflects the 1644 collapse in Ming estate loyalties', () => {
    const before = startup('1627').countries.MING!;
    const crisis = startup('1644').countries.MING!;
    expect(crisis.estates.peasants!.loyalty).toBeLessThan(before.estates.peasants!.loyalty - 10);
    expect(crisis.estates.landlords!.loyalty).toBeLessThan(before.estates.landlords!.loyalty - 10);
    expect(crisis.estates.merchants!.loyalty).toBeLessThan(before.estates.merchants!.loyalty);
    expect(crisis.stability).toBeLessThan(before.stability);
  });

  it('gives the Shun a peasant base and gentry hostility in 1644', () => {
    const shun = startup('1644').countries.SHUN!;
    expect(shun.estates.peasants!.loyalty).toBeGreaterThan(shun.estates.landlords!.loyalty + 50);
    expect(shun.estates.landlords!.loyalty).toBeLessThan(15);
    expect(shun.estates.merchants!.loyalty).toBeLessThan(40);
    expect(topFaction(shun.factions)).toBe('military');
  });

  it('gives the Daxi a garrison state with hostile Sichuan gentry', () => {
    const xi = startup('1644').countries.XI!;
    expect(xi.estates.ruling!.influence).toBeGreaterThan(xi.estates.peasants!.influence);
    expect(xi.estates.landlords!.loyalty).toBeLessThan(10);
    expect(topFaction(xi.factions)).toBe('military');
  });

  it('ranks factions by historical weight instead of list order', () => {
    const s1627 = startup('1627');
    const s1644 = startup('1644');
    const s1650 = startup('1650');
    expect(topFaction(s1627.countries.QING!.factions)).toBe('banners');
    expect(topFaction(s1644.countries.MING!.factions)).toBe('military');
    expect(topFaction(s1644.countries.QING!.factions)).toBe('banners');
    expect(topFaction(s1644.countries.ZHENG!.factions)).toBe('merchants');
    expect(topFaction(s1650.countries.SMING!.factions)).toBe('military');
    expect(topFaction(s1650.countries.ZHENG!.factions)).toBe('merchants');
    expect(topFaction(s1650.countries.MONGOL!.factions)).toBe('nobles');
    expect(topFaction(s1650.countries.TIBET!.factions)).toBe('clergy');
    expect(topFaction(s1650.countries.JOSEON!.factions)).toBe('nobles');
    expect(topFaction(s1650.countries.JAPAN!.factions)).toBe('military');
    expect(topFaction(s1650.countries.QING!.factions)).toBe('banners');
  });

  it('keeps every faction influence on a faction the country actually has', () => {
    for (const country of content.countries.values()) {
      for (const faction of Object.keys(country.factionInfluence)) {
        expect(country.factions, `${country.tag} ${faction}`).toContain(faction);
      }
    }
    for (const scenario of content.scenarios.values()) {
      for (const [tag, override] of Object.entries(scenario.factionOverrides)) {
        const country = content.countries.get(tag);
        expect(country, `${scenario.id} ${tag}`).toBeDefined();
        for (const faction of Object.keys(override)) {
          expect(country!.factions, `${scenario.id} ${tag} ${faction}`).toContain(faction);
        }
      }
      for (const [tag, override] of Object.entries(scenario.estateOverrides)) {
        const configs = content.countryEstates.get(tag) ?? [];
        for (const key of Object.keys(override)) {
          expect(configs.map(config => config.key), `${scenario.id} ${tag} ${key}`).toContain(key);
        }
      }
    }
  });

  it('allocates all 100 estate shares for every alive country', () => {
    for (const scenarioId of ['1627', '1644', '1650']) {
      const state = startup(scenarioId);
      for (const country of Object.values(state.countries)) {
        if (!country.alive) continue;
        const total = Object.values(country.allocation).reduce((sum, value) => sum + value, 0);
        expect(total, `${scenarioId} ${country.tag}`).toBeGreaterThan(99);
        expect(total, `${scenarioId} ${country.tag}`).toBeLessThan(101);
      }
    }
  });

  it('has every country population share sum to 1', () => {
    for (const [tag, configs] of content.countryEstates) {
      const total = configs.reduce((sum, config) => sum + (config.populationShare ?? 0), 0);
      expect(total, tag).toBeCloseTo(1, 2);
    }
  });

  it('keeps peasants the demographic majority without handing them the whole pie', () => {
    const ming = startup('1627').countries.MING!;
    expect(ming.allocation.peasants).toBeGreaterThanOrEqual(20);
    expect(ming.allocation.peasants).toBeLessThanOrEqual(30);
    expect(ming.allocation.landlords).toBeGreaterThanOrEqual(38);
    expect(ming.allocation.ruling).toBeGreaterThanOrEqual(18);
    const mingConfigs = content.countryEstates.get('MING')!;
    const peasants = mingConfigs.find(config => config.key === 'peasants')!;
    expect(peasants.populationShare).toBeGreaterThan(0.75);
    // 明末财富高度集中：81% 的人口只分到约 24% 的财富大盘，远低于人口占比。
    expect((ming.allocation.peasants ?? 0) / 100).toBeLessThan(peasants.populationShare! - 0.3);

    const zheng = startup('1627').countries.ZHENG!;
    expect(zheng.allocation.merchants).toBeGreaterThanOrEqual(30);
    expect(zheng.allocation.merchants).toBeGreaterThan(zheng.allocation.landlords! * 2);

    const mongol = startup('1627').countries.MONGOL!;
    expect(mongol.allocation.ruling).toBeGreaterThanOrEqual(45);
    expect(mongol.allocation.peasants).toBeGreaterThan(0);
    expect(mongol.allocation.peasants).toBeLessThanOrEqual(15);
    expect(mongol.estates.peasants?.influence).toBeLessThan(mongol.estates.ruling!.influence);

    const tibet = startup('1627').countries.TIBET!;
    const tibetConfigs = content.countryEstates.get('TIBET')!;
    const clergy = tibetConfigs.find(config => config.key === 'landlords')!;
    expect(clergy.populationShare).toBeGreaterThan(0.15);
    expect(tibet.allocation.landlords).toBeGreaterThanOrEqual(55);
    expect(tibet.allocation.landlords).toBeGreaterThan(tibet.allocation.ruling!);
    expect(tibet.allocation.peasants).toBeLessThanOrEqual(10);
  });

  it('starts every estate at its customary wealth share', () => {
    for (const scenarioId of ['1627', '1644', '1650']) {
      const state = startup(scenarioId);
      for (const [tag, configs] of content.countryEstates) {
        const country = state.countries[tag];
        if (!country?.alive) continue;
        for (const config of configs) {
          expect(country.allocation[config.key], `${scenarioId} ${tag} ${config.key}`)
            .toBeCloseTo(config.incomeShare * 100, 0);
        }
      }
    }
  });

  it('does not let influence-based minimums squeeze peasant allocation', () => {
    // 旧公式 min(45, 2 + influence*0.13) 会给高影响力阶级 10+ 的硬性下限。
    expect(minimumAllocationShare(44)).toBeLessThan(5);
    expect(minimumAllocationShare(76)).toBeLessThan(5);
    for (const scenarioId of ['1627', '1644', '1650']) {
      const state = startup(scenarioId);
      for (const country of Object.values(state.countries)) {
        if (!country.alive) continue;
        for (const [key, share] of Object.entries(country.allocation)) {
          const influence = country.estates[key]?.influence ?? 0;
          expect(share, `${scenarioId} ${country.tag} ${key}`).toBeGreaterThanOrEqual(
            minimumAllocationShare(influence) - 0.05,
          );
        }
      }
    }
  });

  it('gives the 1644 Shun and 1650 Qing historically plausible field armies', () => {
    expect(armyStrength(startup('1644'), 'SHUN')).toBeGreaterThanOrEqual(11000);
    const qing = armyStrength(startup('1650'), 'QING');
    expect(qing).toBeGreaterThan(armyStrength(startup('1650'), 'SMING'));
    expect(qing).toBeGreaterThan(armyStrength(startup('1650'), 'XI'));
    expect(armyStrength(startup('1627'), 'MING')).toBeGreaterThan(25000);
  });
});
