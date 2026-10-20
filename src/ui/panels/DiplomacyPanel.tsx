import { useState } from 'react';
import { relationKey } from '../../engine/state/types';
import { areAllied, hasMilitaryAccess } from '../../engine/rules/diplomacy';
import { surrenderTendency, truceDays, warScore } from '../../engine/rules/war';
import { overlordOf, tributeAmount, vassalsOf } from '../../engine/rules/vassals';
import { useGameStore } from '../state/store';

export function DiplomacyPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const openPeace = useGameStore(state => state.openPeace);
  const [target, setTarget] = useState('QING');
  const [warGoal, setWarGoal] = useState('边境争端');
  if (!game) return null;
  const player = game.playerTag;
  const wars = game.wars.filter(war => war.attacker === player || war.defender === player);
  const vassals = vassalsOf(game, player);
  const overlord = overlordOf(game, player);
  const others = [...content.countries.values()]
    .filter(country => country.tag !== player && game.countries[country.tag]?.alive);
  const effectiveTarget = others.some(country => country.tag === target)
    ? target
    : (others[0]?.tag ?? target);
  const targetWar = wars.find(war =>
    (war.attacker === player && war.defender === effectiveTarget)
    || (war.defender === player && war.attacker === effectiveTarget));
  const targetTruce = truceDays(game, player, effectiveTarget);
  const confirmWar = (targetTag: string) => {
    const name = content.countries.get(targetTag)?.name ?? targetTag;
    if (window.confirm(`向 ${name} 宣战（${warGoal}）？战争会持续到议和或一方崩溃。`)) {
      command({ type: 'diplomacy.declareWar', target: targetTag, cb: warGoal });
    }
  };

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
              title={!ready ? '本年已索贡，需间隔 365 日' : amount <= 0 ? '藩属国库为空，无贡可索' : '索要藩属国库的 20%'}
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
              <button onClick={() => openPeace(war.id)}>白和</button>
              <button onClick={() => openPeace(war.id)}>按现状议和</button>
              <button
                className="primary"
                disabled={myScore <= enemyScore}
                onClick={() => openPeace(war.id)}
              >
                强制议和
              </button>
            </div>
          </div>
        );
      })}
      <h3>关系</h3>
      {others.length === 0 && <p className="muted">没有可交涉的势力。</p>}
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
            const allied = areAllied(game, player, country.tag);
            const access = hasMilitaryAccess(game, player, country.tag);
            const status = isVassal ? '藩属' : isOverlord ? '宗主' : atWar ? '交战'
              : allied ? '同盟' : access ? '军通' : truce > 0 ? `停战 ${truce} 日`
                : relation < -20 ? '敌意' : relation > 30 ? '友好' : '中立';
            return (
              <tr key={country.tag}>
                <td><span className="faction-dot" style={{ background: country.color }} />{country.name}</td>
                <td className={relation < -50 ? 'danger' : ''}>{relation}</td>
                <td>{status}</td>
                <td className="diplomacy-actions">
                  {atWar ? (
                    <button onClick={() => {
                      const war = wars.find(entry =>
                        (entry.attacker === player && entry.defender === country.tag)
                        || (entry.defender === player && entry.attacker === country.tag));
                      if (war) openPeace(war.id);
                    }}>议和</button>
                  ) : (
                    <>
                      <button
                        disabled={relation >= 100}
                        title={relation >= 100 ? '关系已达上限 100' : '花费 1 万两，关系 +10'}
                        onClick={() => command({ type: 'diplomacy.gift', target: country.tag, amount: 10000 })}
                      >赠礼</button>
                      {allied ? (
                        <button
                          title="解除同盟；同盟提供的军通同时失效"
                          onClick={() => {
                            if (window.confirm(`与 ${country.name} 断盟？同盟提供的军通会同时失效。`)) {
                              command({ type: 'diplomacy.breakAlliance', target: country.tag });
                            }
                          }}
                        >断盟</button>
                      ) : (
                        <button
                          disabled={relation < 50 || truce > 0}
                          title={relation < 50 ? `关系需 ≥50（当前 ${relation}）` : truce > 0 ? `停战期还剩 ${truce} 日` : '结盟后自动互通军通'}
                          onClick={() => command({ type: 'diplomacy.alliance', target: country.tag })}
                        >结盟</button>
                      )}
                      {access ? (
                        <button onClick={() => command({ type: 'diplomacy.revokeAccess', target: country.tag })}>撤通</button>
                      ) : (
                        <button
                          disabled={relation < 20}
                          title={relation < 20 ? `关系需 ≥20（当前 ${relation}）` : '允许对方军队通过本国领土'}
                          onClick={() => command({ type: 'diplomacy.grantAccess', target: country.tag })}
                        >军通</button>
                      )}
                      <button
                        disabled={truce > 0 || isVassal || isOverlord || allied}
                        title={truce > 0 ? `停战期还剩 ${truce} 日`
                          : isVassal ? '不能向自己的藩属宣战'
                            : isOverlord ? '不能向宗主宣战'
                              : allied ? '需先断盟才能宣战'
                                : `以“${warGoal}”为战争目标宣战`}
                        onClick={() => confirmWar(country.tag)}
                      >
                        {isVassal ? '藩属' : isOverlord ? '宗主' : '宣战'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>宣战目标</h3>
      <div className="panel-actions">
        <select value={effectiveTarget} onChange={event => setTarget(event.target.value)}>
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
          title={targetWar ? '已与该势力交战' : targetTruce > 0 ? `停战期还剩 ${targetTruce} 日` : '宣战会立即破坏关系并可能把对方盟友卷入'}
          onClick={() => confirmWar(effectiveTarget)}
        >
          {targetWar ? '正在交战' : targetTruce > 0 ? `停战 ${targetTruce} 日` : '宣战'}
        </button>
      </div>
    </div>
  );
}

