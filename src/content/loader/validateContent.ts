import type { ContentIndex } from '../types';
import { ContentError } from './errors';

function check(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new ContentError('content', path, message);
}

const FIXED_ESTATES = ['dynasty', 'nobles', 'officials', 'gentry', 'merchants', 'peasants', 'soldiers', 'clergy'];
const TERRAINS = ['plains', 'hills', 'mountains', 'wetland', 'desert', 'steppe', 'jungle', 'urban'];

function detectCycle(graph: Map<string, string[]>, label: string): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new ContentError('content', id, `${label} cycle detected`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}

function checkMap(content: ContentIndex): void {
  check(content.regions.size === 30, 'regions', `expected 30 regions, got ${content.regions.size}`);
  check(content.prefectures.size === 160, 'prefectures', `expected 160 prefectures, got ${content.prefectures.size}`);
  check(content.provinces.size === 480, 'provinces', `expected 480 provinces, got ${content.provinces.size}`);

  for (const prefecture of content.prefectures.values()) {
    check(content.regions.has(prefecture.regionId), `prefecture.${prefecture.id}`, `unknown region ${prefecture.regionId}`);
    check((content.provincesByPrefecture.get(prefecture.id)?.length ?? 0) >= 1, `prefecture.${prefecture.id}`, 'no provinces');
  }
  for (const region of content.regions.values()) {
    check((content.provincesByRegion.get(region.id)?.length ?? 0) >= 1, `region.${region.id}`, 'no provinces');
  }
  for (const province of content.provinces.values()) {
    check(content.prefectures.has(province.prefectureId), `province.${province.id}`, `unknown prefecture ${province.prefectureId}`);
    check(content.regions.has(province.regionId), `province.${province.id}`, `unknown region ${province.regionId}`);
    check(content.geo.provinces[province.id] !== undefined, `geo.${province.id}`, 'missing polygon');
    check((content.geo.provinces[province.id]?.length ?? 0) >= 3, `geo.${province.id}`, 'polygon needs >= 3 points');
    for (const neighborId of province.neighbors) {
      const neighbor = content.provinces.get(neighborId);
      check(neighbor !== undefined, `province.${province.id}`, `unknown neighbor ${neighborId}`);
      check(neighbor?.neighbors.includes(province.id) === true, `province.${province.id}`, `asymmetric neighbor ${neighborId}`);
    }
  }
  const population = [...content.provinces.values()].reduce((sum, province) => sum + province.population, 0);
  check(population >= 90_000_000 && population <= 130_000_000, 'map.population', `unreasonable population ${population}`);
}

function checkEstates(content: ContentIndex): void {
  for (const key of FIXED_ESTATES) check(content.estateDefs.has(key), `estate_defs.${key}`, 'missing fixed estate');
  for (const country of content.countries.values()) {
    const configs = content.countryEstates.get(country.tag);
    check(configs !== undefined, `country_estates.${country.tag}`, 'missing estate config');
    if (!configs) continue;
    check(configs.length >= 4 && configs.length <= 9, `country_estates.${country.tag}`, `expected 4-9 estates, got ${configs.length}`);
    const sum = configs.reduce((total, estate) => total + estate.incomeShare, 0);
    check(Math.abs(sum - 1) <= 0.01, `country_estates.${country.tag}`, `income_share sum ${sum}`);
    check(new Set(configs.map(estate => estate.key)).size === configs.length, `country_estates.${country.tag}`, 'duplicate estate');
    for (const estate of configs) {
      const isCustom = estate.key.startsWith('custom:');
      check(isCustom || content.estateDefs.has(estate.key), `country_estates.${country.tag}.${estate.key}`, 'unknown estate');
      check(!isCustom || estate.custom === true, `country_estates.${country.tag}.${estate.key}`, 'custom estate must set custom: true');
      const law = content.taxLaws.get(estate.taxLaw);
      check(law !== undefined, `country_estates.${country.tag}.${estate.key}`, `unknown tax law ${estate.taxLaw}`);
      check(law?.estate === estate.key, `country_estates.${country.tag}.${estate.key}`, 'tax law estate mismatch');
      check(law?.country === undefined || law.country === country.tag, `country_estates.${country.tag}.${estate.key}`, 'tax law country mismatch');
      for (const privilegeId of estate.privileges) {
        const privilege = content.privileges.get(privilegeId);
        check(privilege !== undefined, `country_estates.${country.tag}.${estate.key}`, `unknown privilege ${privilegeId}`);
        check(privilege?.estate === estate.key, `country_estates.${country.tag}.${estate.key}`, `privilege ${privilegeId} estate mismatch`);
      }
    }
  }
  for (const [estateKey, laws] of content.taxLawsByEstate) {
    if (FIXED_ESTATES.includes(estateKey)) {
      check(laws.length >= 3, `tax_laws.${estateKey}`, `expected >= 3 laws, got ${laws.length}`);
    }
  }
  for (const law of content.taxLaws.values()) {
    check(content.estateDefs.has(law.estate) || law.estate.startsWith('custom:'), `tax_laws.${law.id}`, 'unknown estate');
    check(law.country === undefined || content.countries.has(law.country), `tax_laws.${law.id}`, 'unknown country');
    if (law.incidence) {
      check(content.estateDefs.has(law.incidence.estate) || law.incidence.estate.startsWith('custom:'), `tax_laws.${law.id}`, 'unknown incidence estate');
      check(law.incidence.estate !== law.estate, `tax_laws.${law.id}`, 'incidence target is self');
    }
  }
  for (const privilege of content.privileges.values()) {
    check(content.estateDefs.has(privilege.estate) || privilege.estate.startsWith('custom:'), `privileges.${privilege.id}`, 'unknown estate');
    const cost = privilege.revoke.cost;
    check((cost.politicalPower ?? 0) + (cost.treasury ?? 0) > 0, `privileges.${privilege.id}`, 'revoke must cost something');
  }
}

