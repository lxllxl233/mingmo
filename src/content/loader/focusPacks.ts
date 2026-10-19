import type {
  Decision,
  Effect,
  Focus,
  FocusKind,
  FocusPack,
  FocusPackBranch,
  FocusPackFocus,
  Modifier,
} from '../types';
import { ContentError, asArray, asRecord } from './errors';

const KINDS: FocusKind[] = ['court', 'economy', 'military', 'diplomacy', 'reform', 'navy', 'unique'];

const KIND_DETAIL: Record<FocusKind, string> = {
  court: '这条路线直接影响朝议效率、皇权与腐败；越往后越会触及既得利益。',
  economy: '这条路线改变税基、商税与田赋；收益较大，但会触动士绅与宗室。',
  military: '这条路线决定军费、兵源与边防；短期见效，长期依赖财政。',
  diplomacy: '这条路线改变对外关系与战争窗口；每一次选择都会留下新的敌友。',
  reform: '这条路线重建议政与行政流程；阻力很大，成功后可提高征收与稳定。',
  navy: '这条路线围绕海贸、港口与水师；收益来自关税，风险来自海疆。',
  unique: '这条路线是本势力独有的历史选择，往往决定政权性格。',
};

function parseFocus(raw: unknown, path: string): FocusPackFocus {
  const object = asRecord(raw, 'focus_packs', path);
  const id = object['id'];
  const name = object['name'];
  const tier = object['tier'];
  if (typeof id !== 'string') throw new ContentError('focus_packs', `${path}.id`, 'expected string');
  if (typeof name !== 'string') throw new ContentError('focus_packs', `${path}.name`, 'expected string');
  if (typeof tier !== 'number' || tier < 0 || tier > 6) {
    throw new ContentError('focus_packs', `${path}.tier`, 'expected 0-6');
  }
  const desc = object['desc'];
  const focus: FocusPackFocus = { id, name, tier };
  if (typeof desc === 'string') focus.desc = desc;
  const grants = object['grants'];
  if (grants !== undefined) {
    if (!Array.isArray(grants) || grants.some(value => typeof value !== 'string')) {
      throw new ContentError('focus_packs', `${path}.grants`, 'expected an array of province ids');
    }
    focus.grants = grants as string[];
  }
  const annexes = object['annexes'];
  if (annexes !== undefined) {
    if (!Array.isArray(annexes) || annexes.some(value => typeof value !== 'string')) {
      throw new ContentError('focus_packs', `${path}.annexes`, 'expected an array of province ids');
    }
    focus.annexes = annexes as string[];
  }
  return focus;
}

function parseBranch(raw: unknown, path: string): FocusPackBranch {
  const object = asRecord(raw, 'focus_packs', path);
  const name = object['name'];
  const kind = object['kind'];
  const desc = object['desc'];
  if (typeof name !== 'string') throw new ContentError('focus_packs', `${path}.name`, 'expected string');
  if (typeof kind !== 'string' || !KINDS.includes(kind as FocusKind)) {
    throw new ContentError('focus_packs', `${path}.kind`, `expected one of ${KINDS.join(', ')}`);
  }
  if (typeof desc !== 'string') throw new ContentError('focus_packs', `${path}.desc`, 'expected string');
  const focusesRaw = asArray(object['focuses'], 'focus_packs', `${path}.focuses`);
  if (focusesRaw.length !== 7) throw new ContentError('focus_packs', `${path}.focuses`, 'expected 7 focuses');
  const focuses = focusesRaw.map((focus, index) => parseFocus(focus, `${path}.focuses[${index}]`));
  const branch: FocusPackBranch = { name, kind: kind as FocusKind, desc, focuses };
  if (object['modifier'] !== undefined) {
    const modifier = asRecord(object['modifier'], 'focus_packs', `${path}.modifier`);
    const parsed: Modifier = {};
    for (const [key, value] of Object.entries(modifier)) {
      if (typeof value !== 'number') throw new ContentError('focus_packs', `${path}.modifier.${key}`, 'expected number');
      parsed[key] = value;
    }
    branch.modifier = parsed;
  }
  return branch;
}

