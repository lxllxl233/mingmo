import type { ContentIndex } from '../../content/types';
import { isQuarterStart } from '../core/clock';
import type { GameState } from '../state/types';
import { touchMap } from '../state/types';
import { countryProvinceList } from './economy';
import { aggregateCountryModifiers } from '../rules/modifiers';
import { topCourtFaction } from './court';
import { topBannerFaction } from './banners';

export function monthlyPoliticalGain(authority: number, stability: number): number {
  return 1 + Math.max(0, Math.min(100, authority)) / 100 + Math.max(0, Math.min(100, stability)) / 200;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeInfluence(state: GameState): void {
  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const estates = Object.values(nation.estates);
    const total = estates.reduce((sum, estate) => sum + estate.influence, 0);
    if (total <= 0) continue;
    for (const estate of estates) {
      estate.influence = clamp((estate.influence / total) * 100, 0, 100);
    }
  }
}

function driftFactions(nation: GameState['countries'][string]): void {
  for (const name of Object.keys(nation.factions)) {
    const current = nation.factions[name] ?? 0;
    nation.factions[name] = clamp(current + (10 - current) * 0.01, 0, 100);
  }
}

function rebelTag(state: GameState, owner: string): string | null {
  if (owner === 'MING' && state.countries['SHUN']?.alive) return 'SHUN';
  if (owner === 'MING' && state.countries['XI']?.alive) return 'XI';
  return null;
}

