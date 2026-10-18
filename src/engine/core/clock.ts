/**
 * 游戏日历。
 *
 * 1 tick = 1 日。day 0 = 1616-01-01，day 24836 = 1683-12-31。
 * 使用 proleptic Gregorian（与 JavaScript Date 的 UTC 日历一致），
 * 但整个模拟不依赖 Date / 时区 / Date.now()。
 */

export const START_YEAR = 1616;
export const END_YEAR = 1683;
export const START_MONTH = 1;
export const START_DAY_OF_MONTH = 1;

export interface GameDate {
  year: number;
  month: number;
  day: number;
  dayIndex: number;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`invalid month: ${month}`);
  }
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  const length = MONTH_LENGTHS[month - 1];
  if (length === undefined) throw new Error(`invalid month: ${month}`);
  return length;
}

/** Howard Hinnant 的 days_from_civil；返回相对 1970-01-01 的天数。 */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** 逆运算；返回公历日期。 */
function civilFromDays(absoluteDay: number): { year: number; month: number; day: number } {
  const z = absoluteDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

const START_ABSOLUTE_DAY = daysFromCivil(START_YEAR, START_MONTH, START_DAY_OF_MONTH);
const END_ABSOLUTE_DAY = daysFromCivil(END_YEAR, 12, 31);

export const TOTAL_DAYS = END_ABSOLUTE_DAY - START_ABSOLUTE_DAY + 1;
export const LAST_DAY_INDEX = TOTAL_DAYS - 1;

function assertValidDate(year: number, month: number, day: number): void {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`invalid date: ${year}-${month}-${day}`);
  }
  if (month < 1 || month > 12) throw new Error(`invalid month: ${month}`);
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`invalid day: ${year}-${String(month).padStart(2, '0')}-${day}`);
  }
}

/** 任意公历日期 → day index（相对 1616-01-01）。允许负数，便于事件写前史。 */
export function toDayIndex(year: number, month: number, day: number): number {
  assertValidDate(year, month, day);
  return daysFromCivil(year, month, day) - START_ABSOLUTE_DAY;
}

/** "1644-01-01" → day index。 */
export function parseDay(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`expected YYYY-MM-DD, got: ${isoDate}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return toDayIndex(year, month, day);
}

/** day index → GameDate。允许负数与超出终局，调用方自行裁剪。 */
export function fromDayIndex(dayIndex: number): GameDate {
  if (!Number.isInteger(dayIndex)) throw new Error(`dayIndex must be integer: ${dayIndex}`);
  const { year, month, day } = civilFromDays(dayIndex + START_ABSOLUTE_DAY);
  return { year, month, day, dayIndex };
}

export function formatDate(dayIndex: number): string {
  const date = fromDayIndex(dayIndex);
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function isMonthStart(dayIndex: number): boolean {
  return fromDayIndex(dayIndex).day === 1;
}

export function isQuarterStart(dayIndex: number): boolean {
  const date = fromDayIndex(dayIndex);
  return date.day === 1 && (date.month - 1) % 3 === 0;
}

export function isYearStart(dayIndex: number): boolean {
  const date = fromDayIndex(dayIndex);
  return date.month === 1 && date.day === 1;
}

export function dayOfYear(dayIndex: number): number {
  const date = fromDayIndex(dayIndex);
  return toDayIndex(date.year, date.month, date.day) - toDayIndex(date.year, 1, 1) + 1;
}

export function isInRange(dayIndex: number): boolean {
  return dayIndex >= 0 && dayIndex <= LAST_DAY_INDEX;
}
