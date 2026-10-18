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

const PLAYABLE_NAMES = new Set([
  'China', 'Mongolia', 'North Korea', 'South Korea', 'Japan', 'Taiwan', 'Russia',
  'Vietnam', 'Laos', 'Cambodia', 'Thailand', 'Myanmar',
]);
const OTHER_GROUPS: Record<string, string[]> = {
  中亚: ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Afghanistan'],
  南亚: ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Sri Lanka'],
  南洋: ['Malaysia', 'Indonesia', 'Philippines', 'Brunei'],
};

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

const countryGeometry = new Map<string, AtlasMultiPolygon>();
for (const item of features) {
  const name = typeof item.properties?.['name'] === 'string' ? item.properties['name'] : '';
  if (!name || !item.geometry) continue;
  countryGeometry.set(name, clipToBounds(geometryToMulti(item.geometry)));
}

function featuresToRegions(names: Set<string>): AtlasRegion[] {
  const regions: AtlasRegion[] = [];
  for (const name of names) {
    const polygons = (countryGeometry.get(name) ?? [])
      .filter(polygon => polygon[0] && Math.abs(polygonArea(polygon[0])) > 0.02);
    if (polygons.length > 0) regions.push({ name, polygons });
  }
  return regions;
}

function unionGroup(names: string[]): AtlasRegion | null {
  const all = names.flatMap(name => countryGeometry.get(name) ?? []);
  const first = all[0];
  if (!first) return null;
  const merged = all.length === 1 ? [first] : polygonClipping.union(first, ...all.slice(1));
  const polygons = merged.filter(polygon => polygon[0] && Math.abs(polygonArea(polygon[0])) > 0.02);
  return polygons.length > 0 ? { name: '', polygons } : null;
}

export const PLAYABLE_ATLAS = featuresToRegions(PLAYABLE_NAMES);
export const OTHER_ATLAS: AtlasRegion[] = Object.entries(OTHER_GROUPS)
  .map(([name, countries]) => {
    const region = unionGroup(countries);
    return region ? { ...region, name } : null;
  })
  .filter((region): region is AtlasRegion => region !== null);

export const PLAYABLE_MULTI: AtlasPolygon[] = PLAYABLE_ATLAS.flatMap(region => region.polygons);
export const PLAYABLE_LAND: AtlasRing[] = PLAYABLE_MULTI
  .map(polygon => polygon[0])
  .filter((ring): ring is AtlasRing => ring !== undefined && ring.length >= 3);
