import { describe, expect, it } from 'vitest';
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { startFocus } from '../src/engine/systems/focus';
import { startResearch } from '../src/engine/systems/research';
import { chooseEventOption, processEvents } from '../src/engine/systems/events';
import { evaluateTrigger } from '../src/engine/rules/triggers';
import { dispatch, CommandError } from '../src/engine/commands';
import { splitArmy } from '../src/engine/systems/military';
import { armyStrength } from '../src/engine/state/types';
import { applyEffects } from '../src/engine/rules/effects';
import { cleanupDefeatedNations, declareWar } from '../src/engine/rules/war';
import { scoreCountry } from '../src/engine/victory';
import { parseDay } from '../src/engine/core/clock';
import { evaluateVictory } from '../src/engine/victory';
import type { EventDef } from '../src/content/types';

const content = loadContentFromDirectory();

describe('focus and research', () => {
  it('completes a focus after its cost', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(startFocus(state, content, 'MING', 'ming_court_2')).toBe(true);
    for (let day = 0; day < 100; day += 1) advanceDay(state, content);
    expect(state.countries['MING']?.completedFocuses).toContain('ming_court_2');
  });

  it('completes a technology after its cost', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    expect(startResearch(state, content, 'MING', 'mil_bow')).toBe(true);
    for (let day = 0; day < 160; day += 1) advanceDay(state, content);
    expect(state.countries['MING']?.completedTechs).toContain('mil_bow');
  });
});

describe('event chains', () => {
  it('fires the jiashen chain and follows the chosen branch', () => {
    const state = createInitialState(content, '1644', 42, 'MING');
    state.day = parseDay('1644-02-01');
    advanceDay(state, content);
    const first = state.pendingEvents.find(event => event.eventId === 'MING_e_jiashen_1');
    expect(first).toBeDefined();
    expect(chooseEventOption(state, content, 'MING_e_jiashen_1', 'summon_wu')).toBe(true);
    expect(state.countries['MING']?.flags['jiashen_started']).toBe(true);

    state.day = parseDay('1644-03-02');
    advanceDay(state, content);
    const second = state.pendingEvents.find(event => event.eventId === 'MING_e_jiashen_2');
    expect(second).toBeDefined();
    expect(chooseEventOption(state, content, 'MING_e_jiashen_2', 'open_to_qing')).toBe(true);
    expect(state.provinces['shanhaiguan']?.owner).toBe('QING');
  });

  it('does not refire a fire-once event from the queue', () => {
    const state = createInitialState(content, '1644', 42, 'MING');
    state.day = parseDay('1644-02-01');
    state.firedEvents['MING_e_jiashen_1:MING'] = state.day - 1;
    state.eventQueue.push({ eventId: 'MING_e_jiashen_1', country: 'MING', dueDay: state.day });
    processEvents(state, content);
    expect(state.pendingEvents.some(event => event.eventId === 'MING_e_jiashen_1')).toBe(false);
  });

  it('rejects an option whose trigger is not met and keeps the event pending', () => {
    const state = createInitialState(content, '1644', 42, 'MING');
    const events = content.events as Map<string, EventDef>;
    const event: EventDef = {
      id: 'TEST_locked_option',
      title: 'test',
      desc: 'test',
      scope: 'country',
      country: 'MING',
      trigger: { hasFlag: 'never_set' },
      fireOnce: true,
      options: [
        { id: 'locked', name: 'locked', trigger: { hasFlag: 'never_set' }, effect: [] },
      ],
    };
    events.set(event.id, event);
    state.pendingEvents.push({ eventId: event.id, country: 'MING', firedDay: state.day });
    expect(chooseEventOption(state, content, event.id, 'locked')).toBe(false);
    expect(state.pendingEvents.some(pending => pending.eventId === event.id)).toBe(true);
    events.delete(event.id);
  });
});

describe('triggers and decisions', () => {
  it('treats a missing estate as failing the trigger', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    delete ming.estates['artisans'];
    expect(evaluateTrigger({ estateLoyalty: { artisans: { gte: 0 } } }, {
      state, content, country: 'MING',
    })).toBe(false);
    expect(evaluateTrigger({ estateInfluence: { artisans: { gte: 0 } } }, {
      state, content, country: 'MING',
    })).toBe(false);
  });

  it('allows a decision again once its absolute cooldown day has passed', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const nation = state.countries['MING'];
    const decision = [...content.decisions.values()].find(entry => entry.country === 'MING');
    if (!nation || !decision) throw new Error('missing MING decision');
    nation.treasury = 10000000;
    nation.food = 10000000;
    nation.politicalPower = 1000;
    dispatch(state, { type: 'decision.take', decisionId: decision.id }, content);
    expect(nation.cooldowns[decision.id]).toBe(state.day + decision.cooldownDays);
    expect(() => dispatch(state, { type: 'decision.take', decisionId: decision.id }, content))
      .toThrow(CommandError);
    state.day += decision.cooldownDays;
    expect(() => dispatch(state, { type: 'decision.take', decisionId: decision.id }, content))
      .not.toThrow();
  });
});

