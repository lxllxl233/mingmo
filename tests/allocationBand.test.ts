import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { dispatch } from '../src/engine/commands';
import { createInitialState } from '../src/engine/state/initial';
import {
  allocationMovementBand,
  distributeAllocation,
  estateAllocationFloor,
} from '../src/engine/systems/economy';
import { startTaxReform } from '../src/engine/systems/tax';

const content = loadContentFromDirectory();

describe('entrenched allocation band', () => {
  it('narrows the movable band as influence rises', () => {
    expect(allocationMovementBand(0)).toBe(16);
    expect(allocationMovementBand(33)).toBeCloseTo(7.75, 6);
    expect(allocationMovementBand(44)).toBeCloseTo(5, 6);
    expect(allocationMovementBand(100)).toBe(2);
  });

  it('locks a high-influence estate near its customary share until reform', () => {
    // 1627 明士绅：惯例 42%，影响力 33 → 可下调 7.75 个百分点。
    expect(estateAllocationFloor(content, 'MING', 'landlords', 33, false))
      .toBeCloseTo(34.25, 6);
    // 农民影响力低，可动幅度大得多。
    expect(estateAllocationFloor(content, 'MING', 'peasants', 4, false))
      .toBeCloseTo(9, 6);
    // 改革后只剩影响力政治底线。
    expect(estateAllocationFloor(content, 'MING', 'landlords', 33, true))
      .toBeLessThan(2);
  });

  it('clamps commands to the floor and unlocks after reform starts', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries.MING!;
    dispatch(state, { type: 'economy.setAllocation', estate: 'landlords', value: 0 }, content);
    expect(ming.allocation.landlords).toBeCloseTo(34.25, 1);
    // 抬高农民：目标值优先满足，但仍受其他阶级可动下限约束。
    dispatch(state, { type: 'economy.setAllocation', estate: 'peasants', value: 100 }, content);
    expect(ming.allocation.landlords).toBeCloseTo(34.25, 1);
    expect(ming.allocation.peasants).toBeCloseTo(48.99, 1);
    expect(Object.values(ming.allocation).reduce((sum, value) => sum + value, 0))
      .toBeCloseTo(100, 0);

    // 改革启动即解锁，可以真正动既得利益。
    ming.estates.landlords!.allocationUnlocked = true;
    dispatch(state, { type: 'economy.setAllocation', estate: 'landlords', value: 0 }, content);
    expect(ming.allocation.landlords).toBeLessThan(3);
  });

  it('unlocks the band when a tax reform starts', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries.MING!;
    ming.politicalPower = 100;
    expect(startTaxReform(state, content, 'MING', 'landlords', 'tax_clergy_estate', 50)).toBe(true);
    expect(ming.estates.landlords!.allocationUnlocked).toBe(true);
    dispatch(state, { type: 'economy.setAllocation', estate: 'landlords', value: 0 }, content);
    expect(ming.allocation.landlords).toBeLessThan(3);
  });

  it('normalizes values to 100 while preserving floors', () => {
    const result = distributeAllocation({ a: 0, b: 100 }, { a: 30, b: 20 });
    expect(result.a ?? 0).toBeCloseTo(30, 6);
    expect(result.b ?? 0).toBeCloseTo(70, 6);
    expect((result.a ?? 0) + (result.b ?? 0)).toBeCloseTo(100, 6);
  });
});
