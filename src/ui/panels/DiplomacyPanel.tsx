import { useState } from 'react';
import { relationKey } from '../../engine/state/types';
import { surrenderTendency, truceDays, warScore } from '../../engine/rules/war';
import { overlordOf, tributeAmount, vassalsOf } from '../../engine/rules/vassals';
import { useGameStore } from '../state/store';

export function DiplomacyPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const [target, setTarget] = useState('QING');
  const [warGoal, setWarGoal] = useState('边境争端');
  if (!game) return null;
  const player = game.playerTag;
  const wars = game.wars.filter(war => war.attacker === player || war.defender === player);
  const vassals = vassalsOf(game, player);
  const overlord = overlordOf(game, player);
  const others = [...content.countries.values()].filter(country => country.tag !== player);
  const targetWar = wars.find(war =>
    (war.attacker === player && war.defender === target)
    || (war.defender === player && war.attacker === target));
  const targetTruce = truceDays(game, player, target);

  return (
    <div className="panel">
      <h2>外交</h2>
      <p className="muted">关系 -100 到 +100。议和后有 365 日停战期，停战期内不能再次宣战。</p>
      <h3>藩属</h3>
      {overlord && (
        <div className="vassal-row">
          <span>本国为 <b>{content.countries.get(overlord)?.name ?? overlord}</b> 的藩属</span>
          <span className="muted">宗主可每年要求一次上供</span>
        </div>
      )}
      {vassals.length === 0 && !overlord && <p className="muted">当前没有藩属关系。</p>}
      {vassals.map(tag => {
        const vassal = game.countries[tag];
        const last = game.lastTribute[tag] ?? -9999;
        const ready = game.day - last >= 365;
        const amount = tributeAmount(game, tag);
        return (
          <div className="vassal-row" key={tag}>
            <span><b>{content.countries.get(tag)?.name ?? tag}</b><span className="muted"> · 国库 {Math.round(vassal?.treasury ?? 0).toLocaleString()} 两</span></span>
            <span className="muted">可索上供 {amount.toLocaleString()} 两（20%）</span>
            <button
              disabled={!ready || amount <= 0}
              onClick={() => command({ type: 'diplomacy.demandTribute', vassal: tag })}
            >
              {ready ? '要求上供' : `今年已索（${365 - (game.day - last)} 日）`}
            </button>
          </div>
        );
      })}
      <h3>战争</h3>
      {wars.length === 0 && <p className="muted">当前没有战争。</p>}
      {wars.map(war => {
        const score = warScore(game, war);
        const isAttacker = war.attacker === player;
        const myScore = isAttacker ? score.attacker : score.defender;
        const enemyScore = isAttacker ? score.defender : score.attacker;
        const myOccupied = isAttacker ? score.attackerOccupied : score.defenderOccupied;
        const lost = isAttacker ? score.defenderOccupied : score.attackerOccupied;
        const enemyTag = isAttacker ? war.defender : war.attacker;
        const myCasualties = war.casualties[player] ?? 0;
        const enemyCasualties = war.casualties[enemyTag] ?? 0;
        const myAttrition = war.attrition[player] ?? 0;
        const enemyAttrition = war.attrition[enemyTag] ?? 0;
        const mySurrender = surrenderTendency(game, war, player);
        const enemySurrender = surrenderTendency(game, war, enemyTag);
        return (
          <div className="war-card" key={war.id}>
            <div className="war-head">
              <b>{content.countries.get(war.attacker)?.name} → {content.countries.get(war.defender)?.name}</b>
              <span className="muted">{war.warGoal || '无明确目标'}</span>
            </div>
            <div className="war-score">
              <span>我方战争分 <b>{myScore}</b></span>
              <span>敌方 <b>{enemyScore}</b></span>
              <span>占领地区 <b>{myOccupied}</b> · 失守地区 <b>{lost}</b></span>
            </div>
            <div className="war-score">
              <span>伤亡：我 <b>{myCasualties.toLocaleString()}</b> · 敌 <b>{enemyCasualties.toLocaleString()}</b></span>
              <span>非战斗减员：我 <b>{myAttrition.toLocaleString()}</b> · 敌 <b>{enemyAttrition.toLocaleString()}</b></span>
              <span>投降倾向：我 <b>{mySurrender}%</b> · 敌 <b>{enemySurrender}%</b></span>
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
            const isVassal = game.vassals[country.tag] === player;
            const isOverlord = game.vassals[player] === country.tag;
            const status = isVassal ? '藩属' : isOverlord ? '宗主' : atWar ? '交战' : truce > 0 ? `停战 ${truce} 日` : relation < -20 ? '敌意' : relation > 30 ? '友好' : '中立';
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
                      disabled={truce > 0 || isVassal || isOverlord}
                      onClick={() => command({ type: 'diplomacy.declareWar', target: country.tag, cb: warGoal })}
                    >
                      {isVassal ? '藩属' : isOverlord ? '宗主' : '宣战'}
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
        <select value={warGoal} onChange={event => setWarGoal(event.target.value)}>
          <option value="边境争端">边境争端</option>
          <option value="收复失地">收复失地</option>
          <option value="藩属争夺">藩属争夺</option>
          <option value="统一天下">统一天下</option>
        </select>
        <button
          disabled={Boolean(targetWar) || targetTruce > 0}
          onClick={() => command({ type: 'diplomacy.declareWar', target, cb: warGoal })}
        >
          {targetWar ? '正在交战' : targetTruce > 0 ? `停战 ${targetTruce} 日` : '宣战'}
        </button>
      </div>
    </div>
  );
}

