import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { parseDay } from '../src/engine/core/clock';
import { eventTargets, processEvents } from '../src/engine/systems/events';
import type { EventDef } from '../src/content/types';

const content = loadContentFromDirectory();

describe('generic event targeting', () => {
  it('only sends country:any events to Chinese polities, not Mongolia/Korea/Japan/Tibet', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const event = content.events.get('shared_e_royal_stipend');
    expect(event).toBeDefined();
    if (!event) return;

    const targets = eventTargets(state, content, event);
    expect(targets).toContain('MING');
    expect(targets).toContain('QING');
    expect(targets).toContain('SHUN');
    expect(targets).toContain('XI');
    expect(targets).not.toContain('MONGOL');
    expect(targets).not.toContain('JOSEON');
    expect(targets).not.toContain('JAPAN');
    expect(targets).not.toContain('TIBET');
    expect(targets).not.toContain('VOC');
    expect(targets).not.toContain('RUSSIA');
    expect(targets).not.toContain('NEU');
  });

  it('honours an explicit tags allowlist for cross-culture events', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const event: EventDef = {
      id: 'TEST_cross_culture',
      title: 'test',
      desc: 'test',
      scope: 'country',
      country: 'any',
      tags: ['JOSEON', 'JAPAN'],
      trigger: { date: { after: '1600-01-01' } },
      fireOnce: true,
      options: [
        { id: 'a', name: 'a', effect: [] },
        { id: 'b', name: 'b', effect: [] },
      ],
    };
    expect(eventTargets(state, content, event)).toEqual(['JOSEON', 'JAPAN']);
  });
});

describe('event pacing', () => {
  function syntheticEvent(id: string, title: string): EventDef {
    return {
      id,
      title,
      desc: 'test',
      scope: 'country',
      country: 'MING',
      trigger: { date: { after: '1600-01-01' } },
      fireOnce: true,
      options: [
        { id: 'a', name: 'a', effect: [] },
        { id: 'b', name: 'b', effect: [] },
      ],
    };
  }

  it('does not fire two same-title events for the same country within the group cooldown', () => {
    const state = createInitialState(content, '1627', 42, 'MING', 'normal', false);
    // 晚上无内容事件窗口，避免真实事件干扰断言。
    state.day = parseDay('1690-01-01');
    const events = content.events as Map<string, EventDef>;
    const first = syntheticEvent('TEST_group_a', '测试事件族');
    const second = syntheticEvent('TEST_group_b', '测试事件族');
    events.set(first.id, first);
    events.set(second.id, second);
    try {
      processEvents(state, content);
      const firstFired = state.firedEvents[`${first.id}:MING`] !== undefined;
      const secondFired = state.firedEvents[`${second.id}:MING`] !== undefined;
      expect(firstFired || secondFired).toBe(true);
      state.pendingEvents.length = 0;

      state.day += 1;
      processEvents(state, content);
      if (firstFired) expect(state.firedEvents[`${second.id}:MING`]).toBeUndefined();
      else expect(state.firedEvents[`${first.id}:MING`]).toBeUndefined();
    } finally {
      events.delete(first.id);
      events.delete(second.id);
    }
  });

  it('spaces random events at least the gap apart', () => {
    const state = createInitialState(content, '1627', 42, 'MING', 'normal', false);
    state.day = parseDay('1690-01-01');
    const events = content.events as Map<string, EventDef>;
    const first = syntheticEvent('TEST_gap_a', '测试间隔甲');
    const second = syntheticEvent('TEST_gap_b', '测试间隔乙');
    events.set(first.id, first);
    events.set(second.id, second);
    try {
      processEvents(state, content);
      expect(state.firedEvents[`${first.id}:MING`] ?? state.firedEvents[`${second.id}:MING`]).toBeDefined();
      state.pendingEvents.length = 0;

      state.day += 1;
      processEvents(state, content);
      const firedAfterOneDay = state.firedEvents[`${first.id}:MING`] !== undefined
        && state.firedEvents[`${second.id}:MING`] !== undefined;
      expect(firedAfterOneDay).toBe(false);

      state.day += 30;
      processEvents(state, content);
      expect(state.firedEvents[`${first.id}:MING`]).toBeDefined();
      expect(state.firedEvents[`${second.id}:MING`]).toBeDefined();
    } finally {
      events.delete(first.id);
      events.delete(second.id);
    }
  });
});