export function parseFocusPacks(raw: unknown[], countryTags: Set<string>): FocusPack[] {
  return raw.map((item, index) => {
    const path = `focus_packs[${index}]`;
    const object = asRecord(item, 'focus_packs', path);
    const country = object['country'];
    if (typeof country !== 'string' || !countryTags.has(country)) {
      throw new ContentError('focus_packs', `${path}.country`, `unknown country ${String(country)}`);
    }
    const branchesRaw = asArray(object['branches'], 'focus_packs', `${path}.branches`);
    if (branchesRaw.length !== 6) throw new ContentError('focus_packs', `${path}.branches`, 'expected 6 branches');
    const branches = branchesRaw.map((branch, branchIndex) => parseBranch(branch, `${path}.branches[${branchIndex}]`));
    const exclusionsRaw = object['exclusions'];
    const exclusions: string[][] = [];
    if (exclusionsRaw !== undefined) {
      for (const pair of asArray(exclusionsRaw, 'focus_packs', `${path}.exclusions`)) {
        if (!Array.isArray(pair) || pair.length !== 2 || pair.some(id => typeof id !== 'string')) {
          throw new ContentError('focus_packs', `${path}.exclusions`, 'expected pairs of focus ids');
        }
        exclusions.push([pair[0] as string, pair[1] as string]);
      }
    }
    return { country, branches, exclusions };
  });
}

type EffectBuilder = (scale: number) => Effect;

/** 每个势力的国策风味：一条专属派系影响 + 一项国家资源。 */
const COUNTRY_FLAVOR: Record<string, { faction: string; effect: EffectBuilder }> = {
  MING: { faction: 'donglin', effect: scale => ({ addPoliticalPower: scale }) },
  QING: { faction: 'banners', effect: scale => ({ addManpower: 500 * scale }) },
  SHUN: { faction: 'farmers', effect: scale => ({ addFood: 5000 * scale }) },
  SMING: { faction: 'royal_clan', effect: scale => ({ addMandate: Math.max(1, Math.round(scale / 2)) }) },
  ZHENG: { faction: 'merchants', effect: scale => ({ addTreasury: 4000 * scale }) },
  MONGOL: { faction: 'nobles', effect: scale => ({ addManpower: 400 * scale }) },
  JAPAN: { faction: 'merchants', effect: scale => ({ addTreasury: 3000 * scale }) },
  JOSEON: { faction: 'officials', effect: scale => ({ addStability: Math.max(1, Math.round(scale / 2)) }) },
  XI: { faction: 'farmers', effect: scale => ({ addManpower: 600 * scale }) },
  TIBET: { faction: 'clergy', effect: scale => ({ addStability: Math.max(1, Math.round(scale / 2)) }) },
  VOC: { faction: 'merchants', effect: scale => ({ addTreasury: 3000 * scale }) },
  RUSSIA: { faction: 'military', effect: scale => ({ addTreasury: 2000 * scale }) },
};

/** 六条分支各有一项额外倾向，避免同势力内各分支只按 kind 复制。 */
const BRANCH_ACCENTS: EffectBuilder[] = [
  scale => ({ addAuthority: Math.max(1, Math.round(scale / 2)) }),
  scale => ({ addManpower: 300 * scale }),
  scale => ({ addTreasury: 3000 * scale }),
  scale => ({ addStability: Math.max(1, Math.round(scale / 2)) }),
  scale => ({ addCorruption: -Math.max(1, Math.round(scale / 2)) }),
  scale => ({ addMandate: Math.max(1, Math.round(scale / 2)) }),
];

function countryFlavorEffects(country: string, tier: number, branchIndex: number): Effect[] {
  const scale = tier + 1;
  const flavor = COUNTRY_FLAVOR[country];
  const accents: Effect[] = [];
  if (flavor) {
    accents.push({ addFactionInfluence: { [flavor.faction]: Math.max(1, Math.round(scale / 2)) } });
    accents.push(flavor.effect(scale));
  }
  const accent = BRANCH_ACCENTS[branchIndex];
  if (accent) accents.push(accent(scale));
  return accents;
}

