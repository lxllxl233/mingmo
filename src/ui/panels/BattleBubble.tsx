import { useGameStore } from '../state/store';

export function BattleBubble() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const openBattle = useGameStore(state => state.openBattle);
  if (!game) return null;
  const battles = game.spectator
    ? game.battles
    : game.battles.filter(battle => battle.attacker === game.playerTag || battle.defender === game.playerTag);
  if (battles.length === 0) return null;
  return (
    <div className="battle-bubbles">
      {battles.map(battle => {
        const province = content.provinces.get(battle.provinceId);
        const attacker = content.countries.get(battle.attacker)?.name ?? battle.attacker;
        const defender = content.countries.get(battle.defender)?.name ?? battle.defender;
        return (
          <button key={battle.id} className="battle-bubble" onClick={() => openBattle(battle.id)}>
            <span className="battle-swords">⚔</span>
            <span>
              <b>{province?.name ?? battle.provinceId}</b>
              <small>{attacker} vs {defender} · 第 {battle.days} 日</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
