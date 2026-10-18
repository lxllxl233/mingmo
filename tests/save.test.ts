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
});
