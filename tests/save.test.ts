import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { decodeSave, encodeSave } from '../src/app/save/save';
import { hashState } from '../src/engine/state/hash';

const content = loadContentFromDirectory();

describe('save format', () => {
  it('round-trips a game state', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const encoded = encodeSave(state);
    const decoded = decodeSave(encoded);
    expect(hashState(decoded)).toBe(hashState(state));
    expect(decoded.day).toBe(state.day);
    expect(decoded.playerTag).toBe('MING');
  });

  it('rejects a corrupted checksum', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const parsed = JSON.parse(encodeSave(state)) as { state: { day: number } };
    parsed.state.day += 1;
    expect(() => decodeSave(JSON.stringify(parsed))).toThrow(/校验失败/);
  });

  it('rejects an incompatible version', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const parsed = JSON.parse(encodeSave(state)) as { version: number };
    parsed.version = 99;
    expect(() => decodeSave(JSON.stringify(parsed))).toThrow(/不兼容/);
  });

  it('repairs non-finite army composition from old saves', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const army = Object.values(state.armies)[0];
    if (!army) throw new Error('missing army');
    (army.composition as { infantry: number }).infantry = Number.NaN;
    army.maxStrength = Number.NaN;
    const parsed = JSON.parse(encodeSave(state)) as { version: number; state: typeof state; checksum: string };
    parsed.version = 1;
    parsed.checksum = hashState(parsed.state);
    const loaded = decodeSave(JSON.stringify(parsed));
    const repaired = Object.values(loaded.armies).find(entry => entry.id === army.id);
    expect(repaired?.composition.infantry).toBe(0);
    expect(Number.isFinite(repaired?.maxStrength)).toBe(true);
  });

  it('migrates version 1 saves without army history', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    for (const army of Object.values(state.armies)) {
      delete (army as { history?: string[] }).history;
    }
    const parsed = JSON.parse(encodeSave(state)) as { version: number; state: typeof state; checksum: string };
    parsed.version = 1;
    parsed.checksum = hashState(parsed.state);
    const loaded = decodeSave(JSON.stringify(parsed));
    expect(Object.values(loaded.armies).every(army => Array.isArray(army.history))).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(() => decodeSave('{not json')).toThrow(/合法 JSON/);
  });

  it('migrates version 5 saves without vassal fields', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const parsed = JSON.parse(encodeSave(state)) as { version: number; state: typeof state; checksum: string };
    parsed.version = 5;
    delete (parsed.state as { vassals?: Record<string, string> }).vassals;
    delete (parsed.state as { lastTribute?: Record<string, number> }).lastTribute;
    parsed.checksum = hashState(parsed.state);
    const loaded = decodeSave(JSON.stringify(parsed));
    expect(loaded.vassals).toEqual({});
    expect(loaded.lastTribute).toEqual({});
  });

  it('repairs invalid difficulty, spectator and map revision fields', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const parsed = JSON.parse(encodeSave(state)) as { version: number; state: typeof state; checksum: string };
    const mutable = parsed.state as unknown as { difficulty: string; spectator: boolean; mapRevision: number };
    mutable.difficulty = 'nightmare';
    mutable.spectator = false;
    mutable.mapRevision = 0;
    delete (mutable as { spectator?: boolean }).spectator;
    delete (mutable as { mapRevision?: number }).mapRevision;
    parsed.checksum = hashState(parsed.state);
    const loaded = decodeSave(JSON.stringify(parsed));
    expect(loaded.difficulty).toBe('normal');
    expect(loaded.spectator).toBe(false);
    expect(loaded.mapRevision).toBe(0);
  });

  it('migrates version 6 eight-class estates into the five-class model', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    const oldEstate = (key: string, influence: number, loyalty: number, taxLaw = 'tax_peasants_single_whip') => ({
      key: key as unknown as (typeof ming.estates)[string]['key'],
      influence,
      loyalty,
      income: 1200,
      taxLaw,
      privileges: key === 'gentry' ? ['priv_gentry_hidden_land'] : [],
      reform: null,
      cooldownDays: 0,
      collected: 100,
      effectiveRate: 0.05,
      customaryRate: 0.05,
    });
    ming.estates = {
      dynasty: oldEstate('dynasty', 5, 50),
      nobles: oldEstate('nobles', 5, 60),
      officials: oldEstate('officials', 10, 70),
      soldiers: oldEstate('soldiers', 40, 40, 'tax_soldiers_weisuo'),
      gentry: oldEstate('gentry', 20, 55, 'tax_gentry_exemption'),
      clergy: oldEstate('clergy', 5, 65, 'tax_clergy_exempt'),
      merchants: oldEstate('merchants', 10, 60, 'tax_merchants_inland_customs'),
      peasants: oldEstate('peasants', 5, 30, 'tax_peasants_single_whip'),
    };
    ming.allocation = {
      dynasty: 5, nobles: 5, officials: 5, soldiers: 5,
      gentry: 10, clergy: 10, merchants: 20, peasants: 40,
    };
    const army = Object.values(state.armies).find(entry => entry.tag === 'MING');
    if (!army) throw new Error('missing MING army');
    army.sourceEstate = 'soldiers';

    const parsed = JSON.parse(encodeSave(state)) as { version: number; state: typeof state; checksum: string };
    parsed.version = 6;
    parsed.checksum = hashState(parsed.state);
    const loaded = decodeSave(JSON.stringify(parsed));
    const migrated = loaded.countries['MING'];
    if (!migrated) throw new Error('missing migrated MING');

    expect(Object.keys(migrated.estates).sort()).toEqual(['artisans', 'landlords', 'merchants', 'peasants', 'ruling']);
    expect(migrated.estates['ruling']?.influence).toBeCloseTo(60 * 100 / 105, 6);
    expect(migrated.estates['ruling']?.loyalty).toBeCloseTo((5 * 50 + 5 * 60 + 10 * 70 + 40 * 40) / 60, 6);
    expect(migrated.estates['ruling']?.taxLaw).toBe('tax_officials_thin_salary');
    expect(migrated.estates['landlords']?.privileges).toContain('priv_gentry_hidden_land');
    expect(migrated.estates['artisans']?.influence).toBeCloseTo(5 * 100 / 105, 6);
    expect(Object.values(migrated.allocation).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 6);
    expect(Object.values(loaded.armies).find(entry => entry.id === army.id)?.sourceEstate).toBe('ruling');
    expect(migrated.lastReport).toBeNull();
    expect(Object.keys(loaded.countries['MONGOL']?.estates ?? {})).toHaveLength(3);
  });

  it('clamps impossible old casualty totals', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const war = state.wars[0];
    if (!war) throw new Error('missing war');
    war.casualties[war.attacker] = 1_000_000_000;
    const strength = Object.values(state.armies)
      .filter(army => army.tag === war.attacker)
      .reduce((sum, army) => sum + (army.maxStrength || 0), 0);
    const cap = Math.max(10000, strength * 6);
    const parsed = JSON.parse(encodeSave(state)) as { version: number; state: typeof state; checksum: string };
    parsed.checksum = hashState(parsed.state);
    const loaded = decodeSave(JSON.stringify(parsed));
    const loadedWar = loaded.wars[0];
    expect(loadedWar?.casualties[war.attacker]).toBe(cap);
  });
});
