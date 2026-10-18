/**
 * 地图生成：160 府 → 480 省 → Voronoi 多边形 → 邻接表。
 *
 * 关键改动：省锚点不再是「每个地区 5 个椭圆点」，而是从 0.42° 陆地点阵中
 * 按府锚点就近取 3 个，保证中国本土密度高、边疆密度低，且省形均匀。
 *
 * 运行：pnpm gen:map
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { hashSeed, mulberry32 } from '../src/engine/core/rng';
import {
  HAINAN,
  JAPAN,
  MAINLAND,
  TAIWAN,
  isCoastal,
  isLand,
  isRiver,
  landCandidates,
  polygonArea,
  polygonDistance,
  voronoiCell,
  type Point,
  type Poly,
} from './map-geometry';

interface Region {
  id: string;
  name: string;
  lon: number;
  lat: number;
  rx: number;
  ry: number;
  landmass: 'mainland' | 'japan' | 'taiwan';
  population_weight: number;
  development: number;
  dominant_estate: string;
  terrain: string[];
}

interface Prefecture {
  id: string;
  name: string;
  region: string;
  seat?: string;
  lon?: number;
  lat?: number;
}

interface Seed {
  id: string;
  name: string;
  prefecture: string;
  region: string;
  point: Point;
}

const ROOT = process.cwd();
const MAP_DIR = join(ROOT, 'src', 'content', 'data', 'map');

const KEY_FORTS = new Set([
  'beijing', 'shanhaiguan', 'ningyuan', 'jinzhou', 'shenyang', 'liaoyang',
  'guangning', 'taiyuan', 'datong', 'xian', 'kaifeng', 'xiangyang',
  'yangzhou', 'nanjing', 'hangzhou', 'wuchang', 'chengdu', 'chongqing',
  'guilin', 'guangzhou', 'fuzhou', 'quanzhou', 'penghu', 'anping',
  'hanseong', 'edo', 'albazin', 'nerchinsk', 'tengyue', 'lhasa',
]);

const KEY_CAPITALS = new Set(['beijing', 'nanjing', 'xian', 'shenyang', 'edo', 'hanseong', 'lhasa']);
const PORT_SEATS = new Set(['quanzhou', 'ningbo', 'guangzhou', 'nagasaki', 'hakata', 'anping', 'penghu', 'songjiang']);

function keyOf(point: Point): string {
  return `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
}

function placePrefecture(pref: Prefecture, region: Region, index: number, count: number): Point {
  if (pref.lon !== undefined && pref.lat !== undefined) return [pref.lon, pref.lat];
  const baseAngle = index * 2.399963229728653;
  const jitter = (hashSeed(pref.id) % 1000) / 1000;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const shrink = 1 - attempt / 320;
    const radius = Math.sqrt((index + 0.5) / count) * 0.9 * shrink;
    const angle = baseAngle + jitter * 0.8 + attempt * 0.37;
    const point: Point = [
      region.lon + Math.cos(angle) * region.rx * radius,
      region.lat + Math.sin(angle) * region.ry * radius,
    ];
    if (isLand(point)) return point;
  }
  return [region.lon, region.lat];
}

function takeNearest(target: Point, candidates: Point[], used: Set<string>, maxDistance: number): Point | null {
  let best: Point | null = null;
  let bestDistance = maxDistance;
  for (const candidate of candidates) {
    if (used.has(keyOf(candidate))) continue;
    const distance = Math.hypot(candidate[0] - target[0], candidate[1] - target[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function main(): void {
  const regionsDoc = parseYaml(readFileSync(join(MAP_DIR, 'regions.yaml'), 'utf8')) as { regions: Region[] };
  const prefsDoc = parseYaml(readFileSync(join(MAP_DIR, 'prefectures.yaml'), 'utf8')) as { prefectures: Prefecture[] };
  const regions = regionsDoc.regions;
  const prefs = prefsDoc.prefectures;
  if (regions.length !== 30) throw new Error(`expected 30 regions, got ${regions.length}`);
  if (prefs.length !== 160) throw new Error(`expected 160 prefectures, got ${prefs.length}`);

  const regionById = new Map(regions.map(region => [region.id, region]));
  const byRegion = new Map<string, Prefecture[]>();
  for (const pref of prefs) {
    const list = byRegion.get(pref.region) ?? [];
    list.push(pref);
    byRegion.set(pref.region, list);
  }

  const candidates = landCandidates(0.42);
  if (candidates.length < 600) throw new Error(`not enough land candidates: ${candidates.length}`);
  const used = new Set<string>();
  const seeds: Seed[] = [];

  const ordered = [...prefs].sort((a, b) => {
    const aKey = a.lon !== undefined ? 0 : 1;
    const bKey = b.lon !== undefined ? 0 : 1;
    if (aKey !== bKey) return aKey - bKey;
    return a.id.localeCompare(b.id);
  });

  for (const pref of ordered) {
    const region = regionById.get(pref.region);
    if (!region) throw new Error(`unknown region ${pref.region}`);
    const list = byRegion.get(pref.region) ?? [];
    const index = list.indexOf(pref);
    const target = placePrefecture(pref, region, index, list.length);
    const isKey = pref.lon !== undefined && pref.lat !== undefined;
    const seatId = pref.seat ?? pref.id.replace(/^pref_/, '');

    let seat: Point;
    if (isKey) {
      seat = [pref.lon as number, pref.lat as number];
      const nearest = takeNearest(seat, candidates, used, 2.0);
      if (nearest) used.add(keyOf(nearest));
    } else {
      const picked = takeNearest(target, candidates, used, 4.0);
      seat = picked ?? target;
      used.add(keyOf(seat));
    }

    const rng = mulberry32(hashSeed(pref.id, 'children'));
    const angle = rng.next() * Math.PI * 2;
    const offset = region.landmass === 'mainland' ? 0.34 : 0.12;
    const childA = takeNearest(
      [seat[0] + Math.cos(angle) * offset, seat[1] + Math.sin(angle) * offset],
      candidates,
      used,
      2.2,
    );
    const childB = takeNearest(
      [seat[0] - Math.cos(angle) * offset, seat[1] - Math.sin(angle) * offset],
      candidates,
      used,
      2.2,
    );

    const points: Array<{ id: string; name: string; point: Point }> = [
      { id: seatId, name: pref.name, point: seat },
      { id: `${seatId}_a`, name: `${pref.name}东`, point: childA ?? [seat[0] + 0.05, seat[1] + 0.05] },
      { id: `${seatId}_b`, name: `${pref.name}西`, point: childB ?? [seat[0] - 0.05, seat[1] - 0.05] },
    ];
    for (const entry of points) {
      used.add(keyOf(entry.point));
      seeds.push({
        id: entry.id,
        name: entry.name,
        prefecture: pref.id,
        region: pref.region,
        point: entry.point,
      });
    }
  }

  if (seeds.length !== 480) throw new Error(`expected 480 provinces, got ${seeds.length}`);
  const ids = new Set(seeds.map(seed => seed.id));
  if (ids.size !== 480) throw new Error('duplicate province id');

  const landAnchors = seeds.map(seed => seed.point);
  const seaAnchors: Point[] = [];
  const seenSea = new Set<string>();
  const addSea = (point: Point): void => {
    const key = keyOf(point);
    if (seenSea.has(key) || isLand(point)) return;
    seenSea.add(key);
    seaAnchors.push([Number(point[0].toFixed(3)), Number(point[1].toFixed(3))]);
  };
  for (let lon = 69.4; lon <= 150.6; lon += 0.9) {
    for (let lat = 14.4; lat <= 55.6; lat += 0.9) addSea([lon, lat]);
  }
  for (const polygon of [MAINLAND, JAPAN, TAIWAN, HAINAN]) {
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (!a || !b) continue;
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55));
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        addSea([a[0] + dx * t + nx * 0.30, a[1] + dy * t + ny * 0.30]);
      }
    }
  }

  // 只保留靠近陆省的的海锚点：远处海点不会切到陆省，白算。
  const nearSeed = (point: Point): boolean => {
    for (const seed of seeds) {
      if (Math.hypot(seed.point[0] - point[0], seed.point[1] - point[1]) < 2.6) return true;
    }
    return false;
  };
  const localSea = seaAnchors.filter(nearSeed);
  const allAnchors = [...landAnchors, ...localSea];

  const cells = new Map<string, Poly>();
  for (const seed of seeds) {
    const cell = voronoiCell(seed.point, allAnchors);
    cells.set(seed.id, cell.length >= 3 && polygonArea(cell) > 1e-7 ? cell : [
      [seed.point[0] - 0.04, seed.point[1] - 0.04],
      [seed.point[0] + 0.04, seed.point[1] - 0.04],
      [seed.point[0] + 0.04, seed.point[1] + 0.04],
      [seed.point[0] - 0.04, seed.point[1] + 0.04],
    ]);
  }

  const neighbors = new Map<string, string[]>();
  for (const seed of seeds) neighbors.set(seed.id, []);
  for (let i = 0; i < seeds.length; i += 1) {
    const a = seeds[i];
    const cellA = a ? cells.get(a.id) : undefined;
    if (!a || !cellA) continue;
    for (let j = i + 1; j < seeds.length; j += 1) {
      const b = seeds[j];
      const cellB = b ? cells.get(b.id) : undefined;
      if (!b || !cellB) continue;
      if (polygonDistance(cellA, cellB) < 0.018) {
        neighbors.get(a.id)?.push(b.id);
        neighbors.get(b.id)?.push(a.id);
      }
    }
  }
  for (const seed of seeds) {
    const list = neighbors.get(seed.id) ?? [];
    if (list.length === 0) {
      let nearest = '';
      let distance = Number.POSITIVE_INFINITY;
      for (const other of seeds) {
        if (other.id === seed.id) continue;
        const d = Math.hypot(other.point[0] - seed.point[0], other.point[1] - seed.point[1]);
        if (d < distance) {
          distance = d;
          nearest = other.id;
        }
      }
      if (nearest) {
        neighbors.get(seed.id)?.push(nearest);
        neighbors.get(nearest)?.push(seed.id);
      }
    }
    list.sort();
  }

  const totalWeight = regions.reduce((sum, region) => sum + region.population_weight, 0);
  const targetPopulation = 110_000_000;
  const rows = seeds.map(seed => {
    const region = regionById.get(seed.region);
    if (!region) throw new Error(`unknown region ${seed.region}`);
    const prefCount = (byRegion.get(seed.region) ?? []).length || 1;
    const rng = mulberry32(hashSeed(seed.id, 'stats'));
    const regionPopulation = (region.population_weight / totalWeight) * targetPopulation;
    const prefPopulation = regionPopulation / prefCount;
    const capitalBonus = KEY_CAPITALS.has(seed.id) ? 2.4 : 1;
    const population = Math.max(1000, Math.round((prefPopulation / 3) * capitalBonus * (0.82 + rng.next() * 0.36)));
    const development = Math.max(1, Math.min(100, Math.round(
      region.development + (rng.next() - 0.5) * 14 + (KEY_CAPITALS.has(seed.id) ? 12 : 0),
    )));
    const terrainOptions = region.terrain.map(t => (t === 'coastal' ? 'hills' : t));
    const terrain = KEY_CAPITALS.has(seed.id) && (seed.id === 'beijing' || seed.id === 'nanjing')
      ? 'urban'
      : (rng.pick(terrainOptions) as string);
    const coastal = isCoastal(seed.point);
    const river = isRiver(seed.point);
    const fort = KEY_FORTS.has(seed.id) || rng.chance(0.12);
    const fortLevel = KEY_FORTS.has(seed.id)
      ? 5 + (hashSeed(seed.id, 'fort') % 4)
      : fort ? 1 + (hashSeed(seed.id, 'fort') % 3) : 0;
    const dominantEstate = PORT_SEATS.has(seed.id)
      ? 'merchants'
      : coastal && region.dominant_estate === 'peasants' && rng.chance(0.25)
        ? 'merchants'
        : region.dominant_estate;
    const supplyLimit = Math.round(development * 260 + population / 90);
    return {
      id: seed.id,
      name: seed.name,
      prefecture: seed.prefecture,
      region: seed.region,
      terrain,
      coastal,
      river,
      fort,
      fort_level: fortLevel,
      population,
      landholding: Math.round(population / 1000),
      development,
      dominant_estate: dominantEstate,
      supply_limit: supplyLimit,
      neighbors: neighbors.get(seed.id) ?? [],
    };
  });

  const populationSum = rows.reduce((sum, row) => sum + row.population, 0);
  const scale = targetPopulation / populationSum;
  for (const row of rows) {
    row.population = Math.round(row.population * scale);
    row.landholding = Math.round(row.population / 1000);
  }

  const geo = {
    version: 1,
    generatedBy: 'scripts/gen-map.ts',
    bounds: [69, 14, 151, 56],
    land: [MAINLAND, JAPAN, TAIWAN, HAINAN].map(polygon => polygon.map(([lon, lat]) => [lon, lat])),
    provinces: Object.fromEntries(
      seeds.map(seed => [
        seed.id,
        (cells.get(seed.id) ?? []).map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]),
      ]),
    ),
  };

  writeFileSync(join(MAP_DIR, 'provinces.yaml'), `${stringifyYaml({ provinces: rows }, { lineWidth: 0 })}\n`, 'utf8');
  writeFileSync(join(MAP_DIR, 'provinces.geo.json'), `${JSON.stringify(geo)}\n`, 'utf8');
  const totalNeighbors = rows.reduce((sum, row) => sum + row.neighbors.length, 0) / 2;
  console.log(`regions=${regions.length} prefectures=${prefs.length} provinces=${rows.length} edges=${totalNeighbors}`);
  console.log(`seaAnchors=${localSea.length} population=${rows.reduce((sum, row) => sum + row.population, 0)}`);
  console.log(`wrote ${join(MAP_DIR, 'provinces.yaml')}`);
  console.log(`wrote ${join(MAP_DIR, 'provinces.geo.json')}`);
}

main();