function checkFocuses(content: ContentIndex): void {
  if (content.focuses.size === 0) return;
  const graph = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const focus of content.focuses.values()) {
    check(content.countries.has(focus.country), `focus.${focus.id}`, `unknown country ${focus.country}`);
    const prereqs = [...focus.prerequisites, ...focus.prerequisitesAny];
    graph.set(focus.id, prereqs);
    for (const prereq of prereqs) {
      const parent = content.focuses.get(prereq);
      check(parent !== undefined, `focus.${focus.id}`, `unknown prerequisite ${prereq}`);
      check(parent?.country === focus.country, `focus.${focus.id}`, `cross-country prerequisite ${prereq}`);
      const list = dependents.get(prereq) ?? [];
      list.push(focus.id);
      dependents.set(prereq, list);
    }
    for (const other of focus.mutuallyExclusive) {
      const target = content.focuses.get(other);
      check(target !== undefined, `focus.${focus.id}`, `unknown mutually exclusive ${other}`);
      check(target?.country === focus.country, `focus.${focus.id}`, `cross-country exclusion ${other}`);
      check(target?.mutuallyExclusive.includes(focus.id) === true, `focus.${focus.id}`, `asymmetric exclusion ${other}`);
    }
  }
  detectCycle(graph, 'focus');
  for (const [country, focuses] of content.focusesByCountry) {
    const roots = focuses.filter(focus => focus.prerequisites.length === 0 && focus.prerequisitesAny.length === 0);
    check(roots.length > 0, `focuses.${country}`, 'no root focus');
    const reachable = new Set<string>();
    const queue = roots.map(focus => focus.id);
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined || reachable.has(id)) continue;
      reachable.add(id);
      for (const next of dependents.get(id) ?? []) queue.push(next);
    }
    for (const focus of focuses) check(reachable.has(focus.id), `focus.${focus.id}`, 'unreachable from a root');
    const positions = new Set<string>();
    for (const focus of focuses) {
      const key = `${focus.x},${focus.y}`;
      check(!positions.has(key), `focus.${focus.id}`, `duplicate tree position ${key}`);
      positions.add(key);
    }
  }
}

function checkTechs(content: ContentIndex): void {
  if (content.techs.size === 0) return;
  const graph = new Map<string, string[]>();
  for (const tech of content.techs.values()) {
    graph.set(tech.id, tech.prerequisites);
    for (const prereq of tech.prerequisites) check(content.techs.has(prereq), `tech.${tech.id}`, `unknown prerequisite ${prereq}`);
  }
  detectCycle(graph, 'tech');
  for (const category of ['military', 'agriculture', 'administration', 'fiscal', 'thought'] as const) {
    check((content.techsByCategory.get(category)?.length ?? 0) > 0, `techs.${category}`, 'category is empty');
  }
}

