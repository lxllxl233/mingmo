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
