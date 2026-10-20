import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceCrisis, debtCombatPenalty } from '../src/engine/systems/crisis';
import { maybeFoundSouthernMing } from '../src/engine/systems/southernMing';
import { parseDay } from '../src/engine/core/clock';
import type { MonthlyReport } from '../src/engine/state/types';

const SOUTHERN_REGIONS = new Set([
  'reg_nanzhili', 'reg_zhejiang', 'reg_jiangxi', 'reg_huguang', 'reg_fujian',
  'reg_guangdong', 'reg_guangxi', 'reg_yunnan', 'reg_guizhou',
]);

const content = loadContentFromDirectory();

describe('fiscal collapse', () => {
  it('partitions Ming territory without founding Southern Ming before 1644', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    ming.fiscalCrisisDays = 730;
    ming.treasury = 0;
    ming.arrears = 1000000;
    ming.flags['army_paid_in_full'] = false;
    advanceCrisis(state, content);
    expect(ming.alive).toBe(false);
    expect(state.countries['SMING']?.alive).toBe(false);
    const orphaned = Object.values(state.provinces).filter(province =>
      province.owner === 'MING' || province.controller === 'MING');
    expect(orphaned).toHaveLength(0);
  });

  it('founds Southern Ming when AI Ming collapses in 1644', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    ming.fiscalCrisisDays = 730;
    ming.treasury = 0;
    ming.arrears = 1000000;
    ming.flags['army_paid_in_full'] = false;
    advanceCrisis(state, content);
    expect(ming.alive).toBe(false);
    const sming = state.countries['SMING'];
    expect(sming?.alive).toBe(true);
    const capital = sming ? state.provinces[sming.capital] : undefined;
    expect(capital?.owner).toBe('SMING');
    expect(capital?.controller).toBe('SMING');
    const orphaned = Object.values(state.provinces).filter(province =>
      province.owner === 'MING' || province.controller === 'MING');
    expect(orphaned).toHaveLength(0);
  });

  it('does not transfer provinces owned by Ming but controlled by a third party', () => {
    const state = createInitialState(content, '1644', 42, 'QING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    state.day = parseDay('1644-06-01');
    expect(ming.alive).toBe(true);
    const beijing = state.provinces['beijing'];
    if (beijing) beijing.controller = 'QING';
    const southern = Object.values(state.provinces).filter(province => {
      const regionId = content.provinces.get(province.id)?.regionId ?? '';
      return province.owner === 'MING' && province.controller === 'MING' && SOUTHERN_REGIONS.has(regionId);
    });
    expect(southern.length).toBeGreaterThan(1);
    const inherited = southern[0];
    const occupied = southern[1];
    if (!inherited || !occupied) throw new Error('missing southern provinces');
    occupied.controller = 'SHUN';
    maybeFoundSouthernMing(state, content);
    expect(state.countries['SMING']?.alive).toBe(true);
    expect(inherited.owner).toBe('SMING');
    expect(inherited.controller).toBe('SMING');
    expect(occupied.owner).toBe('MING');
    expect(occupied.controller).toBe('SHUN');
  });

  it('debt combat penalty: wage arrears cripple, other debt caps at -10%', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    ming.lastReport = { expenseArmy: 100000 } as MonthlyReport;
    // 无债务：无削弱
    expect(debtCombatPenalty(ming)).toBe(0);
    // 其他债务 100 万：-10%（封顶）
    ming.arrears = 1000000;
    ming.wageArrears = 0;
    expect(debtCombatPenalty(ming)).toBe(-10);
    // 欠饷 6 个月军饷：-80%（接近无战力）
    ming.arrears = 600000;
    ming.wageArrears = 600000;
    expect(debtCombatPenalty(ming)).toBe(-80);
  });
});
