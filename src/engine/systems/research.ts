import type { ContentIndex, Tech } from '../../content/types';
import { aggregateModifiers } from '../rules/modifiers';
import { applyEffects } from '../rules/effects';
import { evaluateTrigger } from '../rules/triggers';
import { fireEvent } from './events';
import type { GameState } from '../state/types';

export const RESEARCH_FUNDING_PER_SLOT_DAY = 60;

export function isTechAvailable(state: GameState, content: ContentIndex, tag: string, tech: Tech): boolean {
  const nation = state.countries[tag];
  if (!nation || !nation.alive) return false;
  if (tech.country && tech.country !== tag) return false;
  if (nation.completedTechs.includes(tech.id)) return false;
  if (nation.research.some(slot => slot.techId === tech.id)) return false;
  if (!tech.prerequisites.every(id => nation.completedTechs.includes(id))) return false;
  if (tech.requiresAny && !evaluateTrigger(tech.requiresAny, { state, content, country: tag })) return false;
  return true;
}

export function availableTechs(state: GameState, content: ContentIndex, tag: string): Tech[] {
  return [...content.techs.values()].filter(tech => isTechAvailable(state, content, tag, tech));
}

export function startResearch(state: GameState, content: ContentIndex, tag: string, techId: string): boolean {
  const nation = state.countries[tag];
  const tech = content.techs.get(techId);
  if (!nation || !tech) return false;
  if (nation.research.length >= nation.researchSlots) return false;
  if (!isTechAvailable(state, content, tag, tech)) return false;
  let slot = 0;
  while (nation.research.some(entry => entry.slot === slot)) slot += 1;
  nation.research.push({ techId, progress: 0, slot });
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: `开始研究：${tech.name}`,
    severity: 'info',
  });
  return true;
}

export function cancelResearch(state: GameState, tag: string, techId: string): boolean {
  const nation = state.countries[tag];
  if (!nation) return false;
  const slot = nation.research.find(entry => entry.techId === techId);
  if (!slot) return false;
  nation.research = nation.research.filter(entry => entry.techId !== techId);
  state.log.push({
    day: state.day,
    category: 'politics',
    country: tag,
    text: '取消一项研究，进度清零',
    severity: 'info',
  });
  return true;
}

export function advanceResearch(state: GameState, content: ContentIndex): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const modifiers = aggregateModifiers(nation, content);
    const fundingNeed = nation.research.length * RESEARCH_FUNDING_PER_SLOT_DAY;
    const fundingPaid = nation.treasury > 20000 ? Math.min(fundingNeed, nation.treasury - 20000) : 0;
    nation.treasury -= fundingPaid;
    const fundingFactor = fundingNeed > 0 ? 0.3 + 0.7 * (fundingPaid / fundingNeed) : 1;
    const corruptionFactor = 1 - Math.max(0, Math.min(100, nation.corruption)) / 100 * 0.1;
    const speed = Math.max(0.1, (1 + (modifiers['research_speed_pct'] ?? 0) / 100) * fundingFactor * corruptionFactor);
    const completed: string[] = [];
    for (const slot of nation.research) {
      const tech = content.techs.get(slot.techId);
      if (!tech) continue;
      slot.progress += speed;
      if (slot.progress >= tech.costDays) completed.push(slot.techId);
    }
    for (const techId of completed) {
      const tech = content.techs.get(techId);
      if (!tech) continue;
      nation.research = nation.research.filter(slot => slot.techId !== techId);
      if (!nation.completedTechs.includes(techId)) {
        nation.completedTechs.push(techId);
        for (const unit of tech.unlocks.units ?? []) {
          if (!nation.unlockedUnits.includes(unit)) nation.unlockedUnits.push(unit);
        }
        for (const decision of tech.unlocks.decisions ?? []) {
          if (!nation.unlockedDecisions.includes(decision)) nation.unlockedDecisions.push(decision);
        }
        applyEffects(tech.effects, { state, content, country: nation.tag });
        state.log.push({
          day: state.day,
          category: 'politics',
          country: nation.tag,
          text: `研究完成：${tech.name}`,
          severity: 'info',
        });
        const completion = content.events.get('research_completed');
        if (completion) fireEvent(state, content, completion, nation.tag);
      }
    }
  }
}



