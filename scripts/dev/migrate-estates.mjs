import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  path.join(root, 'src/content/data/tax_laws/common.yaml'),
  path.join(root, 'src/content/data/tax_laws/country_specific.yaml'),
];

const estateMap = {
  tax_peasants_single_whip: 'peasants',
  tax_peasants_head_tax: 'peasants',
  tax_peasants_light: 'peasants',
  tax_peasants_surtax: 'peasants',
  tax_peasants_military_colony: 'peasants',
  tax_gentry_exemption: 'landlords',
  tax_gentry_land_survey: 'landlords',
  tax_gentry_equal_service: 'landlords',
  tax_merchants_inland_customs: 'merchants',
  tax_merchants_maritime: 'merchants',
  tax_merchants_sea_ban: 'merchants',
  tax_merchants_salt: 'merchants',
  tax_dynasty_stipend: 'ruling',
  tax_dynasty_reduced: 'ruling',
  tax_dynasty_manor: 'ruling',
  tax_nobles_full_stipend: 'ruling',
  tax_nobles_reduced_stipend: 'ruling',
  tax_nobles_manor: 'ruling',
  tax_soldiers_weisuo: 'peasants',
  tax_soldiers_mercenary: 'ruling',
  tax_soldiers_retinue: 'ruling',
  tax_officials_thin_salary: 'ruling',
  tax_officials_honesty_silver: 'ruling',
  tax_officials_meltage: 'ruling',
  tax_clergy_exempt: 'landlords',
  tax_clergy_license: 'landlords',
  tax_clergy_estate: 'landlords',
  tax_natives_tribute: 'peasants',
  tax_natives_corvee: 'peasants',
  tax_natives_trade: 'merchants',
  tax_ming_clan_reduction: 'ruling',
  tax_qing_banner_land: 'ruling',
  tax_shun_confiscation: 'landlords',
  tax_xi_terror: 'peasants',
  tax_sming_donation: 'merchants',
  tax_zheng_sea_trade: 'merchants',
  tax_mongol_herds: 'ruling',
  tax_joseon_tribute: 'peasants',
  tax_japan_kokudaka: 'peasants',
  tax_tibet_monastery: 'landlords',
  tax_voc_dividend: 'merchants',
  tax_russia_fur: 'peasants',
};

const removeIds = new Set([
  'tax_nobles_full_stipend',
  'tax_dynasty_reduced',
  'tax_dynasty_manor',
]);

const nativesIds = new Set(['tax_natives_tribute', 'tax_natives_corvee', 'tax_natives_trade']);

function processFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const out = [];
  let block = [];

  const flush = () => {
    if (block.length === 0) return;
    const header = block.find(line => /^\s*-\s+id:/.test(line));
    if (!header) {
      out.push(...block);
      block = [];
      return;
    }
    const id = header.match(/id:\s*([a-z0-9_]+)/)[1];
    if (removeIds.has(id)) {
      block = [];
      return;
    }
    const estate = estateMap[id];
    if (estate) {
      let replaced = false;
      for (let i = 0; i < block.length; i += 1) {
        if (/^\s+estate:/.test(block[i])) {
          block[i] = block[i].replace(/estate:\s*\S+/, `estate: ${estate}`);
          replaced = true;
        }
      }
      if (!replaced) {
        const idIndex = block.findIndex(line => /^\s*-\s+id:/.test(line));
        block.splice(idIndex + 1, 0, `    estate: ${estate}`);
      }
    }
    if (nativesIds.has(id)) {
      const hasCountry = block.some(line => /^\s+country:/.test(line));
      if (!hasCountry) {
        const estateIndex = block.findIndex(line => /^\s+estate:/.test(line));
        block.splice(estateIndex + 1, 0, '    country: VOC');
      }
    }
    out.push(...block);
    block = [];
  };

  for (const line of lines) {
    if (/^\s*-\s+id:/.test(line)) flush();
    block.push(line);
  }
  flush();

  let result = out.join('\n');
  if (file.endsWith('common.yaml')) {
    result = result.replace(/\s*$/, '\n') + `
  # ── 小生产者 ──────────────────────────────────────────
  - id: tax_artisans_guild
    estate: artisans
    name: 行会包税
    desc: 行会代收市税，匠户按行当摊派。征收省事，而中饱亦多。
    rate: 0.04
    efficiency: 0.7
    evasion_base: 0.2
    silver_share: 0.9
    loyalty_drift: 0
    influence_shift: 0
    effects:
      - add_modifier: { trade_efficiency_pct: 3 }
    ai_weight: 45
  - id: tax_artisans_corvee
    estate: artisans
    name: 匠户轮班
    desc: 匠户轮班应役，以力代银。官营作坊得人，市肆渐衰。
    rate: 0.02
    efficiency: 0.6
    evasion_base: 0.25
    silver_share: 0.4
    loyalty_drift: -1.0
    influence_shift: 0
    effects:
      - add_modifier: { manpower_monthly: 200 }
    ai_weight: 25
  - id: tax_artisans_market
    estate: artisans
    name: 市肆抽分
    desc: 市肆按营业额抽分，商贩裹足，而岁入稍增。
    rate: 0.06
    efficiency: 0.8
    evasion_base: 0.15
    silver_share: 1.0
    loyalty_drift: -0.8
    influence_shift: -3
    effects:
      - add_modifier: { trade_efficiency_pct: 6 }
    ai_weight: 55
`;
  }
  fs.writeFileSync(file, result);
}

for (const file of files) processFile(file);
console.log('tax laws migrated');
