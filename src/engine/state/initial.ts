import type {
  ContentIndex,
  CountryStarting,
  EstateKey,
  ScenarioDef,
} from '../../content/types';
import { hashSeed } from '../core/rng';
import { parseDay } from '../core/clock';
import type {
  ArmyState,
  CountryState,
  Difficulty,
  EstateState,
  GameState,
  ProvinceState,
  WarState,
} from './types';
import { relationKey } from './types';
import { applyEffects } from '../rules/effects';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mergeStarting(base: CountryStarting, override: Partial<CountryStarting> | undefined): CountryStarting {
  return { ...base, ...(override ?? {}) };
}

function buildEstate(
  content: ContentIndex,
  key: EstateKey,
  config: { name: string; influence: number; loyalty: number; taxLaw: string; privileges: string[] },
): EstateState {
  const law = content.taxLaws.get(config.taxLaw);
  if (!law) throw new Error(`unknown tax law ${config.taxLaw} for ${key}`);
  return {
    key,
    influence: config.influence,
    loyalty: config.loyalty,
    income: 0,
    taxLaw: config.taxLaw,
    privileges: [...config.privileges],
    reform: null,
    cooldownDays: 0,
    collected: 0,
    effectiveRate: law.rate,
    customaryRate: law.rate,
  };
}

