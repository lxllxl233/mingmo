import type { MapGeo } from '../types';

export interface RawMapGeo {
  version: number;
  bounds: number[];
  provinces: Record<string, number[][]>;
  land?: number[][][];
  otherRegions?: Array<{ name: string; points: number[][] }>;
  seaLabels?: Array<{ name: string; lon: number; lat: number }>;
  seaRoutes?: Array<{ from: string; to: string; name: string }>;
}

export function toMapGeo(raw: RawMapGeo): MapGeo {
  const [minLon, minLat, maxLon, maxLat] = raw.bounds;
  if (minLon === undefined || minLat === undefined || maxLon === undefined || maxLat === undefined) {
    throw new Error('invalid map bounds');
  }
  const provinces: MapGeo['provinces'] = {};
  for (const [id, points] of Object.entries(raw.provinces)) {
    provinces[id] = points.map(point => {
      const lon = point[0];
      const lat = point[1];
      if (lon === undefined || lat === undefined) throw new Error(`invalid polygon point for ${id}`);
      return [lon, lat];
    });
  }
  const land = (raw.land ?? []).map(polygon => polygon.map(point => {
    const lon = point[0];
    const lat = point[1];
    if (lon === undefined || lat === undefined) throw new Error('invalid land polygon point');
    return [lon, lat] as [number, number];
  }));
  const otherRegions = (raw.otherRegions ?? []).map(region => ({
    name: region.name,
    points: region.points.map(point => {
      const lon = point[0];
      const lat = point[1];
      if (lon === undefined || lat === undefined) throw new Error('invalid other region point');
      return [lon, lat] as [number, number];
    }),
  }));
  return {
    version: raw.version,
    bounds: [minLon, minLat, maxLon, maxLat],
    provinces,
    land,
    otherRegions,
    seaLabels: raw.seaLabels ?? [],
    seaRoutes: raw.seaRoutes ?? [],
  };
}
