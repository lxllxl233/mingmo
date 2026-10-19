import { isJapanOpen, sakokuCooldown } from '../../engine/systems/sakoku';
import { useGameStore } from '../state/store';

export function SakokuPanel() {
  const game = useGameStore(state => state.game);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'JAPAN') {
    return (
      <div className="panel">
        <h2>锁国</h2>
        <p className="muted">这是日本专属机制：锁国、长崎贸易与禁教之间的取舍。</p>
      </div>
    );
  }
  const open = isJapanOpen(game);
  const cooldown = sakokuCooldown(game, 'JAPAN');
  return (
    <div className="panel sakoku-panel">
      <h2>锁国</h2>
      <p className="muted">
        德川幕府以锁国维持秩序，只留长崎一处窗口。开国能扩大贸易与商人影响，但会削弱寺社与稳定；
        禁教能安抚寺社，却会得罪商人。
      </p>
      <div className="court-summary">
        <span>国策 <b>{open ? '开国' : '锁国'}</b></span>
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>稳定 <b>{Math.round(nation.stability)}</b></span>
        <span>寺社 <b>{Math.round(nation.factions['clergy'] ?? 0)}</b></span>
        <span>冷却 <b>{cooldown > 0 ? `${cooldown} 日` : '可用'}</b></span>
      </div>
      <div className="confiscation-actions">
        <button
          disabled={cooldown > 0 || nation.politicalPower < 10}
          onClick={() => command({ type: 'sakoku.toggle' })}
        >
          {open ? '重申锁国（政治 10；稳定 +2、商人 -6、寺社 +4）' : '解除锁国（政治 10；稳定 -2、商人 +6、寺社 -4）'}
        </button>
        <button
          disabled={cooldown > 0}
          onClick={() => command({ type: 'sakoku.nagasaki' })}
        >
          长崎贸易（得银；开国全额，锁国减半；商人 +3、寺社 -2）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 10}
          onClick={() => command({ type: 'sakoku.persecute' })}
        >
          禁教（政治 10；寺社 +6、商人 -5、稳定 +2、民怨 +2）
        </button>
      </div>
      <p className="muted">
        开国时每月按港口发展度获得贸易银；锁国时稳定 +0.01/月，开国时 -0.01/月；寺社 &gt;50 额外 +0.01 稳定。
      </p>
    </div>
  );
}
