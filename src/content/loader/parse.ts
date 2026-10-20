import { parse as parseYaml } from 'yaml';
import type { ZodTypeAny } from 'zod';
import {
  armyTemplateSchema,
  balanceSchema,
  buildingSchema,
  countryEstatesSchema,
  countrySchema,
  decisionSchema,
  estateDefSchema,
  eventChainSchema,
  eventSchema,
  focusSchema,
  generalSchema,
  leaderEntrySchema,
  leaderProfileSchema,
  namedModifierSchema,
  prefectureSchema,
  privilegeSchema,
  provinceSchema,
  regionSchema,
  scenarioSchema,
  taxLawSchema,
  techSchema,
} from '../schema';
import type {
  ArmyTemplate,
  Balance,
  BuildingDef,
  ContentIndex,
  CountryDef,
  CountryEstateConfig,
  Decision,
  EstateDef,
  EstateKey,
  EventChain,
  EventDef,
  Focus,
  General,
  LeaderDef,
  LeaderEntry,
  LeaderProfile,
  MapGeo,
  NamedModifier,
  PrefectureDef,
  Privilege,
  ProvinceDef,
  RegionDef,
  ScenarioDef,
  TaxLaw,
  Tech,
} from '../types';
import { ContentError, asRecord } from './errors';
import { normalizePrefecture, normalizeProvince, normalizeRegion, normalizeValue } from './normalize';
import { validateContent } from './validateContent';
import { expandFocusPacks, parseFocusPacks } from './focusPacks';
import { validateEffectList, validateModifier, validateOptionalTrigger, validateTrigger } from './validate';

export interface RawContentFile {
  path: string;
  text: string;
}

interface Collected {
  file: string;
  value: unknown;
}

interface Collections {
  regions: Collected[];
  prefectures: Collected[];
  provinces: Collected[];
  countries: Collected[];
  buildings: Collected[];
  estateDefs: Collected[];
  countryEstates: Collected[];
  taxLaws: Collected[];
  privileges: Collected[];
  focuses: Collected[];
  focusPacks: Collected[];
  events: Collected[];
  eventChains: Collected[];
  techs: Collected[];
  decisions: Collected[];
  armyTemplates: Collected[];
  generals: Collected[];
  leaders: Collected[];
  leaderProfiles: Collected[];
  namedModifiers: Collected[];
  scenarios: Collected[];
}

const EMPTY_COLLECTIONS: Collections = {
  regions: [],
  prefectures: [],
  provinces: [],
  countries: [],
  buildings: [],
  estateDefs: [],
  countryEstates: [],
  taxLaws: [],
  privileges: [],
  focuses: [],
  focusPacks: [],
  events: [],
  eventChains: [],
  techs: [],
  decisions: [],
  armyTemplates: [],
  generals: [],
  leaders: [],
  leaderProfiles: [],
  namedModifiers: [],
  scenarios: [],
};

function pushItems(target: Collected[], value: unknown, file: string, path: string): void {
  if (!Array.isArray(value)) throw new ContentError(file, path, 'expected array');
  value.forEach((item, index) => target.push({ file: `${file}:${path}[${index}]`, value: item }));
}

function parseAll<T>(items: Collected[], schema: ZodTypeAny): T[] {
  return items.map(item => {
    const result = schema.safeParse(item.value);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue ? issue.path.join('.') : '$';
      throw new ContentError(item.file, path || '$', issue?.message ?? 'schema validation failed');
    }
    return result.data as T;
  });
}

function byId<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) throw new ContentError(label, item.id, 'duplicate id');
    map.set(item.id, item);
  }
  return map;
}

function byKey<T extends { key: string }>(items: T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.key)) throw new ContentError(label, item.key, 'duplicate key');
    map.set(item.key, item);
  }
  return map;
}

function byTag(items: CountryDef[]): Map<string, CountryDef> {
  const map = new Map<string, CountryDef>();
  for (const item of items) {
    if (map.has(item.tag)) throw new ContentError('countries', item.tag, 'duplicate tag');
    map.set(item.tag, item);
  }
  return map;
}