function effectsFor(
  kind: FocusKind,
  tier: number,
  focusId: string,
  decisionId: string,
  modifier: Modifier | undefined,
  country: string,
  branchIndex: number,
): Effect[] {
  const scale = tier + 1;
  const common: Effect[] = [{ setFlag: focusId }];
  if (tier >= 6) common.push({ unlockDecision: decisionId });
  let base: Effect[];
  switch (kind) {
    case 'court':
      base = [
        { addStability: 2 * scale },
        { addCorruption: -scale },
        { addAuthority: scale },
        { addPoliticalPower: 3 + scale * 2 },
        { addModifier: { corruption_monthly: -0.01 * scale } },
      ];
      break;
    case 'economy':
      base = [
        { addModifier: { tax_efficiency_pct: 2 * scale, food_output_pct: 1.5 * scale } },
        { addEstateLoyalty: { estate: 'peasants', value: -scale } },
      ];
      break;
    case 'military':
      base = [
        { addManpower: 2000 * scale },
        { addModifier: { army_attack_pct: 2 * scale, discipline_pct: scale, army_upkeep_pct: -scale } },
        { addArmyLoyalty: 2 * scale },
      ];
      break;
    case 'diplomacy':
      base = [
        { addAuthority: scale },
        { addPoliticalPower: 1 + scale },
        { addModifier: { trade_efficiency_pct: 2 * scale, stability_monthly: 0.01 * scale } },
        { addEstateLoyalty: { estate: 'merchants', value: scale } },
      ];
      break;
    case 'reform':
      base = [
        { addStability: -scale },
        { addPoliticalPower: 2 + scale },
        { addModifier: { tax_efficiency_pct: 3 * scale, corruption_monthly: -0.01 * scale } },
        { addEstateLoyalty: { estate: 'gentry', value: -2 * scale } },
      ];
      break;
    case 'navy':
      base = [
        { addModifier: { naval_attack_pct: 3 * scale, trade_efficiency_pct: 2 * scale, food_output_pct: scale } },
      ];
      break;
    case 'unique':
      base = [
        { addModifier: modifier ?? { stability_monthly: 0.02 * scale } },
        { addFactionInfluence: { imperial: scale } },
        { addPoliticalPower: scale },
      ];
      break;
    default:
      base = [];
      break;
  }
  return [...base, ...countryFlavorEffects(country, tier, branchIndex), ...common];
}

const DECISION_COSTS: Record<FocusKind, { treasury: number; politicalPower: number; food?: number }> = {
  court: { treasury: 20000, politicalPower: 10 },
  economy: { treasury: 30000, politicalPower: 10, food: 10000 },
  military: { treasury: 30000, politicalPower: 10, food: 20000 },
  diplomacy: { treasury: 15000, politicalPower: 10 },
  reform: { treasury: 25000, politicalPower: 10 },
  navy: { treasury: 20000, politicalPower: 10 },
  unique: { treasury: 25000, politicalPower: 10, food: 5000 },
};

