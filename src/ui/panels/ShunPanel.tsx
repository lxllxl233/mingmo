import { confiscationCooldown, confiscationGain } from '../../engine/systems/confiscation';
import { useGameStore } from '../state/store';

export function ShunPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'SHUN') {
    return (
      <div className="panel">
        <h2>追赃助饷</h2>
        <p className="muted">这是大顺专属机制：用士绅的银子养军，还是用民心换未来。</p>
      </div>
    );
  }
  const cooldown = confiscationCooldown(game, 'SHUN');
  const gain = confiscationGain(game, content, 'SHUN');
  const gentry = nation.estates['gentry']?.loyalty ?? 50;
  const farmers = nation.estates['farmers']?.loyalty ?? 50;
  return (
    <div className="panel shun-panel">
      <h2>追赃助饷</h2>
      <p className="muted">
        大顺以流民起家，军费靠拷掠士绅。追赃能立刻拿到大笔银子，但士绅忠诚与稳定会掉；
        均田免赋争取农民，安民则花钱买士绅的合作。
      </p>
      <div className="court-summary">
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
        <span>稳定 <b>{Math.round(nation.stability)}</b></span>
        <span>士绅忠诚 <b>{Math.round(gentry)}</b></span>
        <span>农民忠诚 <b>{Math.round(farmers)}</b></span>
        <span>冷却 <b>{cooldown > 0 ? `${cooldown} 日` : '可用'}</b></span>
        <span>预计追赃 <b>{gain.toLocaleString()}</b></span>
      </div>
      <div className="confiscation-actions">
        <button
          disabled={cooldown > 0}
          onClick={() => command({ type: 'confiscation.extort' })}
        >
          追赃助饷（立即得银，士绅 -8 / 稳定 -4 / 民怨 +4）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 20}
          onClick={() => command({ type: 'confiscation.land' })}
        >
          均田免赋（政治 20，粮 8 万 / 兵源 8 千，农民 +8 / 士绅 -6）
        </button>
        <button
          disabled={cooldown > 0 || nation.treasury < 50000}
          onClick={() => command({ type: 'confiscation.relief' })}
        >
          安民（银 5 万，士绅 +8 / 稳定 +4 / 民怨 -3）
        </button>
      </div>
      <p className="muted">
        士绅忠诚低于 30 时，大顺每月额外掉稳定、涨腐败；农民忠诚高于 70 时每月补 300 兵源。
      </p>
    </div>
  );
}
