import { leagueCooldown } from '../../engine/systems/league';
import { useGameStore } from '../state/store';

export function LeaguePanel() {
  const game = useGameStore(state => state.game);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'MONGOL') {
    return (
      <div className="panel">
        <h2>盟旗</h2>
        <p className="muted">这是察哈尔蒙古专属机制：会盟、编旗、掠边与联姻。</p>
      </div>
    );
  }
  const cooldown = leagueCooldown(game, 'MONGOL');
  return (
    <div className="panel league-panel">
      <h2>盟旗</h2>
      <p className="muted">
        察哈尔以会盟维系诸部，以骑兵换取生存。会盟恢复汗权，编旗把牧民变成军队，
        掠边能快速补给但会激怒明/清，联姻则用婚姻换停战。
      </p>
      <div className="court-summary">
        <span>汗权 <b>{Math.round(nation.mandate)}</b></span>
        <span>稳定 <b>{Math.round(nation.stability)}</b></span>
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
        <span>冷却 <b>{cooldown > 0 ? `${cooldown} 日` : '可用'}</b></span>
        <span>兵源 <b>{Math.round(nation.manpower).toLocaleString()}</b></span>
      </div>
      <div className="confiscation-actions">
        <button
          disabled={cooldown > 0 || nation.politicalPower < 10}
          title={cooldown > 0 ? `冷却中，还需 ${cooldown} 日` : nation.politicalPower < 10 ? '政治点不足 10' : undefined}
          onClick={() => command({ type: 'league.kurultai' })}
        >
          召开会盟（政治 10；汗权 +6、稳定 +3、贵族 +6、喇嘛 +4）
        </button>
        <button
          disabled={cooldown > 0 || nation.treasury < 30000}
          title={cooldown > 0 ? `冷却中，还需 ${cooldown} 日` : nation.treasury < 30000 ? '国库不足 3 万两' : undefined}
          onClick={() => command({ type: 'league.organize' })}
        >
          编立盟旗（银 3 万；兵源 +8 千、军心 +4、武将 +8、贵族 -3）
        </button>
        <button
          disabled={cooldown > 0}
          title={cooldown > 0 ? `冷却中，还需 ${cooldown} 日` : undefined}
          onClick={() => command({ type: 'league.raid' })}
        >
          掠边（得银/粮；稳定 -3，明/清关系 -15）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 10 || nation.treasury < 20000}
          title={cooldown > 0 ? `冷却中，还需 ${cooldown} 日`
            : nation.politicalPower < 10 ? '政治点不足 10'
              : nation.treasury < 20000 ? '国库不足 2 万两' : undefined}
          onClick={() => command({ type: 'league.marriage' })}
        >
          联姻（政治 10 / 银 2 万；与清或明关系 +20、停战 365 日）
        </button>
      </div>
      <p className="muted">贵族 &gt;50 每月军心 +0.03；喇嘛 &gt;30 每月稳定 +0.01；武将 &gt;50 每月 +200 兵源。</p>
    </div>
  );
}
