import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import polygonClipping from 'polygon-clipping';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

export type AtlasPoint = [number, number];
export type AtlasRing = AtlasPoint[];
export type AtlasPolygon = AtlasRing[];
export type AtlasMultiPolygon = AtlasPolygon[];

export interface AtlasRegion {
  name: string;
  polygons: AtlasPolygon[];
}

const BOUNDS = [69, 14, 151, 56] as const;
const BBOX_RING: AtlasRing = [
  [BOUNDS[0], BOUNDS[1]], [BOUNDS[2], BOUNDS[1]],
  [BOUNDS[2], BOUNDS[3]], [BOUNDS[0], BOUNDS[3]], [BOUNDS[0], BOUNDS[1]],
];

function closeRing(ring: AtlasRing): AtlasRing {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) return [...ring, first];
  return ring;
}

function toPoint(position: Position): AtlasPoint {
  const lon = position[0];
  const lat = position[1];
  if (lon === undefined || lat === undefined) throw new Error('invalid atlas coordinate');
  return [lon, lat];
}

function geometryToMulti(geometry: Geometry): AtlasMultiPolygon {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates.map(ring => closeRing(ring.map(toPoint)))];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(polygon => polygon.map(ring => closeRing(ring.map(toPoint))));
  }
  return [];
}

function clipToBounds(multi: AtlasMultiPolygon): AtlasMultiPolygon {
  if (multi.length === 0) return [];
  const clipped = polygonClipping.intersection(multi, [[BBOX_RING]]);
  return clipped.map(polygon => polygon.map(ring => ring.map(pair => [pair[0], pair[1]] as AtlasPoint)));
}

const raw = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'),
) as Topology<{ countries: GeometryCollection }>;
const collection = feature(raw, raw.objects.countries) as FeatureCollection;
const features = collection.features;

const PLAYABLE_NAMES = new Set(['China', 'Mongolia', 'North Korea', 'South Korea', 'Japan', 'Taiwan', 'Russia']);
const OTHER_NAMES: Record<string, string> = {
  India: '印度',
  Vietnam: '越南',
  Laos: '老挝',
  Cambodia: '柬埔寨',
  Thailand: '泰国',
  Myanmar: '缅甸',
  Malaysia: '马来亚',
  Indonesia: '东印度群岛',
  Philippines: '吕宋',
};

function featuresToRegions(names: Set<string> | null): AtlasRegion[] {
  const regions: AtlasRegion[] = [];
  for (const item of features) {
    const name = typeof item.properties?.['name'] === 'string' ? item.properties['name'] : '';
    if (!name) continue;
    if (names && !names.has(name)) continue;
    if (!names && !(name in OTHER_NAMES)) continue;
    if (!item.geometry) continue;
    const clipped = clipToBounds(geometryToMulti(item.geometry));
    const polygons = clipped.filter(polygon => polygon[0] && Math.abs(polygonArea(polygon[0])) > 0.02);
    if (polygons.length === 0) continue;
    regions.push({ name: names ? name : OTHER_NAMES[name] ?? name, polygons });
  }
  return regions;
}

function polygonArea(ring: AtlasRing): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

export const PLAYABLE_ATLAS = featuresToRegions(PLAYABLE_NAMES);
export const OTHER_ATLAS = featuresToRegions(null);

export const PLAYABLE_MULTI: AtlasPolygon[] = PLAYABLE_ATLAS.flatMap(region => region.polygons);
export const PLAYABLE_LAND: AtlasRing[] = PLAYABLE_MULTI
  .map(polygon => polygon[0])
  .filter((ring): ring is AtlasRing => ring !== undefined && ring.length >= 3);
