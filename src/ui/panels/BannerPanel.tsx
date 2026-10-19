import {
  BANNER_FACTIONS,
  BANNER_FACTION_EFFECTS,
  BANNER_FACTION_NAMES,
  topBannerFaction,
} from '../../engine/systems/banners';
import { useGameStore } from '../state/store';

export function BannerPanel() {
  const game = useGameStore(state => state.game);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'QING') {
    return (
      <div className="panel">
        <h2>八旗</h2>
        <p className="muted">八旗是大清专属机制：旗分、汉臣、绿营与宗室互相牵制。</p>
      </div>
    );
  }
  const top = topBannerFaction(game, 'QING');
  return (
    <div className="panel court-panel banner-panel">
      <h2>八旗</h2>
      <p className="muted">
        八旗是清朝的军事与政治根基。扩编旗丁、抬旗与整饬旗务会改变各派影响；
        当前最强派系决定每月被动。
      </p>
      <div className="court-summary">
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
        <span>兵源 <b>{Math.round(nation.manpower).toLocaleString()}</b></span>
        <span>最强派系 <b>{top ? BANNER_FACTION_NAMES[top] : '—'}</b></span>
      </div>
      <div className="banner-actions">
        <button
          disabled={nation.treasury < 50000 || nation.manpower < 10000}
          onClick={() => command({ type: 'banner.expand' })}
        >
          扩编八旗（银 5 万 / 兵源 1 万）
        </button>
        <button
          disabled={nation.politicalPower < 15}
          onClick={() => command({ type: 'banner.raise' })}
        >
          抬旗（政治 15）
        </button>
        <button
          disabled={nation.politicalPower < 20}
          onClick={() => command({ type: 'banner.reform' })}
        >
          整饬旗务（政治 20）
        </button>
      </div>
      {BANNER_FACTIONS.map(faction => {
        const influence = nation.factions[faction] ?? 0;
        return (
          <div className={`court-card${top === faction ? ' leading' : ''}`} key={faction}>
            <div className="court-card-head">
              <b>{BANNER_FACTION_NAMES[faction]}</b>
              <span>{Math.round(influence)}</span>
            </div>
            <div className="bar"><i style={{ width: `${Math.max(2, Math.min(100, influence))}%` }} /></div>
            <p className="muted">{BANNER_FACTION_EFFECTS[faction]}</p>
          </div>
        );
      })}
      <p className="muted">
        八旗影响过高会加重腐败，绿营过高会伤稳定；抬旗能快速提高满洲与八旗影响，但会压低绿营。
      </p>
    </div>
  );
}