function checkEvents(content: ContentIndex): void {
  for (const event of content.events.values()) {
    check(event.country === undefined || event.country === 'any' || content.countries.has(event.country), `event.${event.id}`, 'unknown country');
    if (event.aiChoice) check(event.options.some(option => option.id === event.aiChoice), `event.${event.id}`, 'aiChoice missing');
    if (event.chain) {
      const chain = content.eventChains.get(event.chain);
      check(chain !== undefined, `event.${event.id}`, `unknown chain ${event.chain}`);
      check(chain?.stages.includes(event.id) === true, `event.${event.id}`, 'event not in chain stages');
    }
  }
  for (const chain of content.eventChains.values()) {
    check(chain.stages.length >= 2 && chain.stages.length <= 6, `event_chain.${chain.id}`, 'chain length must be 2-6');
    for (const stage of chain.stages) {
      const event = content.events.get(stage);
      check(event !== undefined, `event_chain.${chain.id}`, `unknown stage ${stage}`);
      check(event?.chain === chain.id, `event_chain.${chain.id}`, `stage ${stage} chain mismatch`);
    }
  }
  for (const decision of content.decisions.values()) {
    check(content.countries.has(decision.country), `decision.${decision.id}`, 'unknown country');
  }
}

function checkScenarios(content: ContentIndex): void {
  if (content.scenarios.size === 0) return;
  for (const scenario of content.scenarios.values()) {
    check(/^\d{4}-\d{2}-\d{2}$/.test(scenario.startDate), `scenario.${scenario.id}`, 'invalid startDate');
    for (const tag of scenario.playableTags) {
      check(content.countries.has(tag), `scenario.${scenario.id}`, `unknown playable tag ${tag}`);
    }
    for (const [regionId, tag] of Object.entries(scenario.regionOwners)) {
      check(content.regions.has(regionId), `scenario.${scenario.id}`, `unknown region ${regionId}`);
      check(content.countries.has(tag), `scenario.${scenario.id}`, `unknown owner ${tag}`);
    }
    for (const [provinceId, tag] of Object.entries(scenario.provinceOverrides)) {
      check(content.provinces.has(provinceId), `scenario.${scenario.id}`, `unknown province ${provinceId}`);
      check(content.countries.has(tag), `scenario.${scenario.id}`, `unknown owner ${tag}`);
    }
    for (const tag of Object.keys(scenario.countryOverrides)) {
      check(content.countries.has(tag), `scenario.${scenario.id}`, `unknown country override ${tag}`);
    }
    for (const army of scenario.armies) {
      check(content.countries.has(army.tag), `scenario.${scenario.id}`, `unknown army tag ${army.tag}`);
      check(content.armyTemplates.has(army.template), `scenario.${scenario.id}`, `unknown template ${army.template}`);
      check(content.provinces.has(army.province), `scenario.${scenario.id}`, `unknown army province ${army.province}`);
    }
    for (const eventId of scenario.initialEvents) {
      check(content.events.has(eventId), `scenario.${scenario.id}`, `unknown initial event ${eventId}`);
    }
    for (const war of scenario.initialWars) {
      check(content.countries.has(war.attacker), `scenario.${scenario.id}`, `unknown attacker ${war.attacker}`);
      check(content.countries.has(war.defender), `scenario.${scenario.id}`, `unknown defender ${war.defender}`);
    }
  }
}

function checkBalance(content: ContentIndex): void {
  const required = [
    'landValuePerWan', 'populationValuePerPerson', 'grainPrice', 'adminCapacityBase',
    'armyUpkeepPerManMonth', 'officialSalaryPerProvinceMonth', 'dynastyStipendBaseMonth',
    'disasterReliefCost', 'foodPerPersonMonth', 'manpowerRegenRate', 'customaryTaxRate',
    'corruptionDrift', 'stabilityDrift', 'unrestDecay', 'unrestFromTax', 'rebelUnrestThreshold',
  ];
  const economy = content.balance.economy as Record<string, number>;
  for (const key of required) {
    check(typeof economy[key] === 'number', `balance.economy.${key}`, 'missing or non-numeric');
  }
  const terrainDefense = content.balance.military.terrainDefense as Record<string, number>;
  const terrainWidth = content.balance.military.terrainWidth as Record<string, number>;
  const movementCost = content.balance.military.movementCost as Record<string, number>;
  for (const terrain of TERRAINS) {
    check(typeof terrainDefense[terrain] === 'number', `balance.military.terrainDefense.${terrain}`, 'missing');
    check(typeof terrainWidth[terrain] === 'number', `balance.military.terrainWidth.${terrain}`, 'missing');
    check(typeof movementCost[terrain] === 'number', `balance.military.movementCost.${terrain}`, 'missing');
  }
}

export function validateContent(content: ContentIndex): void {
  checkMap(content);
  checkEstates(content);
  checkFocuses(content);
  checkTechs(content);
  checkEvents(content);
  checkScenarios(content);
  checkBalance(content);
}