export function parseContent(files: RawContentFile[], geo: MapGeo): ContentIndex {
  const collected: Collections = {
    ...EMPTY_COLLECTIONS,
    regions: [], prefectures: [], provinces: [], countries: [], buildings: [], estateDefs: [],
    countryEstates: [], taxLaws: [], privileges: [], focuses: [], focusPacks: [], events: [],
    eventChains: [], techs: [], decisions: [], armyTemplates: [], generals: [],
    leaders: [], leaderProfiles: [], namedModifiers: [], scenarios: [],
  };
  let balance: { file: string; value: unknown } | null = null;

  for (const file of files) {
    let document: unknown;
    try {
      document = parseYaml(file.text);
    } catch (error) {
      throw new ContentError(file.path, '$', error instanceof Error ? error.message : 'invalid YAML');
    }
    if (document === null || document === undefined) continue;
    const root = asRecord(document, file.path, '$');
    if (typeof root['id'] === 'string' && typeof root['start_date'] === 'string') {
      collected.scenarios.push({ file: file.path, value: normalizeValue(root) });
      continue;
    }
    for (const [key, value] of Object.entries(root)) {
      switch (key) {
        case 'regions':
          if (!Array.isArray(value)) throw new ContentError(file.path, 'regions', 'expected array');
          value.forEach((item, index) => collected.regions.push({ file: `${file.path}:regions[${index}]`, value: normalizeRegion(item, file.path, index) }));
          break;
        case 'prefectures':
          if (!Array.isArray(value)) throw new ContentError(file.path, 'prefectures', 'expected array');
          value.forEach((item, index) => collected.prefectures.push({ file: `${file.path}:prefectures[${index}]`, value: normalizePrefecture(item, file.path, index) }));
          break;
        case 'provinces':
          if (!Array.isArray(value)) throw new ContentError(file.path, 'provinces', 'expected array');
          value.forEach((item, index) => collected.provinces.push({ file: `${file.path}:provinces[${index}]`, value: normalizeProvince(item, file.path, index) }));
          break;
        case 'countries':
          pushItems(collected.countries, normalizeValue(value), file.path, 'countries');
          break;
        case 'buildings':
          pushItems(collected.buildings, normalizeValue(value), file.path, 'buildings');
          break;
        case 'estate_defs':
          pushItems(collected.estateDefs, normalizeValue(value), file.path, 'estate_defs');
          break;
        case 'country_estates':
          pushItems(collected.countryEstates, normalizeValue(value), file.path, 'country_estates');
          break;
        case 'tax_laws':
          pushItems(collected.taxLaws, normalizeValue(value), file.path, 'tax_laws');
          break;
        case 'privileges':
          pushItems(collected.privileges, normalizeValue(value), file.path, 'privileges');
          break;
        case 'focuses':
          pushItems(collected.focuses, normalizeValue(value), file.path, 'focuses');
          break;
        case 'focus_packs':
          pushItems(collected.focusPacks, normalizeValue(value), file.path, 'focus_packs');
          break;
        case 'events':
          pushItems(collected.events, normalizeValue(value), file.path, 'events');
          break;
        case 'event_chains':
          pushItems(collected.eventChains, normalizeValue(value), file.path, 'event_chains');
          break;
        case 'techs':
          pushItems(collected.techs, normalizeValue(value), file.path, 'techs');
          break;
        case 'decisions':
          pushItems(collected.decisions, normalizeValue(value), file.path, 'decisions');
          break;
        case 'army_templates':
          pushItems(collected.armyTemplates, normalizeValue(value), file.path, 'army_templates');
          break;
        case 'generals':
          pushItems(collected.generals, normalizeValue(value), file.path, 'generals');
          break;
        case 'leaders':
          pushItems(collected.leaders, normalizeValue(value), file.path, 'leaders');
          break;
        case 'leader_profiles':
          pushItems(collected.leaderProfiles, normalizeValue(value), file.path, 'leader_profiles');
          break;
        case 'named_modifiers':
          pushItems(collected.namedModifiers, normalizeValue(value), file.path, 'named_modifiers');
          break;
        case 'scenarios':
          pushItems(collected.scenarios, normalizeValue(value), file.path, 'scenarios');
          break;
        case 'balance':
          balance = { file: file.path, value: normalizeValue(value) };
          break;
        default:
          throw new ContentError(file.path, key, 'unknown top-level key');
      }
    }
  }

  const regions: RegionDef[] = parseAll<RegionDef>(collected.regions, regionSchema);
  const prefectures: PrefectureDef[] = parseAll<PrefectureDef>(collected.prefectures, prefectureSchema);
  const provinces: ProvinceDef[] = parseAll<ProvinceDef>(collected.provinces, provinceSchema);
  const leaderEntries: LeaderEntry[] = parseAll<LeaderEntry>(collected.leaders, leaderEntrySchema);
  const leaderProfiles: LeaderProfile[] = parseAll<LeaderProfile>(collected.leaderProfiles, leaderProfileSchema);
  const profileByName = new Map(leaderProfiles.map(profile => [profile.name, profile]));
  for (const entry of leaderEntries) {
    const profile = profileByName.get(entry.name);
    if (profile) {
      entry.effects = profile.effects;
      entry.timeline = profile.timeline;
    }
  }
  const countries: CountryDef[] = parseAll<CountryDef>(collected.countries, countrySchema);
  const buildings: BuildingDef[] = parseAll<BuildingDef>(collected.buildings, buildingSchema);
  for (const country of countries) {
    const entries = leaderEntries.filter(entry => entry.tag === country.tag);
    const base = entries.find(entry => entry.scenario === 'default') ?? entries[0];
    if (base) {
      const { tag: _tag, scenario: _scenario, ...leader } = base;
      void _tag;
      void _scenario;
      country.leader = leader;
    }
    const overrides: Record<string, LeaderDef> = {};
    for (const entry of entries) {
      if (entry.scenario === 'default') continue;
      const { tag: _tag, scenario, ...leader } = entry;
      void _tag;
      overrides[scenario] = leader;
    }
    country.leadersByScenario = overrides;
  }
  const estateDefs: EstateDef[] = parseAll<EstateDef>(collected.estateDefs, estateDefSchema);
  const countryEstatesByTag = new Map<string, CountryEstateConfig[]>();
  for (const item of collected.countryEstates) {
    const result = countryEstatesSchema.safeParse(item.value);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new ContentError(item.file, issue?.path.join('.') ?? '$', issue?.message ?? 'invalid country estates');
    }
    if (countryEstatesByTag.has(result.data.country)) {
      throw new ContentError(item.file, 'country', `duplicate country_estates for ${result.data.country}`);
    }
    countryEstatesByTag.set(result.data.country, result.data.estates as CountryEstateConfig[]);
  }
  const taxLaws: TaxLaw[] = parseAll<TaxLaw>(collected.taxLaws, taxLawSchema);
  const privileges: Privilege[] = parseAll<Privilege>(collected.privileges, privilegeSchema);
  const focuses: Focus[] = parseAll<Focus>(collected.focuses, focusSchema);
  const events: EventDef[] = parseAll<EventDef>(collected.events, eventSchema);
  const eventChains: EventChain[] = parseAll<EventChain>(collected.eventChains, eventChainSchema);
  const techs: Tech[] = parseAll<Tech>(collected.techs, techSchema);
  const decisions: Decision[] = parseAll<Decision>(collected.decisions, decisionSchema);
  const armyTemplates: ArmyTemplate[] = parseAll<ArmyTemplate>(collected.armyTemplates, armyTemplateSchema);
  const generals: General[] = parseAll<General>(collected.generals, generalSchema);
  const namedModifiers: NamedModifier[] = parseAll<NamedModifier>(collected.namedModifiers, namedModifierSchema);
  const scenarios: ScenarioDef[] = parseAll<ScenarioDef>(collected.scenarios, scenarioSchema);

  const packs = parseFocusPacks(
    collected.focusPacks.map(item => item.value),
    new Set(countries.map(country => country.tag)),
  );
  const generated = expandFocusPacks(packs, new Set(countries.map(country => country.tag)));
  focuses.push(...generated.focuses);
  decisions.push(...generated.decisions);

  for (const focus of focuses) {
    const file = collected.focuses.find(item => (item.value as Focus).id === focus.id)?.file ?? 'focuses';
    validateOptionalTrigger(focus.available, file, `${focus.id}.available`);
    validateEffectList(focus.completionEffect, file, `${focus.id}.completionEffect`);
    for (const modifier of focus.aiWillDo.modifier ?? []) validateTrigger(modifier.if, file, `${focus.id}.aiWillDo.if`);
  }
  for (const event of events) {
    const file = collected.events.find(item => (item.value as EventDef).id === event.id)?.file ?? 'events';
    validateTrigger(event.trigger, file, `${event.id}.trigger`);
    for (const option of event.options) {
      validateOptionalTrigger(option.trigger, file, `${event.id}.${option.id}.trigger`);
      validateEffectList(option.effect, file, `${event.id}.${option.id}.effect`);
    }
  }
  for (const chain of eventChains) {
    const file = collected.eventChains.find(item => (item.value as EventChain).id === chain.id)?.file ?? 'event_chains';
    validateEffectList(chain.onComplete, file, `${chain.id}.onComplete`);
  }
  for (const tech of techs) {
    const file = collected.techs.find(item => (item.value as Tech).id === tech.id)?.file ?? 'techs';
    validateOptionalTrigger(tech.requiresAny, file, `${tech.id}.requiresAny`);
    validateEffectList(tech.effects, file, `${tech.id}.effects`);
  }
  for (const decision of decisions) {
    const file = collected.decisions.find(item => (item.value as Decision).id === decision.id)?.file ?? 'decisions';
    validateOptionalTrigger(decision.visible, file, `${decision.id}.visible`);
    validateOptionalTrigger(decision.available, file, `${decision.id}.available`);
    validateEffectList(decision.effect, file, `${decision.id}.effect`);
  }
  for (const law of taxLaws) {
    const file = collected.taxLaws.find(item => (item.value as TaxLaw).id === law.id)?.file ?? 'tax_laws';
    validateOptionalTrigger(law.require, file, `${law.id}.require`);
    if (law.effects) validateEffectList(law.effects, file, `${law.id}.effects`);
  }
  for (const privilege of privileges) {
    const file = collected.privileges.find(item => (item.value as Privilege).id === privilege.id)?.file ?? 'privileges';
    validateEffectList(privilege.effects, file, `${privilege.id}.effects`);
    validateEffectList(privilege.revoke.effects, file, `${privilege.id}.revoke.effects`);
  }
  for (const modifier of namedModifiers) {
    const file = collected.namedModifiers.find(item => (item.value as NamedModifier).id === modifier.id)?.file ?? 'named_modifiers';
    validateModifier(modifier.modifiers, file, `${modifier.id}.modifiers`);
  }
  for (const building of buildings) {
    const file = collected.buildings.find(item => (item.value as BuildingDef).id === building.id)?.file ?? 'buildings';
    validateModifier(building.modifiers, file, `${building.id}.modifiers`);
  }

  if (balance === null) throw new ContentError('balance.yaml', '$', 'missing balance');
  const parsedBalance = balanceSchema.safeParse(balance.value);
  if (!parsedBalance.success) {
    const issue = parsedBalance.error.issues[0];
    throw new ContentError(balance.file, issue?.path.join('.') ?? '$', issue?.message ?? 'invalid balance');
  }
  const balanceValue = parsedBalance.data as Balance;

  const indexes = {
    regions: byId(regions, 'regions'),
    prefectures: byId(prefectures, 'prefectures'),
    provinces: byId(provinces, 'provinces'),
    countries: byTag(countries),
    buildings: byId(buildings, 'buildings'),
    estateDefs: byKey(estateDefs, 'estate_defs') as Map<EstateKey, EstateDef>,
    countryEstates: countryEstatesByTag,
    taxLaws: byId(taxLaws, 'tax_laws'),
    privileges: byId(privileges, 'privileges'),
    focuses: byId(focuses, 'focuses'),
    events: byId(events, 'events'),
    eventChains: byId(eventChains, 'event_chains'),
    techs: byId(techs, 'techs'),
    decisions: byId(decisions, 'decisions'),
    armyTemplates: byId(armyTemplates, 'army_templates'),
    generals: byId(generals, 'generals'),
    namedModifiers: byId(namedModifiers, 'named_modifiers'),
    scenarios: byId(scenarios, 'scenarios'),
  };

  const countryEstatesByTagIndex = countryEstatesByTag;
  if (countryEstatesByTagIndex.size === 0) throw new ContentError('country_estates', '$', 'no country estate configs loaded');

  const focusesByCountry = new Map<string, Focus[]>();
  for (const focus of focuses) {
    const list = focusesByCountry.get(focus.country) ?? [];
    list.push(focus);
    focusesByCountry.set(focus.country, list);
  }
  const techsByCategory = new Map<Tech['category'], Tech[]>();
  for (const tech of techs) {
    const list = techsByCategory.get(tech.category) ?? [];
    list.push(tech);
    techsByCategory.set(tech.category, list);
  }
  const eventsByCountry = new Map<string, EventDef[]>();
  for (const event of events) {
    const tag = event.country ?? 'any';
    const list = eventsByCountry.get(tag) ?? [];
    list.push(event);
    eventsByCountry.set(tag, list);
  }
  const provincesByPrefecture = new Map<string, ProvinceDef[]>();
  const provincesByRegion = new Map<string, ProvinceDef[]>();
  for (const province of provinces) {
    const prefList = provincesByPrefecture.get(province.prefectureId) ?? [];
    prefList.push(province);
    provincesByPrefecture.set(province.prefectureId, prefList);
    const regionList = provincesByRegion.get(province.regionId) ?? [];
    regionList.push(province);
    provincesByRegion.set(province.regionId, regionList);
  }
  const taxLawsByEstate = new Map<TaxLaw['estate'], TaxLaw[]>();
  for (const law of taxLaws) {
    const list = taxLawsByEstate.get(law.estate) ?? [];
    list.push(law);
    taxLawsByEstate.set(law.estate, list);
  }

  const content: ContentIndex = {
    ...indexes,
    balance: balanceValue,
    geo,
    focusesByCountry,
    techsByCategory,
    eventsByCountry,
    provincesByPrefecture,
    provincesByRegion,
    taxLawsByEstate,
  };
  validateContent(content);
  return content;
}
