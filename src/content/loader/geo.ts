import type { MapGeo } from '../types';

export interface RawMapGeo {
  version: number;
  bounds: number[];
  provinces: Record<string, number[][]>;
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
  return { version: raw.version, bounds: [minLon, minLat, maxLon, maxLat], provinces };
}