export function createInitialState(
  content: ContentIndex,
  scenarioId: string,
  seed: number,
  playerTag: string,
  difficulty: Difficulty = 'normal',
  spectator = false,
): GameState {
  const scenario: ScenarioDef | undefined = content.scenarios.get(scenarioId);
  if (!scenario) throw new Error(`unknown scenario ${scenarioId}`);
  if (!content.countries.has(playerTag)) throw new Error(`unknown player tag ${playerTag}`);
  const startDay = parseDay(scenario.startDate);

  const owners: Record<string, string> = {};
  for (const province of content.provinces.values()) {
    owners[province.id] = scenario.provinceOverrides[province.id]
      ?? scenario.regionOwners[province.regionId]
      ?? 'NEU';
  }

  const provinces: Record<string, ProvinceState> = {};
  for (const province of content.provinces.values()) {
    const owner = owners[province.id] ?? 'NEU';
    provinces[province.id] = {
      id: province.id,
      owner,
      controller: owner,
      population: province.population,
      cores: [owner],
      claims: [],
      occupation: null,
      unrest: 5 + (hashSeed(province.id, seed, 'unrest') % 16),
      devastation: 0,
      modifiers: [],
      buildings: [],
      building: null,
    };
  }
  for (const [tag, regionIds] of Object.entries(scenario.coreRegions ?? {})) {
    for (const regionId of regionIds ?? []) {
      for (const def of content.provinces.values()) {
        if (def.regionId !== regionId) continue;
        const province = provinces[def.id];
        if (province && !province.cores.includes(tag)) province.cores.push(tag);
      }
    }
  }

  const countries: Record<string, CountryState> = {};
  for (const def of content.countries.values()) {
    const starting = mergeStarting(def.starting, scenario.countryOverrides[def.tag]);
    const configs = content.countryEstates.get(def.tag) ?? [];
    const estates: Record<string, EstateState> = {};
    const allocation: Record<string, number> = {};
    for (const config of configs) {
      estates[config.key] = buildEstate(content, config.key, config);
    }
    const minimums = configs.map(config => Math.min(45, 2 + Math.max(0, estates[config.key]?.influence ?? 0) * 0.13));
    const minimumTotal = minimums.reduce((sum, value) => sum + value, 0);
    const incomeShareTotal = configs.reduce((sum, config) => sum + config.incomeShare, 0) || 1;
    const remaining = Math.max(0, 100 - minimumTotal);
    configs.forEach((config, index) => {
      const base = minimumTotal >= 100
        ? (minimums[index]! / minimumTotal) * 100
        : minimums[index]! + remaining * (config.incomeShare / incomeShareTotal);
      allocation[config.key] = Math.round(base * 10) / 10;
    });
    const owned = Object.entries(owners).filter(([, owner]) => owner === def.tag);
    let capital = def.capital;
    if (owners[capital] !== def.tag) {
      const best = owned
        .map(([id]) => content.provinces.get(id))
        .filter((province): province is NonNullable<typeof province> => province !== undefined)
        .sort((a, b) => b.development - a.development)[0];
      capital = best?.id ?? def.capital;
    }
    const factions: Record<string, number> = {};
    def.factions.forEach((faction, index) => {
      factions[faction] = 10 + (index % 4) * 5;
    });
    countries[def.tag] = {
      tag: def.tag,
      alive: owned.length > 0,
      capital,
      treasury: Math.max(0, starting.treasury),
      food: Math.max(0, starting.food),
      manpower: Math.max(0, starting.manpower),
      politicalPower: Math.max(0, starting.politicalPower),
      arrears: 0,
      wageArrears: 0,
      stability: clamp(starting.stability, 0, 100),
      mandate: clamp(starting.mandate, 0, 100),
      corruption: clamp(starting.corruption, 0, 100),
      authority: clamp(starting.authority, 0, 100),
      armyLoyalty: clamp(starting.armyLoyalty, 0, 100),
      inflation: clamp(starting.inflation, 0, 100),
      warExhaustion: 0,
      economicMomentum: 0,
      fiscalCrisisDays: 0,
      foodCrisisDays: 0,
      allocation,
      foodPurchasePct: 30,
      estates,
      factions,
      focus: null,
      completedFocuses: [],
      research: [],
      researchSlots: starting.researchSlots,
      completedTechs: [],
      unlockedUnits: [],
      unlockedDecisions: [],
      flags: {},
      modifiers: {},
      timedModifiers: [],
      cooldowns: {},
      tradePosts: [],
      grudges: {},
      ai: { target: null, lastWarDay: -999, focusId: null, stance: 'expand' },
      monthlyHistory: [],
      lastReport: null,
    };
    const leader = def.leadersByScenario?.[scenario.id] ?? def.leader;
    const nation = countries[def.tag];
    if (nation && leader?.effects) {
      for (const [key, value] of Object.entries(leader.effects)) {
        const modifierKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        nation.modifiers[modifierKey] = (nation.modifiers[modifierKey] ?? 0) + value;
      }
    }
  }

  for (const [tag, focusIds] of Object.entries(scenario.startingFocuses ?? {})) {
    const country = countries[tag];
    if (!country) continue;
    for (const focusId of focusIds ?? []) {
      if (!country.completedFocuses.includes(focusId)) country.completedFocuses.push(focusId);
    }
  }
  for (const [tag, techIds] of Object.entries(scenario.startingTechs ?? {})) {
    const country = countries[tag];
    if (!country) continue;
    for (const techId of techIds ?? []) {
      if (!country.completedTechs.includes(techId)) country.completedTechs.push(techId);
    }
  }

  const armies: Record<string, ArmyState> = {};
  let nextArmyId = 0;
  const usedGenerals = new Set<string>();
  for (const entry of scenario.armies) {
    const template = content.armyTemplates.get(entry.template);
    const country = content.countries.get(entry.tag);
    if (!template || !country) continue;
    const general = [...content.generals.values()].find(candidate =>
      candidate.country === entry.tag && !usedGenerals.has(candidate.id));
    if (general) usedGenerals.add(general.id);
    const id = `army_${nextArmyId}`;
    nextArmyId += 1;
    armies[id] = {
      id,
      tag: entry.tag,
      name: `${country.name} ${template.name}`,
      province: entry.province,
      history: [],
      movePath: [],
      moveProgress: 0,
      templateId: template.id,
      embarked: false,
      navalTarget: null,
      navalOrigin: null,
      navalProgress: 0,
      siegeMode: 'siege',
      composition: {
        infantry: template.composition.infantry * entry.size,
        firearm: template.composition.firearm * entry.size,
        cavalry: template.composition.cavalry * entry.size,
        artillery: template.composition.artillery * entry.size,
        naval: template.composition.naval * entry.size,
      },
      organization: content.balance.military.baseOrganization,
      maxStrength: (template.composition.infantry + template.composition.firearm
        + template.composition.cavalry + template.composition.artillery + template.composition.naval) * entry.size,
      training: template.training,
      equipment: template.equipment,
      supply: 100,
      encircled: false,
      encircledDays: 0,
      sourceEstate: template.sourceEstate,
      general: general?.id ?? null,
      entrenchment: 0,
      forcedMarch: false,
      stance: 'hold',
    };
  }

  const relations: Record<string, number> = {};
  const setRelation = (a: string, b: string, value: number): void => {
    relations[relationKey(a, b)] = value;
  };
  setRelation('MING', 'QING', -70);
  setRelation('MING', 'SHUN', -45);
  setRelation('MING', 'SMING', 25);
  setRelation('QING', 'SHUN', -40);
  setRelation('QING', 'SMING', -65);
  setRelation('QING', 'ZHENG', -55);
  setRelation('QING', 'XI', -50);
  setRelation('MONGOL', 'QING', 20);
  setRelation('JOSEON', 'QING', 30);
  setRelation('JAPAN', 'MING', 10);
  setRelation('VOC', 'ZHENG', -20);
  setRelation('RUSSIA', 'QING', -20);

  const wars: WarState[] = scenario.initialWars.map((war, index) => {
    setRelation(war.attacker, war.defender, -80);
    return {
      id: `war_${index}`,
      attacker: war.attacker,
      defender: war.defender,
      startDay,
      warGoal: war.goal ?? '',
      exhaustion: { [war.attacker]: 0, [war.defender]: 0 },
      casualties: { [war.attacker]: 0, [war.defender]: 0 },
      attrition: { [war.attacker]: 0, [war.defender]: 0 },
    };
  });

  const state: GameState = {
    version: 1,
    seed,
    day: startDay,
    playerTag,
    scenarioId,
    spectator,
    mapRevision: 0,
    countries,
    provinces,
    armies,
    training: [],
    wars,
    battles: [],
    peaceOffers: [],
    truces: {},
    vassals: scenario.id === '1627'
      ? { JOSEON: 'MING', NEU: 'MING' }
      : { JOSEON: 'QING', NEU: 'QING' },
    lastTribute: {},
    relations,
    alliances: {},
    militaryAccess: {},
    eventQueue: scenario.initialEvents.map(eventId => {
      const event = content.events.get(eventId);
      const country = event?.country && event.country !== 'any' ? event.country : playerTag;
      return { eventId, country, dueDay: startDay };
    }),
    pendingEvents: [],
    firedEvents: {},
    log: [{
      day: startDay,
      category: 'system',
      country: playerTag,
      text: `${scenario.name}：${content.countries.get(playerTag)?.name ?? playerTag} 开局`,
      severity: 'info',
    }],
    nextArmyId,
    nextTrainingId: 0,
    nextWarId: wars.length,
    difficulty,
    warAlerts: [],
    stats: {
      eventsFired: 0,
      battles: 0,
      sieges: 0,
      provincesCaptured: 0,
      taxesRaised: 0,
      moneyPrinted: 0,
      famines: 0,
    },
    ended: false,
    victory: null,
  };
  for (const truce of scenario.initialTruces ?? []) {
    state.truces[relationKey(truce.a, truce.b)] = startDay + truce.days;
  }
  for (const nation of Object.values(state.countries)) {
    for (const techId of nation.completedTechs) {
      const tech = content.techs.get(techId);
      if (tech) {
        applyEffects(tech.effects, { state, content, country: nation.tag });
        for (const unit of tech.unlocks.units ?? []) {
          if (!nation.unlockedUnits.includes(unit)) nation.unlockedUnits.push(unit);
        }
        for (const decision of tech.unlocks.decisions ?? []) {
          if (!nation.unlockedDecisions.includes(decision)) nation.unlockedDecisions.push(decision);
        }
      }
    }
    for (const focusId of nation.completedFocuses) {
      const focus = content.focuses.get(focusId);
      if (focus) applyEffects(focus.completionEffect, { state, content, country: nation.tag });
    }
  }
  return state;
}



