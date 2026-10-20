import { describe, expect, it } from 'vitest';
import {
  LAST_DAY_INDEX,
  START_YEAR,
  TOTAL_DAYS,
  dayOfYear,
  daysInMonth,
  formatDate,
  fromDayIndex,
  isInRange,
  isLeapYear,
  isMonthStart,
  isQuarterStart,
  isYearStart,
  parseDay,
  toDayIndex,
} from '../src/engine/core/clock';

describe('game clock', () => {
  it('follows the Gregorian leap-year rule', () => {
    expect(isLeapYear(1600)).toBe(true);
    expect(isLeapYear(1644)).toBe(true);
    expect(isLeapYear(1700)).toBe(false);
    expect(isLeapYear(1683)).toBe(false);
    expect(daysInMonth(1644, 2)).toBe(29);
    expect(daysInMonth(1645, 2)).toBe(28);
    expect(daysInMonth(1644, 4)).toBe(30);
    expect(daysInMonth(1644, 12)).toBe(31);
    expect(() => daysInMonth(1644, 13)).toThrow(/invalid month/);
    expect(() => daysInMonth(1644, 0)).toThrow(/invalid month/);
    expect(() => daysInMonth(1644, 1.5)).toThrow(/invalid month/);
  });

  it('anchors day 0 at the start year and the last day at the end year', () => {
    expect(toDayIndex(START_YEAR, 1, 1)).toBe(0);
    expect(fromDayIndex(0)).toEqual({ year: 1616, month: 1, day: 1, dayIndex: 0 });
    expect(fromDayIndex(LAST_DAY_INDEX)).toEqual({ year: 1683, month: 12, day: 31, dayIndex: LAST_DAY_INDEX });
    expect(TOTAL_DAYS).toBe(LAST_DAY_INDEX + 1);
    expect(isInRange(0)).toBe(true);
    expect(isInRange(LAST_DAY_INDEX)).toBe(true);
    expect(isInRange(-1)).toBe(false);
    expect(isInRange(LAST_DAY_INDEX + 1)).toBe(false);
  });

  it('round-trips ISO dates including leap days', () => {
    expect(parseDay('1644-02-29')).toBe(toDayIndex(1644, 2, 29));
    expect(formatDate(parseDay('1644-02-29'))).toBe('1644-02-29');
    expect(formatDate(parseDay('1683-12-31'))).toBe('1683-12-31');
    expect(parseDay('1644-02-29')).toBe(parseDay('1644-02-29'));
    expect(() => parseDay('1644-2-9')).toThrow(/YYYY-MM-DD/);
    expect(() => parseDay('1645-02-29')).toThrow(/invalid day/);
    expect(() => toDayIndex(1644, 13, 1)).toThrow(/invalid month/);
    expect(() => toDayIndex(1644, 4, 31)).toThrow(/invalid day/);
  });

  it('detects month, quarter and year starts', () => {
    expect(isMonthStart(toDayIndex(1644, 3, 1))).toBe(true);
    expect(isMonthStart(toDayIndex(1644, 3, 2))).toBe(false);
    expect(isQuarterStart(toDayIndex(1644, 4, 1))).toBe(true);
    expect(isQuarterStart(toDayIndex(1644, 5, 1))).toBe(false);
    expect(isYearStart(toDayIndex(1644, 1, 1))).toBe(true);
    expect(isYearStart(toDayIndex(1644, 2, 1))).toBe(false);
  });

  it('counts days of year with leap-day compensation', () => {
    expect(dayOfYear(toDayIndex(1644, 1, 1))).toBe(1);
    expect(dayOfYear(toDayIndex(1644, 3, 1))).toBe(61);
    expect(dayOfYear(toDayIndex(1645, 3, 1))).toBe(60);
    expect(dayOfYear(toDayIndex(1683, 12, 31))).toBe(365);
  });

  it('rejects non-integer day indices', () => {
    expect(() => fromDayIndex(1.5)).toThrow(/integer/);
    expect(() => fromDayIndex(Number.NaN)).toThrow(/integer/);
  });
});