function decisionEffects(kind: FocusKind, decisionId: string, modifier: Modifier | undefined): Effect[] {
  const common: Effect[] = [{ setFlag: decisionId }];
  switch (kind) {
    case 'court':
      return [...common, { addStability: 4 }, { addCorruption: -3 }, { addAuthority: 1 }, { addModifier: { corruption_monthly: -0.015 } }];
    case 'economy':
      return [...common, { addModifier: { tax_efficiency_pct: 4, food_output_pct: 4 } }, { addEstateLoyalty: { estate: 'peasants', value: -2 } }];
    case 'military':
      return [...common, { addManpower: 5000 }, { addArmyLoyalty: 4 }, { addModifier: { army_attack_pct: 3, discipline_pct: 2, army_upkeep_pct: -2 } }];
    case 'diplomacy':
      return [...common, { addModifier: { trade_efficiency_pct: 5, stability_monthly: 0.02 } }, { addEstateLoyalty: { estate: 'merchants', value: 2 } }];
    case 'reform':
      return [...common, { addModifier: { tax_efficiency_pct: 5, corruption_monthly: -0.02 } }, { addStability: -1 }, { addEstateLoyalty: { estate: 'gentry', value: -3 } }];
    case 'navy':
      return [...common, { addModifier: { naval_attack_pct: 4, trade_efficiency_pct: 3, food_output_pct: 2 } }];
    case 'unique':
      return [...common, { addModifier: modifier ?? { stability_monthly: 0.02 } }];
    default:
      return common;
  }
}
export function expandFocusPacks(packs: FocusPack[], countryTags: Set<string>): { focuses: Focus[]; decisions: Decision[] } {
  const focuses: Focus[] = [];
  const decisions: Decision[] = [];
  const byId = new Map<string, Focus>();

  for (const pack of packs) {
    if (!countryTags.has(pack.country)) throw new ContentError('focus_packs', pack.country, 'unknown country');
    const branchFocusIds: string[][] = [];
    pack.branches.forEach((branch, branchIndex) => {
      const ids: string[] = [];
      branch.focuses.forEach((entry, tier) => {
        const decisionId = `${pack.country.toLowerCase()}_dec_b${branchIndex}`;
        const focus: Focus = {
          id: entry.id,
          country: pack.country,
          branch: branch.name,
          name: entry.name,
          desc: entry.desc ?? `${entry.name}。${branch.desc}`,
          x: branchIndex,
          y: tier,
          costDays: 60 + tier * 10,
          prerequisites: tier > 0 && ids[tier - 1] ? [ids[tier - 1] as string] : [],
          prerequisitesAny: [],
          mutuallyExclusive: [],
          completionEffect: [
            ...effectsFor(branch.kind, tier, entry.id, decisionId, branch.modifier, pack.country, branchIndex),
            ...(entry.grants ?? []).flatMap(province => [
              { addCore: province },
              { addClaim: province },
            ]),
            ...(entry.annexes ?? []).map(province => ({
              annexProvince: { province, requireControl: true },
            })),
          ],
          ...(entry.grants ? { grants: entry.grants } : {}),
          ...(entry.annexes ? { annexes: entry.annexes } : {}),
          aiWillDo: {
            base: 40 + tier * 5,
            modifier: [
              { factor: 1.3, if: { treasury: { lt: 0 } } },
              { factor: 1.15, if: { isAtWar: true } },
            ],
          },
          historicalContext: `${branch.desc} ${KIND_DETAIL[branch.kind]}`,
        };
        focuses.push(focus);
        byId.set(focus.id, focus);
        ids.push(focus.id);
      });
      branchFocusIds.push(ids);
    });

    for (const pair of pack.exclusions ?? []) {
      const [a, b] = pair;
      if (!a || !b) throw new ContentError('focus_packs', pack.country, 'invalid exclusion pair');
      const focusA = byId.get(a);
      const focusB = byId.get(b);
      if (!focusA || !focusB) throw new ContentError('focus_packs', pack.country, `unknown exclusion ${a}/${b}`);
      focusA.mutuallyExclusive.push(b);
      focusB.mutuallyExclusive.push(a);
    }

    pack.branches.forEach((branch, branchIndex) => {
      const decisionId = `${pack.country.toLowerCase()}_dec_b${branchIndex}`;
      decisions.push({
        id: decisionId,
        country: pack.country,
        name: `${branch.name}施策`,
        desc: `${branch.desc} 一次性全国施策：消耗国库与粮食，换取持续的经济或军事收益。`,
        cost: DECISION_COSTS[branch.kind],
        cooldownDays: 365,
        effect: decisionEffects(branch.kind, decisionId, branch.modifier),
      });
    });
  }
  return { focuses, decisions };
}



