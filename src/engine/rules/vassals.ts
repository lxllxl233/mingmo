import type { ContentIndex } from '../../content/types';
import type { GameState } from '../state/types';
import { declareWar } from './war';

export interface TributeResult {
  ok: boolean;
  amount: number;
  refused: boolean;
  reason: string;
}

export function tributeAmount(state: GameState, vassal: string): number {
  const country = state.countries[vassal];
  if (!country) return 0;
  return Math.max(0, Math.floor(country.treasury * 0.2));
}

export function vassalsOf(state: GameState, suzerain: string): string[] {
  return Object.entries(state.vassals)
    .filter(([, overlord]) => overlord === suzerain)
    .map(([vassal]) => vassal);
}

export function overlordOf(state: GameState, vassal: string): string | null {
  return state.vassals[vassal] ?? null;
}

/**
 * 宗主国每年可要求一次上供，最高为藩属当前国库白银的 20%。
 * 藩属若拒绝，宗主国立即以“拒贡”为战争目标宣战。
 */
export function demandTribute(
  state: GameState,
  content: ContentIndex,
  suzerain: string,
  vassal: string,
): TributeResult {
  if (state.vassals[vassal] !== suzerain) {
    return { ok: false, amount: 0, refused: false, reason: 'not a vassal' };
  }
  const last = state.lastTribute[vassal] ?? -9999;
  if (state.day - last < 365) {
    return { ok: false, amount: 0, refused: false, reason: 'already demanded this year' };
  }
  const vassalState = state.countries[vassal];
  const suzerainState = state.countries[suzerain];
  if (!vassalState?.alive || !suzerainState?.alive) {
    return { ok: false, amount: 0, refused: false, reason: 'missing country' };
  }
  const amount = tributeAmount(state, vassal);
  state.lastTribute[vassal] = state.day;
  const relation = state.relations[[suzerain, vassal].sort().join('|')] ?? 0;
  const refusalRoll = (state.day * 17 + vassal.length * 23 + suzerain.length * 11) % 100;
  const refuses = vassalState.stability >= 40
    && vassalState.treasury > Math.max(20000, amount * 2)
    && (relation < -5 || refusalRoll < 22);
  if (refuses) {
    delete state.vassals[vassal];
    // 停战期或同盟状态可能导致宣战失败，此时不能谎报战争爆发。
    const war = declareWar(state, suzerain, vassal, '拒贡', content);
    state.log.push({
      day: state.day,
      category: 'diplomacy',
      country: vassal,
      text: `${content.countries.get(vassal)?.name ?? vassal} 拒绝向 ${content.countries.get(suzerain)?.name ?? suzerain} 上供${war ? '，战争爆发' : '，藩属关系断绝'}`,
      severity: war ? 'warning' : 'info',
    });
    return { ok: true, amount: 0, refused: true, reason: war ? 'refused' : 'independence' };
  }
  if (vassalState.treasury < amount) {
    return { ok: false, amount: 0, refused: false, reason: 'insufficient treasury' };
  }
  vassalState.treasury -= amount;
  suzerainState.treasury += amount;
  state.relations[[suzerain, vassal].sort().join('|')] = Math.max(-100, relation - 4);
  state.log.push({
    day: state.day,
    category: 'diplomacy',
    country: suzerain,
    text: `${content.countries.get(vassal)?.name ?? vassal} 向 ${content.countries.get(suzerain)?.name ?? suzerain} 上供 ${amount} 两`,
    severity: 'info',
  });
  return { ok: true, amount, refused: false, reason: 'paid' };
}
