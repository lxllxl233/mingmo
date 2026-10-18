import { ContentError, asArray, asRecord } from './errors';

export const MODIFIER_KEYS = new Set([
  'stability_add', 'stability_monthly', 'mandate_add', 'corruption_add',
  'corruption_drift', 'unrest_monthly', 'famine_resistance', 'authority_add',
  'political_power_monthly', 'tax_efficiency_pct', 'trade_efficiency_pct',
  'food_output_pct', 'pop_growth_pct', 'manpower_add', 'army_attack_pct',
  'army_defense_pct', 'cavalry_attack_pct', 'artillery_attack_pct',
  'siege_speed_pct', 'fort_defense_pct', 'morale_add', 'discipline_pct',
  'research_speed_pct', 'focus_speed_pct', 'unrest_add', 'devastation_add',
  'supply_limit_add', 'naval_attack_pct', 'army_upkeep_pct', 'inflation_add',
]);

const TRIGGER_KEYS = new Set([
  'all', 'any', 'not', 'date', 'owns', 'controls', 'atWarWith', 'hasFlag',
  'notHasFlag', 'treasury', 'stability', 'mandate', 'authority', 'corruption',
  'armySize', 'provinceCount', 'factionInfluence', 'relation', 'year',
  'hasTech', 'hasAdvisor', 'controlsCapital', 'isAtWar', 'estateLoyalty',
  'estateInfluence', 'taxLaw', 'hasPrivilege',
]);

const CMP_KEYS = new Set(['lt', 'lte', 'gt', 'gte', 'eq']);

const NUMERIC_EFFECTS = new Set([
  'addStability', 'addMandate', 'addCorruption', 'addAuthority',
  'addPoliticalPower', 'addTreasury', 'addFood', 'addManpower',
  'addArmyLoyalty', 'addInflation',
]);

const EFFECT_KEYS = new Set([
  ...NUMERIC_EFFECTS,
  'addFactionInfluence', 'addEstateLoyalty', 'addEstateInfluence',
  'setTaxLaw', 'grantPrivilege', 'revokePrivilege', 'setFlag', 'clearFlag',
  'addModifier', 'addCountryModifier', 'addProvinceModifier', 'changeCapital',
  'unlockUnit', 'unlockDecision', 'addTech', 'addCore', 'addClaim',
  'addRelation', 'declareWar', 'spawnArmy', 'changeOwner', 'triggerEvent',
  'if', 'randomList',
]);

function fail(file: string, path: string, message: string): never {
  throw new ContentError(file, path, message);
}

function expectString(value: unknown, file: string, path: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(file, path, 'expected non-empty string');
  return value;
}

function expectNumber(value: unknown, file: string, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(file, path, 'expected finite number');
  return value;
}

export function validateCmp(value: unknown, file: string, path: string): void {
  const object = asRecord(value, file, path);
  const keys = Object.keys(object);
  if (keys.length !== 1 || !CMP_KEYS.has(keys[0] ?? '')) {
    fail(file, path, `expected exactly one of ${[...CMP_KEYS].join('/')}`);
  }
  expectNumber(object[keys[0] as string], file, `${path}.${keys[0]}`);
}

