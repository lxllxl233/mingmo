import { useState } from 'react';
import { relationKey } from '../../engine/state/types';
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

  return (
    <div className="panel">
      <h2>外交</h2>
      <p className="muted">关系 -100 到 +100。宣战会立刻把关系压到 -80。</p>
      <h3>战争</h3>
      {wars.length === 0 && <p className="muted">当前没有战争。</p>}
      {wars.map(war => (
        <div className="row" key={war.id}>
          <span>
            {content.countries.get(war.attacker)?.name} → {content.countries.get(war.defender)?.name}
            <span className="muted">（{war.warGoal || '无明确目标'}）</span>
          </span>
          <button onClick={() => command({ type: 'diplomacy.makePeace', warId: war.id })}>议和</button>
        </div>
      ))}
      <h3>关系</h3>
      <table className="table">
        <thead><tr><th>势力</th><th>关系</th><th>状态</th><th></th></tr></thead>
        <tbody>
          {others.map(country => {
            const relation = game.relations[relationKey(player, country.tag)] ?? 0;
            const atWar = wars.some(war =>
              (war.attacker === player && war.defender === country.tag)
              || (war.defender === player && war.attacker === country.tag));
            return (
              <tr key={country.tag}>
                <td><span className="faction-dot" style={{ background: country.color }} />{country.name}</td>
                <td className={relation < -50 ? 'danger' : ''}>{relation}</td>
                <td>{atWar ? '交战' : relation < -20 ? '敌意' : relation > 30 ? '友好' : '中立'}</td>
                <td>
                  {atWar ? (
                    <button onClick={() => {
                      const war = wars.find(entry =>
                        (entry.attacker === player && entry.defender === country.tag)
                        || (entry.defender === player && entry.attacker === country.tag));
                      if (war) command({ type: 'diplomacy.makePeace', warId: war.id });
                    }}>议和</button>
                  ) : (
                    <button onClick={() => command({ type: 'diplomacy.declareWar', target: country.tag, cb: '边境争端' })}>宣战</button>
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
        <button onClick={() => command({ type: 'diplomacy.declareWar', target, cb: '边境争端' })}>宣战</button>
      </div>
    </div>
  );
}
