import { legitimacyCooldown } from '../../engine/systems/legitimacy';
import { useGameStore } from '../state/store';

export function LegitimacyPanel() {
  const game = useGameStore(state => state.game);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'SMING') {
    return (
      <div className="panel">
        <h2>正统</h2>
        <p className="muted">这是南明专属机制：拥立、廷议、勤王与联合抗清都在争夺「谁代表大明」。</p>
      </div>
    );
  }
  const cooldown = legitimacyCooldown(game, 'SMING');
  const reason = (power: number, treasury = 0) => cooldown > 0
    ? `冷却中，还需 ${cooldown} 日`
    : nation.politicalPower < power ? `政治点不足 ${power}`
      : treasury > 0 && nation.treasury < treasury ? `国库不足 ${treasury / 10000} 万两`
        : undefined;
  return (
    <div className="panel legitimacy-panel">
      <h2>正统</h2>
      <p className="muted">
        南明最大的敌人往往不是清军，而是自己人。拥立新帝能提高正统，廷议能安抚东林与士绅，
        勤王能换兵源，联合郑氏/大西则用正统换盟友。
      </p>
      <div className="court-summary">
        <span>正统 <b>{Math.round(nation.mandate)}</b></span>
        <span>稳定 <b>{Math.round(nation.stability)}</b></span>
        <span>皇权 <b>{Math.round(nation.authority)}</b></span>
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>冷却 <b>{cooldown > 0 ? `${cooldown} 日` : '可用'}</b></span>
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
      </div>
      <div className="confiscation-actions">
        <button
          disabled={cooldown > 0 || nation.politicalPower < 20 || nation.treasury < 60000}
          title={reason(20, 60000)}
          onClick={() => command({ type: 'legitimacy.proclaim' })}
        >
          拥立新帝（政治 20 / 银 6 万；正统 +8、稳定 +4、宗室 +8、东林 -4）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 5}
          title={reason(5)}
          onClick={() => command({ type: 'legitimacy.compromise' })}
        >
          廷议妥协（政治 5；正统 +2、稳定 +2、东林 +5、士绅 +3、宗室 -3）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 10}
          title={reason(10)}
          onClick={() => command({ type: 'legitimacy.mobilize' })}
        >
          号召勤王（政治 10；兵源 +1 万、军心 +5、武将 +8、东林 -5）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 20 || nation.treasury < 50000}
          title={reason(20, 50000)}
          onClick={() => command({ type: 'legitimacy.unite' })}
        >
          联合抗清（政治 20 / 银 5 万；与郑氏或大西结盟，正统 +3）
        </button>
      </div>
      <p className="muted">
        正统低于 30 时每月掉稳定、涨腐败；宗室影响高于 40 时也会内耗；东林高于 30 则略微抑制腐败。
      </p>
    </div>
  );
}