export function validateTrigger(value: unknown, file: string, path: string, depth = 0): void {
  if (depth > 5) fail(file, path, 'trigger nesting too deep (max 5)');
  const object = asRecord(value, file, path);
  const keys = Object.keys(object);
  if (keys.length !== 1) fail(file, path, 'trigger must have exactly one key');
  const key = keys[0] as string;
  if (!TRIGGER_KEYS.has(key)) fail(file, `${path}.${key}`, 'unknown trigger key');
  const payload = object[key];

  if (key === 'all' || key === 'any') {
    const items = asArray(payload, file, `${path}.${key}`);
    if (items.length === 0) fail(file, `${path}.${key}`, 'must not be empty');
    items.forEach((item, index) => validateTrigger(item, file, `${path}.${key}[${index}]`, depth + 1));
    return;
  }
  if (key === 'not') {
    validateTrigger(payload, file, `${path}.not`, depth + 1);
    return;
  }
  if (key === 'date') {
    const date = asRecord(payload, file, `${path}.date`);
    for (const field of ['after', 'before']) {
      if (date[field] !== undefined) expectString(date[field], file, `${path}.date.${field}`);
    }
    return;
  }
  if (key === 'factionInfluence') {
    const record = asRecord(payload, file, `${path}.${key}`);
    for (const [name, cmp] of Object.entries(record)) validateCmp(cmp, file, `${path}.${key}.${name}`);
    return;
  }
  if (key === 'estateLoyalty' || key === 'estateInfluence') {
    const record = asRecord(payload, file, `${path}.${key}`);
    for (const [name, cmp] of Object.entries(record)) validateCmp(cmp, file, `${path}.${key}.${name}`);
    return;
  }
  if (key === 'relation') {
    const relation = asRecord(payload, file, `${path}.relation`);
    expectString(relation['target'], file, `${path}.relation.target`);
    validateCmp(
      Object.fromEntries(Object.entries(relation).filter(([name]) => name !== 'target')),
      file,
      `${path}.relation`,
    );
    return;
  }
  if (key === 'taxLaw') {
    const taxLaw = asRecord(payload, file, `${path}.taxLaw`);
    expectString(taxLaw['estate'], file, `${path}.taxLaw.estate`);
    expectString(taxLaw['is'], file, `${path}.taxLaw.is`);
    return;
  }
  if (key === 'controlsCapital' || key === 'isAtWar') {
    if (typeof payload !== 'boolean') fail(file, `${path}.${key}`, 'expected boolean');
    return;
  }
  if (key === 'treasury' || key === 'stability' || key === 'mandate' || key === 'authority'
    || key === 'corruption' || key === 'armySize' || key === 'provinceCount' || key === 'year') {
    validateCmp(payload, file, `${path}.${key}`);
    return;
  }
  expectString(payload, file, `${path}.${key}`);
}

export function validateModifier(value: unknown, file: string, path: string): void {
  const object = asRecord(value, file, path);
  for (const [key, number] of Object.entries(object)) {
    if (!MODIFIER_KEYS.has(key)) fail(file, `${path}.${key}`, 'unknown modifier key');
    expectNumber(number, file, `${path}.${key}`);
  }
}

function field(object: Record<string, unknown>, key: string, file: string, path: string): unknown {
  const value = object[key];
  if (value === undefined) fail(file, `${path}.${key}`, 'missing field');
  return value;
}

