import { dividendCooldown, tradePostMonthlyIncome } from '../../engine/systems/trade';
import { useGameStore } from '../state/store';

export function TradePanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const nation = game.countries[game.playerTag];
  if (!nation) return null;
  if (game.playerTag !== 'ZHENG') {
    return (
      <div className="panel">
        <h2>海贸网络</h2>
        <p className="muted">这是郑氏专属机制：设埠、分红、招抚海商，用海权换陆权。</p>
      </div>
    );
  }
  const cooldown = dividendCooldown(game, 'ZHENG');
  const monthly = tradePostMonthlyIncome(game, content, 'ZHENG');
  const availablePorts = [...content.provinces.values()]
    .filter(def => def.isPort
      && game.provinces[def.id]?.controller === 'ZHENG'
      && !nation.tradePosts.includes(def.id))
    .sort((a, b) => b.development - a.development);
  return (
    <div className="panel trade-panel">
      <h2>海贸网络</h2>
      <p className="muted">
        郑氏以海商立国。设埠能带来每月贸易收入，海商分红可一次性提走四个月利润；
        但商埠需要港口与政治点，陆上扩张会分散海防。
      </p>
      <div className="court-summary">
        <span>国库 <b>{Math.round(nation.treasury).toLocaleString()}</b></span>
        <span>政治点 <b>{Math.round(nation.politicalPower)}</b></span>
        <span>商埠 <b>{nation.tradePosts.length} / 6</b></span>
        <span>月贸易 <b>{monthly.toLocaleString()}</b></span>
        <span>分红冷却 <b>{cooldown > 0 ? `${cooldown} 日` : '可用'}</b></span>
        <span>商人 <b>{Math.round(nation.factions['merchants'] ?? 0)}</b></span>
      </div>
      <div className="confiscation-actions">
        <button
          disabled={cooldown > 0 || nation.tradePosts.length === 0}
          title={cooldown > 0 ? `冷却中，还需 ${cooldown} 日` : nation.tradePosts.length === 0 ? '尚未设立商埠' : undefined}
          onClick={() => command({ type: 'trade.dividend' })}
        >
          海商分红（立即得 4 个月贸易银，商人 +3）
        </button>
        <button
          disabled={cooldown > 0 || nation.treasury < 20000}
          title={cooldown > 0 ? `冷却中，还需 ${cooldown} 日` : nation.treasury < 20000 ? '国库不足 2 万两' : undefined}
          onClick={() => command({ type: 'trade.recruit' })}
        >
          招抚海商（银 2 万；商人 +8、兵源 +2 千）
        </button>
      </div>
      <h3 className="section-title">可设埠港口</h3>
      {availablePorts.length === 0 && <p className="muted">没有可设埠的己方港口。</p>}
      {availablePorts.map(port => (
        <div className="trade-port" key={port.id}>
          <span>{port.name} <small>发展 {port.development}</small></span>
          <button
            disabled={nation.treasury < 30000 || nation.politicalPower < 10 || nation.tradePosts.length >= 6}
            title={nation.tradePosts.length >= 6 ? '商埠已达上限 6 处'
              : nation.treasury < 30000 ? '国库不足 3 万两'
                : nation.politicalPower < 10 ? '政治点不足 10' : undefined}
            onClick={() => command({ type: 'trade.open', portId: port.id })}
          >
            设埠（银 3 万 / 政治 10）
          </button>
        </div>
      ))}
      <p className="muted">商埠每月按港口发展度产出贸易银；已设 {nation.tradePosts.length} 处。</p>
    </div>
  );
}
