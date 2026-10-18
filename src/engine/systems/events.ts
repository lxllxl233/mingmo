import type { ContentIndex, EventDef, EventOption } from '../../content/types';
import { rngFor } from '../core/rng';
import { applyEffects } from '../rules/effects';
import { evaluateTrigger } from '../rules/triggers';
import type { GameState } from '../state/types';

function firedKey(eventId: string, country: string): string {
  return `${eventId}:${country}`;
}

function canFire(state: GameState, event: EventDef, country: string): boolean {
  const key = firedKey(event.id, country);
  const firedDay = state.firedEvents[key];
  if (firedDay === undefined) return true;
  if (event.repeatable && event.cooldownDays !== undefined) {
    return state.day - firedDay >= event.cooldownDays;
  }
  return !event.fireOnce;
}

function optionAvailable(state: GameState, content: ContentIndex, country: string, option: EventOption): boolean {
  return option.trigger === undefined
    || evaluateTrigger(option.trigger, { state, content, country });
}

function pickAiOption(state: GameState, content: ContentIndex, event: EventDef, country: string): EventOption | undefined {
  const options = event.options.filter(option => optionAvailable(state, content, country, option));
  if (options.length === 0) return undefined;
  if (event.aiChoice) {
    const chosen = options.find(option => option.id === event.aiChoice);
    if (chosen) return chosen;
  }
  const weighted = options.filter(option => (option.aiChance ?? 0) > 0);
  if (weighted.length === 0) return options[0];
  const total = weighted.reduce((sum, option) => sum + (option.aiChance ?? 0), 0);
  const rng = rngFor(state.seed, state.day, `ai-event:${event.id}:${country}`);
  let roll = rng.next() * total;
  for (const option of weighted) {
    roll -= option.aiChance ?? 0;
    if (roll <= 0) return option;
  }
  return weighted[0] ?? options[0];
}

export function fireEvent(
  state: GameState,
  content: ContentIndex,
  event: EventDef,
  country: string,
  province?: string,
): void {
  if (!state.countries[country]?.alive) return;
  state.firedEvents[firedKey(event.id, country)] = state.day;
  state.stats.eventsFired += 1;
  if (country === state.playerTag && !state.spectator) {
    const pending = { eventId: event.id, country, firedDay: state.day };
    if (event.chain) state.pendingEvents.unshift(pending);
    else state.pendingEvents.push(pending);
    if (province) {
      const target = event.chain ? state.pendingEvents[0] : state.pendingEvents[state.pendingEvents.length - 1];
      if (target) target.province = province;
    }
    return;
  }
  const option = pickAiOption(state, content, event, country);
  if (option) {
    const context = { state, content, country, ...(province === undefined ? {} : { province }) };
    applyEffects(option.effect, context);
    state.log.push({
      day: state.day,
      category: 'event',
      country,
      text: `${content.countries.get(country)?.name ?? country}：${event.title} → ${option.name}`,
      severity: 'info',
    });
  }
}

export function chooseEventOption(
  state: GameState,
  content: ContentIndex,
  eventId: string,
  optionId: string,
): boolean {
  const pendingIndex = state.pendingEvents.findIndex(event => event.eventId === eventId);
  if (pendingIndex < 0) return false;
  const pending = state.pendingEvents[pendingIndex];
  if (!pending) return false;
  const event = content.events.get(eventId);
  const option = event?.options.find(entry => entry.id === optionId);
  if (!event || !option) return false;
  const context = { state, content, country: pending.country, ...(pending.province === undefined ? {} : { province: pending.province }) };
  applyEffects(option.effect, context);
  state.pendingEvents.splice(pendingIndex, 1);
  state.log.push({
    day: state.day,
    category: 'event',
    country: pending.country,
    text: `${event.title} → ${option.name}`,
    severity: 'info',
  });
  return true;
}

const SHARED_EVENT_TAGS = new Set(['MING', 'QING', 'SHUN', 'XI', 'SMING', 'ZHENG', 'MONGOL', 'JOSEON']);

function targetsFor(event: EventDef, state: GameState): string[] {
  if (event.country && event.country !== 'any') return [event.country];
  return Object.values(state.countries)
    .filter(country => country.alive && SHARED_EVENT_TAGS.has(country.tag))
    .map(country => country.tag);
}

export function processEvents(state: GameState, content: ContentIndex): void {
  const due = state.eventQueue.filter(entry => entry.dueDay <= state.day);
  state.eventQueue = state.eventQueue.filter(entry => entry.dueDay > state.day);
  for (const entry of due) {
    const event = content.events.get(entry.eventId);
    if (!event) continue;
    if (event.trigger && !evaluateTrigger(event.trigger, { state, content, country: entry.country })) {
      const attempts = (entry.attempts ?? 0) + 1;
      if (attempts < 16) {
        state.eventQueue.push({ ...entry, dueDay: state.day + 7, attempts });
      }
      continue;
    }
    fireEvent(state, content, event, entry.country, entry.province);
  }

  for (const event of content.events.values()) {
    for (const country of targetsFor(event, state)) {
      if (!canFire(state, event, country)) continue;
      if (event.trigger && !evaluateTrigger(event.trigger, { state, content, country })) continue;
      if (event.mtth !== undefined) {
        const rng = rngFor(state.seed, state.day, `event:${event.id}:${country}`);
        if (rng.next() >= 1 / event.mtth) continue;
      }
      fireEvent(state, content, event, country);
      if (state.pendingEvents.length >= 8) return;
    }
  }
}
