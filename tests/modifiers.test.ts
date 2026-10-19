import { describe, expect, it } from 'vitest';
import { MODIFIER_DEFS, MODIFIER_KEYS, modifierLabel } from '../src/content/modifierRegistry';
import { validateModifier } from '../src/content/loader/validate';

describe('modifier registry', () => {
  it('has metadata for every key', () => {
    expect(MODIFIER_KEYS.size).toBeGreaterThan(20);
    for (const key of MODIFIER_KEYS) {
      const def = (MODIFIER_DEFS as Record<string, { label: string; consumer: string; description: string }>)[key];
      expect(def, key).toBeDefined();
      expect(def?.label.length, key).toBeGreaterThan(0);
      expect(def?.consumer.length, key).toBeGreaterThan(0);
      expect(def?.description.length, key).toBeGreaterThan(0);
    }
  });

  it('accepts every registered key', () => {
    for (const key of MODIFIER_KEYS) {
      expect(() => validateModifier({ [key]: 1 }, 'test', 'modifier')).not.toThrow();
    }
  });

  it('rejects an unregistered key', () => {
    expect(() => validateModifier({ not_a_modifier: 1 }, 'test', 'modifier')).toThrow();
  });

  it('falls back to the key when a label is missing', () => {
    expect(modifierLabel('not_a_modifier')).toBe('not_a_modifier');
  });
});
