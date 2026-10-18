import geoJson from './data/map/provinces.geo.json';
import type { ContentIndex } from './types';
import { toMapGeo } from './loader/geo';
import { parseContent, type RawContentFile } from './loader/parse';

const modules = import.meta.glob('./data/**/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const files: RawContentFile[] = Object.entries(modules).map(([path, text]) => ({ path, text }));

export const content: ContentIndex = parseContent(files, toMapGeo(geoJson));
