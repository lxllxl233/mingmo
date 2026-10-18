import { useGameStore } from '../state/store';
import { formatNumber } from '../format';

const TERRAIN_LABELS: Record<string, string> = {
  plains: '平原', hills: '丘陵', mountains: '山地', wetland: '水网',
  desert: '荒漠', steppe: '草原', jungle: '丛林', urban: '城市',
};

export function BattleModal() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const selectedBattle = useGameStore(state => state.selectedBattle);
  const close = useGameStore(state => state.closeBattle);
  if (!game || !selectedBattle) return null;
  const battle = game.battles.find(entry => entry.id === selectedBattle);
  if (!battle) return null;
  const province = content.provinces.get(battle.provinceId);
  const attacker = content.countries.get(battle.attacker);
  const defender = content.countries.get(battle.defender);
  const war = game.wars.find(entry =>
    (entry.attacker === battle.attacker && entry.defender === battle.defender)
    || (entry.attacker === battle.defender && entry.defender === battle.attacker));
  return (
    <div className="event-overlay" onClick={close}>
      <div className="battle-modal" onClick={event => event.stopPropagation()}>
        <div className="battle-modal-head">
          <div>
            <p className="eyebrow">战斗详情 · 第 {battle.days} 日</p>
            <h2>⚔ {province?.name ?? battle.provinceId}</h2>
          </div>
          <button onClick={close}>关闭</button>
        </div>
        <div className="battle-sides">
          <div>
            <span>进攻方</span>
            <b style={{ color: attacker?.color }}>{attacker?.name ?? battle.attacker}</b>
            <small>兵力 {formatNumber(battle.attackerStrength)} · 组织 {battle.attackerOrganization.toFixed(0)}</small>
          </div>
          <div>
            <span>防守方</span>
            <b style={{ color: defender?.color }}>{defender?.name ?? battle.defender}</b>
            <small>兵力 {formatNumber(battle.defenderStrength)} · 组织 {battle.defenderOrganization.toFixed(0)}</small>
          </div>
        </div>
        <div className="battle-modal-grid">
          <span>战线宽度 <b>{content.balance.military.terrainWidth[province?.terrain ?? 'plains'] ?? 20}</b></span>
          <span>地形 <b>{TERRAIN_LABELS[province?.terrain ?? 'plains'] ?? province?.terrain ?? '—'}</b></span>
          <span>战斗伤亡 <b>{formatNumber(war?.casualties[battle.attacker] ?? 0)} / {formatNumber(war?.casualties[battle.defender] ?? 0)}</b></span>
          <span>非战斗减员 <b>{formatNumber(war?.attrition[battle.attacker] ?? 0)} / {formatNumber(war?.attrition[battle.defender] ?? 0)}</b></span>
        </div>
        <p className="muted">战斗按地形战线宽度投入前锋，组织度归零后撤退；其余部队作为预备队。</p>
      </div>
    </div>
  );
}
