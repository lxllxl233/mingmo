import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentIndex, MapGeo } from '../types';
import { parseContent, type RawContentFile } from './parse';

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith('.yaml')) files.push(full);
  }
  return files;
}

export function loadContentFromDirectory(root = join(process.cwd(), 'src', 'content', 'data')): ContentIndex {
  const files: RawContentFile[] = walk(root).map(path => ({
    path,
    text: readFileSync(path, 'utf8'),
  }));
  const geo = JSON.parse(readFileSync(join(root, 'map', 'provinces.geo.json'), 'utf8')) as MapGeo;
  return parseContent(files, geo);
}

export { parseContent };
export type { RawContentFile };