export function runMonthlyPolitics(state: GameState, content: ContentIndex): void {
  if (isQuarterStart(state.day)) normalizeInfluence(state);

  for (const nation of Object.values(state.countries)) {
    if (!nation.alive) continue;
    const modifiers = aggregateCountryModifiers(state, content, nation.tag);
    const pressure = content.countries.get(nation.tag)?.pressure;
    driftFactions(nation);
    const politicalGain = monthlyPoliticalGain(nation.authority, nation.stability)
      + (modifiers['political_power_monthly'] ?? 0);
    nation.politicalPower = clamp(nation.politicalPower + politicalGain, 0, 200);

    for (const estate of Object.values(nation.estates)) {
      if (estate.loyalty < content.balance.politics.lowLoyaltyThreshold) {
        nation.stability = clamp(nation.stability - 0.05, 0, 100);
      }
      if (estate.loyalty < content.balance.politics.rebelLoyaltyThreshold && estate.influence > 40) {
        if (state.day % 60 === 0) {
          state.log.push({
            day: state.day,
            category: 'estate',
            country: nation.tag,
            text: `${content.countries.get(nation.tag)?.name ?? nation.tag} 的 ${content.estateDefs.get(estate.key)?.name ?? estate.key} 忠诚仅 ${estate.loyalty.toFixed(0)}，有抗税之虞`,
            severity: 'danger',
          });
        }
      }
    }

    if (nation.stability < content.balance.politics.lowStabilityThreshold) {
      nation.authority = clamp(nation.authority - 0.1, 0, 100);
    }
    nation.authority = clamp(nation.authority + (modifiers['authority_monthly'] ?? 0), 0, 100);
    nation.corruption = clamp(nation.corruption + (pressure?.corruptionMonthly ?? 0), 0, content.balance.politics.maxCorruption);
    nation.stability = clamp(nation.stability + (pressure?.stabilityMonthly ?? 0), 0, 100);

    const court = topCourtFaction(state, nation.tag);
    if (court === 'donglin') {
      nation.stability = clamp(nation.stability + 0.02, 0, 100);
      nation.corruption = clamp(nation.corruption - 0.02, 0, 100);
      nation.armyLoyalty = clamp(nation.armyLoyalty - 0.02, 0, 100);
    } else if (court === 'eunuch') {
      nation.corruption = clamp(nation.corruption + 0.05, 0, 100);
      nation.stability = clamp(nation.stability - 0.02, 0, 100);
    } else if (court === 'imperial') {
      nation.authority = clamp(nation.authority + 0.05, 0, 100);
      nation.stability = clamp(nation.stability + 0.01, 0, 100);
    } else if (court === 'military') {
      nation.armyLoyalty = clamp(nation.armyLoyalty + 0.05, 0, 100);
      nation.stability = clamp(nation.stability - 0.01, 0, 100);
    }

    const banner = topBannerFaction(state, nation.tag);
    if (banner === 'manchu') {
      nation.armyLoyalty = clamp(nation.armyLoyalty + 0.03, 0, 100);
      nation.stability = clamp(nation.stability + 0.01, 0, 100);
    } else if (banner === 'han_official') {
      nation.corruption = clamp(nation.corruption - 0.02, 0, 100);
      nation.stability = clamp(nation.stability + 0.01, 0, 100);
    } else if (banner === 'green_standard') {
      nation.manpower += 500;
      nation.stability = clamp(nation.stability - 0.01, 0, 100);
    } else if (banner === 'banners') {
      nation.armyLoyalty = clamp(nation.armyLoyalty + 0.05, 0, 100);
      nation.corruption = clamp(nation.corruption + 0.01, 0, 100);
    } else if (banner === 'imperial') {
      nation.authority = clamp(nation.authority + 0.05, 0, 100);
    }

    if (nation.tag === 'SHUN') {
      const gentry = nation.estates['gentry']?.loyalty ?? 50;
      const farmers = nation.estates['farmers']?.loyalty ?? 50;
      if (gentry < 30) {
        nation.stability = clamp(nation.stability - 0.05, 0, 100);
        nation.corruption = clamp(nation.corruption + 0.02, 0, 100);
      }
      if (farmers > 70) nation.manpower += 300;
    }

    if (nation.tag === 'SMING') {
      if (nation.mandate < 30) {
        nation.stability = clamp(nation.stability - 0.05, 0, 100);
        nation.corruption = clamp(nation.corruption + 0.02, 0, 100);
      }
      if ((nation.factions['royal_clan'] ?? 0) > 40) {
        nation.stability = clamp(nation.stability - 0.03, 0, 100);
        nation.corruption = clamp(nation.corruption + 0.02, 0, 100);
      }
      if ((nation.factions['donglin'] ?? 0) > 30) {
        nation.corruption = clamp(nation.corruption - 0.02, 0, 100);
      }
    }

    if (nation.tag === 'ZHENG' && (nation.factions['merchants'] ?? 0) > 50) {
      nation.corruption = clamp(nation.corruption - 0.01, 0, 100);
      nation.stability = clamp(nation.stability + 0.01, 0, 100);
    }

    let rebellions = 0;
    for (const entry of countryProvinceList(state, content, nation.tag)) {
      if (rebellions >= 1) break;
      const estate = nation.estates[entry.def.dominantEstate];
      const law = estate ? content.taxLaws.get(estate.taxLaw) : undefined;
      const taxPressure = estate && law
        ? Math.max(0, law.rate - estate.customaryRate) * content.balance.economy.unrestFromTax
        : 0;
      const stabilityPressure = (100 - nation.stability) * 0.02;
      const devastationPressure = entry.state.devastation * 0.12;
      const provinceModifier = entry.state.modifiers.reduce(
        (sum, modifier) => sum + (modifier.modifiers['unrest_monthly'] ?? 0),
        0,
      );
      const delta = taxPressure + stabilityPressure + devastationPressure - content.balance.economy.unrestDecay
        + (modifiers['unrest_monthly'] ?? 0)
        + (pressure?.unrestMonthly ?? 0)
        + provinceModifier;
      entry.state.unrest = clamp(entry.state.unrest + delta, 0, 100);
      entry.state.devastation = clamp(entry.state.devastation + (modifiers['devastation_monthly'] ?? 0), 0, 100);
      const growth = (nation.flags['food_shortage'] ? -0.004 : 0.0006)
        * (1 + (modifiers['pop_growth_pct'] ?? 0) / 100);
      entry.state.population = Math.max(100, Math.round(entry.state.population * (1 + growth)));
      if (entry.state.unrest > content.balance.economy.rebelUnrestThreshold) {
        if (state.day % 90 === 0) {
          state.log.push({
            day: state.day,
            category: 'politics',
            country: nation.tag,
            text: `${content.provinces.get(entry.id)?.name ?? entry.id} 民怨 ${entry.state.unrest.toFixed(0)}，随时可能起事`,
            severity: 'danger',
          });
        }
      }
      const canCollapse = nation.tag === 'MING'
        ? nation.stability < 60 || nation.arrears > 500000
        : nation.stability < 25;
      const rebellionThreshold = nation.tag === 'MING' ? 60 : 75;
      if (entry.state.owner === nation.tag
        && entry.state.unrest > rebellionThreshold
        && canCollapse) {
        const rebel = rebelTag(state, nation.tag);
        if (rebel) {
          entry.state.owner = rebel;
          entry.state.controller = rebel;
          touchMap(state);
          if (!entry.state.cores.includes(rebel)) entry.state.cores.push(rebel);
          entry.state.unrest = Math.max(20, entry.state.unrest - 30);
          rebellions += 1;
          state.log.push({
            day: state.day,
            category: 'politics',
            country: nation.tag,
            text: `${content.provinces.get(entry.id)?.name ?? entry.id} 民变，归附 ${content.countries.get(rebel)?.name ?? rebel}`,
            severity: 'danger',
          });
        }
      }
    }
  }
}


