import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = path.join(root, 'src/content/data');

const estateMap = {
  dynasty: 'ruling',
  nobles: 'ruling',
  officials: 'ruling',
  soldiers: 'ruling',
  gentry: 'landlords',
  clergy: 'landlords',
  merchants: 'merchants',
  peasants: 'peasants',
  'custom:natives': 'peasants',
};

function migrateProvinceFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let urban = false;
  const out = lines.map(line => {
    if (/^\s*-\s+id:/.test(line)) urban = false;
    if (/^\s+terrain:\s*urban\s*$/.test(line)) urban = true;
    if (/^\s+dominant_estate:/.test(line)) {
      const old = line.match(/dominant_estate:\s*(\S+)/)?.[1] ?? '';
      const next = urban ? 'artisans' : (estateMap[old] ?? old);
      return line.replace(/dominant_estate:\s*\S+/, `dominant_estate: ${next}`);
    }
    return line;
  });
  fs.writeFileSync(file, out.join('\n'));
}

function migrateEstateLines(file) {
  const text = fs.readFileSync(file, 'utf8');
  const next = text
    .replace(
      /(\bestate:\s*)(dynasty|nobles|officials|soldiers|gentry|clergy|custom:natives)\b/g,
      (_, prefix, old) => `${prefix}${estateMap[old]}`,
    )
    .replace(/^.*estate_(?:loyalty|influence):.*$/gm, line =>
      line.replace(
        /\b(dynasty|nobles|officials|soldiers|gentry|clergy|custom:natives)(:)/g,
        (_, old, suffix) => `${estateMap[old]}${suffix}`,
      ));
  fs.writeFileSync(file, next);
}

function migrateArmyTemplates(file) {
  const text = fs.readFileSync(file, 'utf8');
  const next = text.replace(
    /(source_estate:\s*)(soldiers|nobles|officials|dynasty|gentry|clergy|custom:natives)\b/g,
    (_, prefix, old) => `${prefix}${estateMap[old]}`,
  );
  fs.writeFileSync(file, next);
}

migrateProvinceFile(path.join(data, 'map/provinces.yaml'));
migrateProvinceFile(path.join(data, 'map/regions.yaml'));
migrateArmyTemplates(path.join(data, 'army_templates.yaml'));

const eventsDir = path.join(data, 'events');
for (const entry of fs.readdirSync(eventsDir)) {
  if (!entry.endsWith('.yaml')) continue;
  migrateEstateLines(path.join(eventsDir, entry));
}

console.log('content migrated');
