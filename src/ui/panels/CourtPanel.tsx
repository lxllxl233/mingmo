import {
  COURT_FACTIONS,
  COURT_FACTION_EFFECTS,
  COURT_FACTION_NAMES,
  topCourtFaction,
} from '../../engine/systems/court';
import { useGameStore } from '../state/store';

export function CourtPanel() {
  const game = useGameStore(state => state.game);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'MING') {
    return (
      <div className="panel">
        <h2>朝议</h2>
        <p className="muted">朝议是大明专属机制：派系影响力会改变稳定、腐败、皇权与军心。</p>
      </div>
    );
  }
  const top = topCourtFaction(game, 'MING');
  return (
    <div className="panel court-panel">
      <h2>朝议</h2>
      <p className="muted">
        东林、阉党、帝党、边将互相牵制。扶植一个派系会抬高它的影响，打压会降低影响但伤稳定。
        当前最强派系决定每月被动效果。
      </p>
      <div className="court-summary">
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>稳定 <b>{Math.round(nation.stability)}</b></span>
        <span>皇权 <b>{Math.round(nation.authority)}</b></span>
        <span>最强派系 <b>{top ? COURT_FACTION_NAMES[top] : '—'}</b></span>
      </div>
      {COURT_FACTIONS.map(faction => {
        const influence = nation.factions[faction] ?? 0;
        return (
          <div className={`court-card${top === faction ? ' leading' : ''}`} key={faction}>
            <div className="court-card-head">
              <b>{COURT_FACTION_NAMES[faction]}</b>
              <span>{Math.round(influence)}</span>
            </div>
            <div className="bar"><i style={{ width: `${Math.max(2, Math.min(100, influence))}%` }} /></div>
            <p className="muted">{COURT_FACTION_EFFECTS[faction]}</p>
            <div className="court-actions">
              <button
                disabled={nation.politicalPower < 5}
                title={nation.politicalPower < 5 ? '政治点不足 5' : '消耗 5 政治点，提高该派系影响'}
                onClick={() => command({ type: 'court.favor', faction })}
              >
                扶植（5）
              </button>
              <button
                disabled={nation.politicalPower < 10}
                title={nation.politicalPower < 10 ? '政治点不足 10' : '消耗 10 政治点，降低该派系影响但稳定 -2'}
                onClick={() => command({ type: 'court.suppress', faction })}
              >
                打压（10，稳定 -2）
              </button>
            </div>
          </div>
        );
      })}
      <p className="muted">
        派系影响会随事件、国策与税法变化；每月向 10 缓慢回落。大明财政危机与党争叠加，是 1627 剧本的主要压力。
      </p>
    </div>
  );
}
