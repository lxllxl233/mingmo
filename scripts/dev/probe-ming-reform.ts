/**
 * Phase C 验收探针：MING 走「养廉银 + 京察/考成」能否在 10 年内把腐败压到 50 以下。
 * 观战模式让 AI 负责军事，探针只持续把 ruling 税法固定在养廉银，并在条件满足时使用京察。
 *
 * 用法：npx tsx scripts/dev/probe-ming-reform.ts
 */
import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { advanceDay } from '../../src/engine/tick';
import { dispatch } from '../../src/engine/commands';
import { formatDate } from '../../src/engine/core/clock';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING', 'normal', true);
const ming = state.countries['MING']!;
const HONESTY = 'tax_officials_honesty_silver';
let jingcha = 0;

function keepHonesty(): void {
  const estate = ming.estates['ruling'];
  if (!estate) return;
  if (estate.taxLaw === HONESTY || estate.reform?.law === HONESTY) return;
  estate.reform = null;
  estate.cooldownDays = 0;
  estate.taxLaw = HONESTY;
}

keepHonesty();

for (let day = 0; day < 365 * 20 && !state.ended; day += 1) {
  advanceDay(state, content);
  const nation = state.countries['MING'];
  if (!nation?.alive) break;
  keepHonesty();
  if ((nation.cooldowns['ming_dec_jingcha'] ?? 0) <= state.day
    && nation.politicalPower >= 100
    && nation.authority >= 40
    && nation.corruption >= 50) {
    try {
      dispatch(state, { type: 'decision.take', decisionId: 'ming_dec_jingcha' }, content);
      jingcha += 1;
    } catch {
      // 条件不足时下个月再试。
    }
  }
  if (state.day % 365 === 0) {
    const report = nation.lastReport;
    console.log(`${formatDate(state.day)} corruption=${nation.corruption.toFixed(1)} authority=${nation.authority.toFixed(1)} pp=${nation.politicalPower.toFixed(0)} treasury=${Math.round(nation.treasury)} arrears=${Math.round(nation.arrears)} income=${Math.round(report?.income ?? 0)} net=${Math.round(report?.net ?? 0)} stability=${nation.stability.toFixed(0)} prov=${Object.values(state.provinces).filter(p => p.controller === 'MING').length} law=${nation.estates['ruling']?.taxLaw} jingcha=${jingcha}`);
  }
}

const mingEnd = state.countries['MING'];
console.log(`result: alive=${mingEnd?.alive ?? false} day=${state.day} years=${(state.day / 365).toFixed(1)} corruption=${mingEnd?.corruption.toFixed(1)} authority=${mingEnd?.authority.toFixed(1)} jingcha=${jingcha} ended=${state.ended}`);
