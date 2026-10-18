import { describe, expect, it } from 'vitest';
import {
  LAST_DAY_INDEX,
  TOTAL_DAYS,
  dayOfYear,
  formatDate,
  fromDayIndex,
  isLeapYear,
  isMonthStart,
  isQuarterStart,
  isYearStart,
  parseDay,
  toDayIndex,
} from '../src/engine/core/clock';
import { hashSeed, mulberry32, rngFor } from '../src/engine/core/rng';

describe('clock', () => {
  it('anchors the game window', () => {
    expect(toDayIndex(1616, 1, 1)).toBe(0);
    expect(toDayIndex(1683, 12, 31)).toBe(24836);
    expect(TOTAL_DAYS).toBe(24837);
    expect(LAST_DAY_INDEX).toBe(24836);
  });

  it('handles leap years and month lengths', () => {
    expect(isLeapYear(1616)).toBe(true);
    expect(isLeapYear(1700)).toBe(false);
    expect(isLeapYear(1644)).toBe(true);
    expect(toDayIndex(1616, 2, 29)).toBe(59);
    expect(toDayIndex(1616, 3, 1)).toBe(60);
    expect(toDayIndex(1644, 1, 1)).toBe(10227);
    expect(() => toDayIndex(1617, 2, 29)).toThrow();
  });

  it('round-trips every day without Date', () => {
    for (let day = 0; day <= LAST_DAY_INDEX; day += 97) {
      const date = fromDayIndex(day);
      expect(toDayIndex(date.year, date.month, date.day)).toBe(day);
    }
    expect(formatDate(0)).toBe('1616-01-01');
    expect(formatDate(24836)).toBe('1683-12-31');
  });

  it('detects boundaries', () => {
    expect(isMonthStart(0)).toBe(true);
    expect(isMonthStart(1)).toBe(false);
    expect(isYearStart(0)).toBe(true);
    expect(isQuarterStart(toDayIndex(1616, 4, 1))).toBe(true);
    expect(isQuarterStart(toDayIndex(1616, 5, 1))).toBe(false);
    expect(dayOfYear(toDayIndex(1616, 12, 31))).toBe(366);
    expect(parseDay('1644-01-01')).toBe(10227);
  });

  it('rejects malformed dates', () => {
    expect(() => parseDay('1644/01/01')).toThrow();
    expect(() => parseDay('1644-13-01')).toThrow();
    expect(() => parseDay('1644-02-30')).toThrow();
  });
});

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(8);
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(42).next();
    const b = mulberry32(43).next();
    expect(a).not.toBe(b);
  });

  it('respects integer bounds and picks', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.int(-3, 5);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(5);
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(rng.pick(['a', 'b', 'c'])).toMatch(/^[abc]$/);
    expect(() => rng.pick([])).toThrow();
  });

  it('derives independent daily streams', () => {
    const a = rngFor(42, 100, 'battle');
    const b = rngFor(42, 100, 'battle');
    const c = rngFor(42, 101, 'battle');
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
    expect(rngFor(42, 100, 'battle').next()).not.toBe(rngFor(42, 100, 'economy').next());
    expect(c.next()).not.toBe(rngFor(42, 100, 'battle').next());
  });

  it('hashes stably', () => {
    expect(hashSeed(42, 7, 'battle')).toBe(hashSeed(42, 7, 'battle'));
    expect(hashSeed(42, 7, 'battle')).not.toBe(hashSeed(42, 7, 'economy'));
  });
});
