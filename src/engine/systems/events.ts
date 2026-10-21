import type { ContentIndex, EventDef, EventOption } from '../../content/types';
import { rngFor } from '../core/rng';
import { applyEffects } from '../rules/effects';
import { evaluateTrigger } from '../rules/triggers';
import type { GameState } from '../state/types';

function firedKey(eventId: string, country: string): string {
  return `${eventId}:${country}`;
}

/** 同名/同族事件（如「大疫」「黄河决口」各有两条内容）在同一势力内不重复弹出。 */
const EVENT_GROUP_COOLDOWN_DAYS = 400;
/** 同一势力的随机事件最小间隔，避免事件连续打断游玩。剧情链与显式排队事件不受限制。 */
const RANDOM_EVENT_GAP_DAYS = 21;
const RANDOM_EVENT_GAP_KEY = 'random-event';

function groupKey(event: EventDef): string {
  return `event-group:${event.group ?? event.title}`;
}

function groupBlocked(state: GameState, event: EventDef, country: string): boolean {
  if (event.chain) return false;
  return state.day < (state.countries[country]?.cooldowns[groupKey(event)] ?? 0);
}

function canFire(state: GameState, event: EventDef, country: string, ignoreGroup = false): boolean {
  const key = firedKey(event.id, country);
  const firedDay = state.firedEvents[key];
  if (firedDay === undefined) {
    return ignoreGroup || !groupBlocked(state, event, country);
  }
  if (event.repeatable && event.cooldownDays !== undefined) {
    return state.day - firedDay >= event.cooldownDays && (ignoreGroup || !groupBlocked(state, event, country));
  }
  return !event.fireOnce && (ignoreGroup || !groupBlocked(state, event, country));
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
  const nation = state.countries[country];
  if (!nation?.alive) return;
  nation.cooldowns[groupKey(event)] = state.day + EVENT_GROUP_COOLDOWN_DAYS;
  nation.cooldowns[RANDOM_EVENT_GAP_KEY] = state.day + RANDOM_EVENT_GAP_DAYS;
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
  if (!optionAvailable(state, content, pending.country, option)) return false;
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

/**
 * 通用事件（country: any）默认只发给中原政权：汉文化势力 + 清。
 * 蒙古、朝鲜、日本、西藏、荷兰、沙俄等有自己的国家事件链，不应收到
 * 「宗室禄米」「漕运梗阻」这类中原行政事件。需要跨界时在事件上写 tags。
 */
const GENERIC_EVENT_CULTURES = new Set(['han']);

function genericTags(state: GameState, content: ContentIndex): string[] {
  return Object.values(state.countries)
    .filter(country => country.alive)
    .filter(country => {
      const def = content.countries.get(country.tag);
      return def !== undefined && (GENERIC_EVENT_CULTURES.has(def.culture) || country.tag === 'QING');
    })
    .map(country => country.tag);
}

export function eventTargets(state: GameState, content: ContentIndex, event: EventDef): string[] {
  if (event.country && event.country !== 'any') return [event.country];
  if (event.tags && event.tags.length > 0) {
    return event.tags.filter(tag => state.countries[tag]?.alive);
  }
  return genericTags(state, content);
}

/** 加权随机选一条候选事件；用稳定的种子，保证读档/重放可复现。 */
function pickCandidate(state: GameState, country: string, events: EventDef[]): EventDef | undefined {
  if (events.length === 0) return undefined;
  if (events.length === 1) return events[0];
  const rng = rngFor(state.seed, state.day, `event-pick:${country}`);
  const total = events.reduce((sum, event) => sum + Math.max(0.01, event.weight ?? 1), 0);
  let roll = rng.next() * total;
  for (const event of events) {
    roll -= Math.max(0.01, event.weight ?? 1);
    if (roll <= 0) return event;
  }
  return events[0];
}

export function processEvents(state: GameState, content: ContentIndex): void {
  const due = state.eventQueue.filter(entry => entry.dueDay <= state.day);
  state.eventQueue = state.eventQueue.filter(entry => entry.dueDay > state.day);
  for (const entry of due) {
    const event = content.events.get(entry.eventId);
    if (!event) continue;
    // 每日扫描可能已经触发过同一事件（fireOnce / 冷却）；队列不得绕过。
    if (!canFire(state, event, entry.country, true)) continue;
    if (!state.countries[entry.country]?.alive) continue;
    if (event.trigger && !evaluateTrigger(event.trigger, { state, content, country: entry.country })) {
      const attempts = (entry.attempts ?? 0) + 1;
      if (attempts < 16) {
        state.eventQueue.push({ ...entry, dueDay: state.day + 7, attempts });
      }
      continue;
    }
    fireEvent(state, content, event, entry.country, entry.province);
  }

  // 每个势力每天最多触发一条随机事件，且与上一条随机事件至少间隔
  // RANDOM_EVENT_GAP_DAYS 天；剧情链（event.chain）不受间隔限制。
  const candidates = new Map<string, EventDef[]>();
  for (const event of content.events.values()) {
    for (const country of eventTargets(state, content, event)) {
      if (!canFire(state, event, country)) continue;
      if (!event.chain && state.day < (state.countries[country]?.cooldowns[RANDOM_EVENT_GAP_KEY] ?? 0)) continue;
      if (event.trigger && !evaluateTrigger(event.trigger, { state, content, country })) continue;
      if (event.mtth !== undefined) {
        const rng = rngFor(state.seed, state.day, `event:${event.id}:${country}`);
        if (rng.next() >= 1 / event.mtth) continue;
      }
      const list = candidates.get(country);
      if (list) list.push(event);
      else candidates.set(country, [event]);
    }
  }
  for (const [country, list] of candidates) {
    if (country === state.playerTag && state.pendingEvents.length >= 8) continue;
    // 剧情链优先于同日的随机事件，避免关键历史节点被随机灾荒挤掉。
    const event = list.find(entry => entry.chain) ?? pickCandidate(state, country, list);
    if (event) fireEvent(state, content, event, country);
  }
}