export function validateEffect(value: unknown, file: string, path: string): void {
  const object = asRecord(value, file, path);
  const keys = Object.keys(object);
  if (keys.length !== 1) fail(file, path, 'effect must have exactly one key');
  const key = keys[0] as string;
  if (!EFFECT_KEYS.has(key)) fail(file, `${path}.${key}`, 'unknown effect key');
  const payload = object[key];

  if (NUMERIC_EFFECTS.has(key)) {
    expectNumber(payload, file, `${path}.${key}`);
    return;
  }
  if (key === 'setFlag' || key === 'clearFlag' || key === 'changeCapital'
    || key === 'unlockUnit' || key === 'unlockDecision' || key === 'addTech'
    || key === 'addCore' || key === 'addClaim') {
    expectString(payload, file, `${path}.${key}`);
    return;
  }
  if (key === 'addFactionInfluence') {
    const record = asRecord(payload, file, `${path}.${key}`);
    for (const [name, number] of Object.entries(record)) expectNumber(number, file, `${path}.${key}.${name}`);
    return;
  }
  if (key === 'addEstateLoyalty' || key === 'addEstateInfluence') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'estate', file, path), file, `${path}.${key}.estate`);
    expectNumber(field(record, 'value', file, path), file, `${path}.${key}.value`);
    return;
  }
  if (key === 'setTaxLaw') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'estate', file, path), file, `${path}.${key}.estate`);
    expectString(field(record, 'law', file, path), file, `${path}.${key}.law`);
    return;
  }
  if (key === 'grantPrivilege' || key === 'revokePrivilege') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'estate', file, path), file, `${path}.${key}.estate`);
    expectString(field(record, 'privilege', file, path), file, `${path}.${key}.privilege`);
    return;
  }
  if (key === 'addModifier') {
    validateModifier(payload, file, `${path}.addModifier`);
    return;
  }
  if (key === 'addCountryModifier' || key === 'addProvinceModifier') {
    const record = asRecord(payload, file, `${path}.${key}`);
    if (key === 'addProvinceModifier') expectString(field(record, 'province', file, path), file, `${path}.${key}.province`);
    expectString(field(record, 'modifier', file, path), file, `${path}.${key}.modifier`);
    expectNumber(field(record, 'days', file, path), file, `${path}.${key}.days`);
    return;
  }
  if (key === 'addRelation') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'target', file, path), file, `${path}.${key}.target`);
    expectNumber(field(record, 'value', file, path), file, `${path}.${key}.value`);
    return;
  }
  if (key === 'declareWar') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'target', file, path), file, `${path}.${key}.target`);
    expectString(field(record, 'cb', file, path), file, `${path}.${key}.cb`);
    return;
  }
  if (key === 'spawnArmy') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'province', file, path), file, `${path}.${key}.province`);
    expectString(field(record, 'template', file, path), file, `${path}.${key}.template`);
    expectNumber(field(record, 'size', file, path), file, `${path}.${key}.size`);
    return;
  }
  if (key === 'changeOwner') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'province', file, path), file, `${path}.${key}.province`);
    expectString(field(record, 'to', file, path), file, `${path}.${key}.to`);
    return;
  }
  if (key === 'triggerEvent') {
    const record = asRecord(payload, file, `${path}.${key}`);
    expectString(field(record, 'id', file, path), file, `${path}.${key}.id`);
    expectNumber(field(record, 'delayDays', file, path), file, `${path}.${key}.delayDays`);
    return;
  }
  if (key === 'if') {
    const record = asRecord(payload, file, `${path}.if`);
    validateTrigger(field(record, 'trigger', file, path), file, `${path}.if.trigger`);
    const then = asArray(field(record, 'then', file, path), file, `${path}.if.then`);
    then.forEach((effect, index) => validateEffect(effect, file, `${path}.if.then[${index}]`));
    if (record['else'] !== undefined) {
      const otherwise = asArray(record['else'], file, `${path}.if.else`);
      otherwise.forEach((effect, index) => validateEffect(effect, file, `${path}.if.else[${index}]`));
    }
    return;
  }
  if (key === 'randomList') {
    const list = asArray(payload, file, `${path}.randomList`);
    if (list.length === 0) fail(file, `${path}.randomList`, 'must not be empty');
    list.forEach((entry, index) => {
      const record = asRecord(entry, file, `${path}.randomList[${index}]`);
      expectNumber(field(record, 'weight', file, path), file, `${path}.randomList[${index}].weight`);
      const effects = asArray(field(record, 'effect', file, path), file, `${path}.randomList[${index}].effect`);
      effects.forEach((effect, effectIndex) => validateEffect(effect, file, `${path}.randomList[${index}].effect[${effectIndex}]`));
    });
    return;
  }
  fail(file, `${path}.${key}`, 'unhandled effect key');
}

export function validateEffectList(value: unknown, file: string, path: string): void {
  const list = asArray(value, file, path);
  list.forEach((effect, index) => validateEffect(effect, file, `${path}[${index}]`));
}

export function validateOptionalTrigger(value: unknown, file: string, path: string): void {
  if (value !== undefined) validateTrigger(value, file, path);
}
