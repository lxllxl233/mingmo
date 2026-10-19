import { isJoseonNorth, tributeCooldown } from '../../engine/systems/tribute';
import { useGameStore } from '../state/store';

export function TributePanel() {
  const game = useGameStore(state => state.game);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'JOSEON') {
    return (
      <div className="panel">
        <h2>事大</h2>
        <p className="muted">这是朝鲜专属机制：在事大与北伐之间选择。</p>
      </div>
    );
  }
  const north = isJoseonNorth(game);
  const cooldown = tributeCooldown(game, 'JOSEON');
  return (
    <div className="panel tribute-panel">
      <h2>事大</h2>
      <p className="muted">
        朝鲜夹在明清之间。事大能换和平与稳定，北伐能换兵源与武臣支持，
        朝贡则是花钱买正统与对清关系。丙子之耻仍在，但国小民疲。
      </p>
      <div className="court-summary">
        <span>国策 <b>{north ? '北伐' : '事大'}</b></span>
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
        <span>粮食 <b>{Math.round(nation.food).toLocaleString()}</b></span>
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>稳定 <b>{Math.round(nation.stability)}</b></span>
        <span>冷却 <b>{cooldown > 0 ? `${cooldown} 日` : '可用'}</b></span>
      </div>
      <div className="confiscation-actions">
        <button
          disabled={cooldown > 0 || nation.politicalPower < 5}
          onClick={() => command({ type: 'joseon.submit' })}
        >
          事大（政治 5；对清关系 +15、稳定 +2、两班 +5、武臣 -5）
        </button>
        <button
          disabled={cooldown > 0 || nation.politicalPower < 10}
          onClick={() => command({ type: 'joseon.north' })}
        >
          北伐（政治 10；兵源 +5 千、武臣 +8、两班 -5、对清关系 -20）
        </button>
        <button
          disabled={cooldown > 0 || nation.treasury < 20000 || nation.food < 20000}
          onClick={() => command({ type: 'joseon.tribute' })}
        >
          朝贡（银 2 万 / 粮 2 万石；对清关系 +15、正统 +3、文臣 +3）
        </button>
      </div>
      <p className="muted">
        北伐时每月军心 +0.03、稳定 -0.02、兵源 +200；事大时每月稳定 +0.01、腐败 -0.01。
      </p>
    </div>
  );
}
