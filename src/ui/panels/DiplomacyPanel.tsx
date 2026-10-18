import { useState } from 'react';
import { relationKey } from '../../engine/state/types';
import { truceDays, warScore } from '../../engine/rules/war';
import { useGameStore } from '../state/store';

export function DiplomacyPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const [target, setTarget] = useState('QING');
  if (!game) return null;
  const player = game.playerTag;
  const wars = game.wars.filter(war => war.attacker === player || war.defender === player);
  const others = [...content.countries.values()].filter(country => country.tag !== player);
  const targetWar = wars.find(war =>
    (war.attacker === player && war.defender === target)
    || (war.defender === player && war.attacker === target));
  const targetTruce = truceDays(game, player, target);

  return (
    <div className="panel">
      <h2>外交</h2>
      <p className="muted">关系 -100 到 +100。议和后有 365 日停战期，停战期内不能再次宣战。</p>
      <h3>战争</h3>
      {wars.length === 0 && <p className="muted">当前没有战争。</p>}
      {wars.map(war => {
        const score = warScore(game, war);
        const isAttacker = war.attacker === player;
        const myScore = isAttacker ? score.attacker : score.defender;
        const enemyScore = isAttacker ? score.defender : score.attacker;
        const myOccupied = isAttacker ? score.attackerOccupied : score.defenderOccupied;
        const lost = isAttacker ? score.defenderOccupied : score.attackerOccupied;
        return (
          <div className="war-card" key={war.id}>
            <div className="war-head">
              <b>{content.countries.get(war.attacker)?.name} → {content.countries.get(war.defender)?.name}</b>
              <span className="muted">{war.warGoal || '无明确目标'}</span>
            </div>
            <div className="war-score">
              <span>我方战争分 <b>{myScore}</b></span>
              <span>敌方 <b>{enemyScore}</b></span>
              <span>占领 <b>{myOccupied}</b> · 失守 <b>{lost}</b></span>
            </div>
            <div className="panel-actions">
              <button onClick={() => command({ type: 'diplomacy.makePeace', warId: war.id, terms: 'white' })}>白和</button>
              <button onClick={() => command({ type: 'diplomacy.makePeace', warId: war.id, terms: 'status' })}>按现状议和</button>
              <button
                className="primary"
                disabled={myScore <= enemyScore}
                onClick={() => command({ type: 'diplomacy.makePeace', warId: war.id, terms: 'demand' })}
              >
                强制议和
              </button>
            </div>
          </div>
        );
      })}
      <h3>关系</h3>
      <table className="table">
        <thead><tr><th>势力</th><th>关系</th><th>状态</th><th></th></tr></thead>
        <tbody>
          {others.map(country => {
            const relation = game.relations[relationKey(player, country.tag)] ?? 0;
            const atWar = wars.some(war =>
              (war.attacker === player && war.defender === country.tag)
              || (war.defender === player && war.attacker === country.tag));
            const truce = truceDays(game, player, country.tag);
            const status = atWar ? '交战' : truce > 0 ? `停战 ${truce} 日` : relation < -20 ? '敌意' : relation > 30 ? '友好' : '中立';
            return (
              <tr key={country.tag}>
                <td><span className="faction-dot" style={{ background: country.color }} />{country.name}</td>
                <td className={relation < -50 ? 'danger' : ''}>{relation}</td>
                <td>{status}</td>
                <td>
                  {atWar ? (
                    <button onClick={() => {
                      const war = wars.find(entry =>
                        (entry.attacker === player && entry.defender === country.tag)
                        || (entry.defender === player && entry.attacker === country.tag));
                      if (war) command({ type: 'diplomacy.makePeace', warId: war.id });
                    }}>议和</button>
                  ) : (
                    <button
                      disabled={truce > 0}
                      onClick={() => command({ type: 'diplomacy.declareWar', target: country.tag, cb: '边境争端' })}
                    >
                      宣战
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>宣战目标</h3>
      <div className="panel-actions">
        <select value={target} onChange={event => setTarget(event.target.value)}>
          {others.map(country => <option key={country.tag} value={country.tag}>{country.name}</option>)}
        </select>
        <button
          disabled={Boolean(targetWar) || targetTruce > 0}
          onClick={() => command({ type: 'diplomacy.declareWar', target, cb: '边境争端' })}
        >
          {targetWar ? '正在交战' : targetTruce > 0 ? `停战 ${targetTruce} 日` : '宣战'}
        </button>
      </div>
    </div>
  );
}
