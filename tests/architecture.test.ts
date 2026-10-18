import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ENGINE_IMPORT_BAN = [
  /from\s+['"]react['"]/,
  /from\s+['"]react-dom/,
  /from\s+['"]pixi\.js['"]/,
  /from\s+['"]zustand['"]/,
  /from\s+['"]\.\.\/(?:ui|map|app)(?:\/|['"])/,
  /from\s+['"]\.\.\/\.\.\/(?:ui|map|app)(?:\/|['"])/,
];

const ENGINE_GLOBAL_BAN = [/\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bnavigator\./];

describe('architecture boundaries', () => {
  const engineFiles = walk(join(ROOT, 'engine'));

  it('engine contains only .ts files', () => {
    expect(engineFiles.some(file => file.endsWith('.tsx'))).toBe(false);
  });

  it('engine never imports react / pixi / zustand / ui / map / app', () => {
    const violations: string[] = [];
    for (const file of engineFiles) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of ENGINE_IMPORT_BAN) {
        if (pattern.test(source)) violations.push(`${relative(ROOT, file)} :: ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('engine never touches browser globals', () => {
    const violations: string[] = [];
    for (const file of engineFiles) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of ENGINE_GLOBAL_BAN) {
        if (pattern.test(source)) violations.push(`${relative(ROOT, file)} :: ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('content never imports engine / ui / map', () => {
    const contentFiles = walk(join(ROOT, 'content'));
    const violations: string[] = [];
    for (const file of contentFiles) {
      const source = readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*engine(?:\/|['"])/.test(source)) {
        violations.push(`${relative(ROOT, file)} imports engine`);
      }
      if (/from\s+['"](?:\.\.\/)+(?:ui|map)(?:\/|['"])/.test(source)) {
        violations.push(`${relative(ROOT, file)} imports ui/map`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('simulation never uses Math.random()', () => {
    const files = [...walk(join(ROOT, 'engine')), ...walk(join(ROOT, 'content'))];
    const violations = files
      .filter(file => /Math\.random\s*\(/.test(stripComments(readFileSync(file, 'utf8'))))
      .map(file => relative(ROOT, file));
    expect(violations).toEqual([]);
  });

  it('engine has no .tsx and no direct DOM element types', () => {
    const files = walk(join(ROOT, 'engine'));
    expect(files.filter(file => /\.tsx$/.test(file))).toEqual([]);
    const suspicious = files.filter(file => /HTMLElement|HTMLCanvasElement/.test(readFileSync(file, 'utf8')));
    expect(suspicious).toEqual([]);
  });
});
