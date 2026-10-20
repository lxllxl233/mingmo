import type { PrefectureDef, ProvinceDef, RegionDef } from '../types';
import { ContentError, asArray, asRecord, isRecord } from './errors';

/**
 * YAML → canonical camelCase。
 *
 * 只转换结构字段。以下键的值是数据字典，必须保持原样：
 * - addModifier / modifiers：修正键是白名单 snake_case
 * - factionInfluence / estateLoyalty / estateInfluence：键是派系/阶级 id
 */
const OPAQUE_KEYS = new Set(['addModifier', 'modifiers', 'modifier', 'factionInfluence', 'addFactionInfluence', 'estateLoyalty', 'estateInfluence']);

/** 键是 ID/标签的映射：保留键，只规范化值。 */
const KEYED_MAPS = new Set(['regionOwners', 'provinceOverrides', 'countryOverrides', 'nameByCountry']);

function camelize(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

export function normalizeValue(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map(item => normalizeValue(item));
  if (!isRecord(value)) return value;
  if (parentKey !== undefined && OPAQUE_KEYS.has(parentKey)) return { ...value };
  if (parentKey !== undefined && KEYED_MAPS.has(parentKey)) {
    const keyed: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) keyed[key] = normalizeValue(child);
    return keyed;
  }
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[camelize(key)] = normalizeValue(child, camelize(key));
  }
  return result;
}

export function normalizeProvince(raw: unknown, file: string, index: number): ProvinceDef {
  const path = `provinces[${index}]`;
  const object = asRecord(raw, file, path);
  const neighbors = asArray(object['neighbors'], file, `${path}.neighbors`).map((id, i) => {
    if (typeof id !== 'string') throw new ContentError(file, `${path}.neighbors[${i}]`, 'expected string');
    return id;
  });
  const province: ProvinceDef = {
    id: String(object['id']),
    name: String(object['name']),
    prefectureId: String(object['prefecture']),
    regionId: String(object['region']),
    terrain: object['terrain'] as ProvinceDef['terrain'],
    isCoastal: Boolean(object['coastal']),
    isRiver: Boolean(object['river']),
    isPort: Boolean(object['is_port']),
    isFort: Boolean(object['fort']),
    fortLevel: Number(object['fort_level']),
    population: Number(object['population']),
    landholding: Number(object['landholding']),
    development: Number(object['development']),
    dominantEstate: String(object['dominant_estate']) as ProvinceDef['dominantEstate'],
    supplyLimit: Number(object['supply_limit']),
    neighbors,
  };
  return province;
}

export function normalizePrefecture(raw: unknown, file: string, index: number): PrefectureDef {
  const path = `prefectures[${index}]`;
  const object = asRecord(raw, file, path);
  return {
    id: String(object['id']),
    name: String(object['name']),
    regionId: String(object['region']),
  };
}

export function normalizeRegion(raw: unknown, file: string, index: number): RegionDef {
  const path = `regions[${index}]`;
  const object = asRecord(raw, file, path);
  return {
    id: String(object['id']),
    name: String(object['name']),
    group: String(object['group']),
    lon: Number(object['lon']),
    lat: Number(object['lat']),
    landmass: String(object['landmass']),
    populationWeight: Number(object['population_weight']),
    development: Number(object['development']),
    dominantEstate: String(object['dominant_estate']) as RegionDef['dominantEstate'],
  };
}
