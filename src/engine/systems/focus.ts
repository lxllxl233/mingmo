import type { ContentIndex, Focus } from '../../content/types';
import { evaluateTrigger } from '../rules/triggers';
import { applyEffects } from '../rules/effects';
import { aggregateCountryModifiers } from '../rules/modifiers';
import { fireEvent } from './events';
import type { GameState } from '../state/types';

export function isFocusAvailable(state: GameState, content: ContentIndex, tag: string, focus: Focus): boolean {
  const nation = state.countries[tag];
  if (!nation || !nation.alive) return false;
  if (focus.country !== tag) return false;
  if (nation.completedFocuses.includes(focus.id)) return false;
  if (nation.focus?.id === focus.id) return false;
  if (!focus.prerequisites.every(id => nation.completedFocuses.includes(id))) return false;
  if (focus.prerequisitesAny.length > 0
    && !focus.prerequisitesAny.some(id => nation.completedFocuses.includes(id))) return false;
  if (focus.mutuallyExclusive.some(id => nation.completedFocuses.includes(id))) return false;
  if (focus.available && !evaluateTrigger(focus.available, { state, content, country: tag })) return false;
  return true;
}

export function availableFocuses(state: GameState, content: ContentIndex, tag: string): Focus[] {
  const focuses = content.focusesByCountry.get(tag) ?? [];
  return focuses.filter(focus => isFocusAvailable(state, content, tag, focus));
}

export function cancelFocus(state: GameState, tag: string): boolean {
  const nation = state.countries[tag];
  if (!nation?.focus) return false;
  nation.focus = null;
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '取消当前国策，进度清零',
    severity: 'info',
  });
  return true;
}

export function startFocus(state: GameState, content: ContentIndex, tag: string, focusId: string): boolean {
  const nation = state.countries[tag];
  const focus = content.focuses.get(focusId);
  if (!nation || !focus) return false;
  if (nation.focus !== null) return false;
  if (!isFocusAvailable(state, content, tag, focus)) return false;
  nation.focus = { id: focusId, progress: 0 };
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: `开始国策：${focus.name}`,
    severity: 'info',
  });
  return true;
}

export function advanceFocus(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive || !nation.focus) continue;
    const focus = content.focuses.get(nation.focus.id);
    if (!focus) {
      nation.focus = null;
      continue;
    }
    const modifiers = aggregateCountryModifiers(state, content, nation.tag);
    const speed = 1 + (modifiers['focus_speed_pct'] ?? 0) / 100;
    nation.focus.progress += Math.max(0.1, speed);
    if (nation.focus.progress < focus.costDays) continue;
    applyEffects(focus.completionEffect, { state, content, country: nation.tag });
    nation.completedFocuses.push(focus.id);
    nation.focus = null;
    state.log.push({
      day: state.day,
      category: 'politics',
      country: nation.tag,
      text: `国策完成：${focus.name}`,
      severity: 'info',
    });
    const completion = content.events.get('focus_completed');
    if (completion) fireEvent(state, content, completion, nation.tag);
  }
}
