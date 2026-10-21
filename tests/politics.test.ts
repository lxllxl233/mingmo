import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { minimumAllocationShare } from '../src/engine/systems/economy';
import { driftedInfluence, runMonthlyPolitics } from '../src/engine/systems/politics';

const content = loadContentFromDirectory();

describe('allocation → influence → minimum', () => {
  it('drifts influence by two points per share percentage point', () => {
    // share 0.40 vs customary 0.25 → +0.15 × 2 = +0.30
    expect(driftedInfluence(40, 0.4, 0.25)).toBeCloseTo(40.3, 5);
    expect(driftedInfluence(40, 0.1, 0.25)).toBeCloseTo(39.7, 5);
    // 不越界
    expect(driftedInfluence(99.9, 1, 0)).toBe(100);
    expect(driftedInfluence(0.1, 0, 1)).toBe(0);
  });

  it('raises the influence of an estate granted more than its customary share', () => {
    const state = createInitialState(content, '1627', 42, 'MING', 'normal');
    state.day = 15; // 非季初，避免季度归一化掩盖单月漂移
    const nation = state.countries.MING!;
    const peasants = nation.estates.peasants!;
    const landlords = nation.estates.landlords!;
    const peasantBefore = peasants.influence;
    const landlordBefore = landlords.influence;
    const peasantMinimumBefore = minimumAllocationShare(peasantBefore);
    // 把 20 个百分点从士绅转给农民。
    const granted = (nation.allocation.peasants ?? 0) + 20;
    nation.allocation.peasants = granted;
    nation.allocation.landlords = (nation.allocation.landlords ?? 0) - 20;

    runMonthlyPolitics(state, content);

    // 0.2 的份额差 × 2 = 0.4 影响力/月。
    expect(peasants.influence - peasantBefore).toBeCloseTo(0.4, 3);
    expect(landlords.influence - landlordBefore).toBeCloseTo(-0.4, 3);
    // 影响力随后决定最低分配份额：这是「越分越多、底线随之上移」的反馈。
    expect(minimumAllocationShare(peasants.influence)).toBeGreaterThan(peasantMinimumBefore);
    // 政治月结只漂移影响力，不改写玩家设定的分配。
    expect(nation.allocation.peasants).toBe(granted);
  });

  it('keeps influence relative changes when quarterly normalization runs', () => {
    const state = createInitialState(content, '1627', 42, 'MING', 'normal');
    const nation = state.countries.MING!;
    const peasants = nation.estates.peasants!;
    const landlords = nation.estates.landlords!;
    const before = peasants.influence / landlords.influence;
    nation.allocation.peasants = (nation.allocation.peasants ?? 0) + 20;
    nation.allocation.landlords = (nation.allocation.landlords ?? 0) - 20;

    runMonthlyPolitics(state, content); // 季初仍会漂移后再归一化

    const total = Object.values(nation.estates)
      .reduce((sum, estate) => sum + estate.influence, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(peasants.influence / landlords.influence).toBeGreaterThan(before);
  });
});
