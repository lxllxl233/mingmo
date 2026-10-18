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
import polygonClipping from 'polygon-clipping';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { hashSeed, mulberry32 } from '../src/engine/core/rng';
import {
  OTHER_ATLAS,
  PLAYABLE_LAND,
  PLAYABLE_MULTI,
} from './atlas-land';
import {
  SEA_LABELS,
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

function closeRing(poly: Poly): Array<[number, number]> {
  const ring: Array<[number, number]> = poly.map(([x, y]) => [x, y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);
  return ring;
}

function clipCell(cell: Poly, land: Array<Array<Array<[number, number]>>>): Poly {
  const clipped = polygonClipping.intersection([closeRing(cell)], land);
  let best: Poly = [];
  let bestArea = 0;
  for (const polygon of clipped) {
    const ring = polygon[0];
    if (!ring || ring.length < 3) continue;
    const poly: Poly = ring.map(pair => [pair[0], pair[1]]);
    const area = Math.abs(polygonArea(poly));
    if (area > bestArea) {
      best = poly;
      bestArea = area;
    }
  }
  return best;
}

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
const PORT_SEATS = new Set([
  'quanzhou', 'ningbo', 'guangzhou', 'nagasaki', 'hakata', 'anping', 'penghu',
  'songjiang', 'fuzhou', 'tamsui', 'osaka',
]);
const SEA_ROUTES = [
  { from: 'fuzhou', to: 'anping', name: '台湾海峡' },
  { from: 'quanzhou', to: 'penghu', name: '泉州—澎湖' },
  { from: 'penghu', to: 'anping', name: '澎湖—安平' },
  { from: 'tamsui', to: 'fuzhou', name: '淡水—福州' },
  { from: 'fuzhou_a', to: 'tamsui', name: '福州东—淡水' },
  { from: 'osaka', to: 'hakata', name: '濑户内海' },
  { from: 'hakata', to: 'nagasaki', name: '九州西海' },
  { from: 'nagasaki', to: 'nagasaki_a', name: '长崎湾' },
  { from: 'nagasaki_a', to: 'nagasaki_b', name: '长崎外海' },
  { from: 'nagasaki', to: 'ningbo', name: '中日航线' },
];

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
  const cells = new Map<string, Poly>();
  for (const seed of seeds) {
    const cell = voronoiCell(seed.point, landAnchors);
    const clipped = clipCell(cell.length >= 3 ? cell : [], PLAYABLE_MULTI);
    cells.set(seed.id, clipped.length >= 3 ? clipped : [
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
  for (const route of SEA_ROUTES) {
    if (!neighbors.has(route.from) || !neighbors.has(route.to)) continue;
    const fromList = neighbors.get(route.from);
    const toList = neighbors.get(route.to);
    if (fromList && !fromList.includes(route.to)) fromList.push(route.to);
    if (toList && !toList.includes(route.from)) toList.push(route.from);
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
      is_port: PORT_SEATS.has(seed.id),
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

  const otherRegions = OTHER_ATLAS.map(region => {
    let best = region.polygons[0];
    let bestArea = 0;
    for (const polygon of region.polygons) {
      const ring = polygon[0];
      if (!ring) continue;
      const area = Math.abs(polygonArea(ring));
      if (area > bestArea) {
        best = polygon;
        bestArea = area;
      }
    }
    return { name: region.name, points: best ? best[0] ?? [] : [] };
  }).filter(region => region.points.length >= 3);

  const geo = {
    version: 1,
    generatedBy: 'scripts/gen-map.ts',
    bounds: [69, 14, 151, 56],
    land: PLAYABLE_LAND,
    otherRegions,
    seaLabels: SEA_LABELS,
    seaRoutes: SEA_ROUTES,
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
  console.log(`clipped=${rows.length} population=${rows.reduce((sum, row) => sum + row.population, 0)}`);
  console.log(`wrote ${join(MAP_DIR, 'provinces.yaml')}`);
  console.log(`wrote ${join(MAP_DIR, 'provinces.geo.json')}`);
}

main();