describe('timed modifiers and cleanup', () => {
  it('gives a modifier its full duration even when added after the daily consumers', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    applyEffects([{ addCountryModifier: { modifier: 'smuggling', days: 2 } }], {
      state, content, country: 'MING',
    });
    const count = () => state.countries['MING']?.timedModifiers
      .filter(modifier => modifier.id === 'smuggling').length ?? 0;
    expect(count()).toBe(1);
    advanceDay(state, content);
    expect(count()).toBe(1);
    advanceDay(state, content);
    expect(count()).toBe(0);
  });

  it('removes wars involving a nation that died during the tick', () => {
    const state = createInitialState(content, '1627', 42, 'ZHENG');
    expect(declareWar(state, 'ZHENG', 'VOC', 'test', content)).not.toBeNull();
    for (const province of Object.values(state.provinces)) {
      if (province.owner === 'VOC') province.owner = 'ZHENG';
    }
    const occupied = state.provinces['anping'];
    if (occupied) occupied.controller = 'VOC';
    const voc = state.countries['VOC'];
    if (!voc) throw new Error('missing VOC');
    voc.alive = false;
    cleanupDefeatedNations(state, content);
    expect(state.wars.some(war => war.attacker === 'VOC' || war.defender === 'VOC')).toBe(false);
    expect(Object.values(state.provinces).some(province => province.controller === 'VOC')).toBe(false);
  });
});

describe('army splitting', () => {
  it('never creates negative or invented composition', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const army = Object.values(state.armies).find(entry => entry.tag === 'MING');
    if (!army) throw new Error('missing MING army');
    army.composition = { infantry: 0, firearm: 1, cavalry: 1, artillery: 0, naval: 0 };
    army.maxStrength = 2;
    const splitId = splitArmy(state, content, army.id, 1);
    expect(splitId).not.toBeNull();
    if (!splitId) return;
    const split = state.armies[splitId];
    if (!split) throw new Error('missing split army');
    expect(armyStrength(split)).toBe(1);
    expect(armyStrength(army)).toBe(1);
    for (const value of Object.values(split.composition)) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of Object.values(army.composition)) expect(value).toBeGreaterThanOrEqual(0);
  });
});

describe('victory', () => {
  it('ends the game the day a unification is reached, not only at year start', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    for (const province of Object.values(state.provinces)) {
      province.owner = 'MING';
      province.controller = 'MING';
    }
    state.day = parseDay('1650-06-15');
    advanceDay(state, content);
    expect(state.ended).toBe(true);
    expect(state.victory?.reason).toBe('一统天下');
  });

  it('scores live province population instead of static content values', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const capital = state.countries['MING']?.capital ?? 'beijing';
    const province = state.provinces[capital];
    if (!province) throw new Error('missing capital');
    const before = scoreCountry(state, content, 'MING').breakdown['人口'] ?? 0;
    province.population += 1_000_000;
    const after = scoreCountry(state, content, 'MING').breakdown['人口'] ?? 0;
    expect(after).toBe(before + 1);
  });

  it('detects a unified China', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    for (const province of Object.values(state.provinces)) {
      province.owner = 'MING';
      province.controller = 'MING';
    }
    state.day = parseDay('1683-12-31');
    const result = evaluateVictory(state, content);
    expect(result.reason).toBe('一统天下');
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown['疆域']).toBeGreaterThan(0);
  });
});

describe('content effects route through estates', () => {
  it('changes every estate loyalty without touching stability directly', () => {
    const state = createInitialState(content, '1627', 42, 'MING');
    const ming = state.countries['MING'];
    if (!ming) throw new Error('missing MING');
    const stabilityBefore = ming.stability;
    const loyaltyBefore = Object.fromEntries(
      Object.entries(ming.estates).map(([key, estate]) => [key, estate.loyalty]),
    );
    applyEffects([{ addAllEstateLoyalty: 5 }], { state, content, country: 'MING' });
    expect(ming.stability).toBe(stabilityBefore);
    for (const [key, estate] of Object.entries(ming.estates)) {
      expect(estate.loyalty).toBeCloseTo((loyaltyBefore[key] ?? 0) + 5, 6);
    }
  });
});

