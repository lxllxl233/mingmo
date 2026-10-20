import { useEffect, useState } from 'react';
import { surrenderTendency, warScore } from '../../engine/rules/war';
import { useGameStore } from '../state/store';

export function PeaceModal() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const peaceWarId = useGameStore(state => state.peaceWarId);
  const openPeace = useGameStore(state => state.openPeace);
  const closePeace = useGameStore(state => state.closePeace);
  const command = useGameStore(state => state.command);
  const [selected, setSelected] = useState<string[]>([]);

  const offer = game?.peaceOffers.find(entry => entry.warId === peaceWarId)
    ?? game?.peaceOffers[0]
    ?? null;
  const war = game?.wars.find(entry => entry.id === (peaceWarId ?? offer?.warId));
  const player = game?.playerTag ?? '';
  const enemy = war ? (war.attacker === player ? war.defender : war.attacker) : '';
  const gains = war && game
    ? Object.values(game.provinces).filter(province =>
      province.owner === enemy && province.controller === player).map(province => province.id)
    : [];
  const losses = war && game
    ? Object.values(game.provinces).filter(province =>
      province.owner === player && province.controller === enemy).map(province => province.id)
    : [];
  const score = war && game ? warScore(game, war) : { attacker: 0, defender: 0, attackerOccupied: 0, defenderOccupied: 0 };
  const myScore = war?.attacker === player ? score.attacker : score.defender;
  const enemyScore = war?.attacker === player ? score.defender : score.attacker;
  const maxClaims = gains.length === 0
    ? 0
    : Math.max(1, Math.min(gains.length, Math.floor(gains.length * (myScore + 1) / (myScore + enemyScore + 2)) + (myScore > enemyScore ? 1 : 0)));
  useEffect(() => {
    setSelected(gains.slice(0, maxClaims));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [war?.id, gains.join('|'), maxClaims]);
  if (!game || !war) return null;
  const myCasualties = war.casualties[player] ?? 0;
  const enemyCasualties = war.casualties[enemy] ?? 0;
  const showOffer = !peaceWarId && offer !== null;
  const accept = (terms: 'white' | 'status' | 'demand') => {
    command({
      type: 'diplomacy.makePeace',
      warId: war.id,
      terms,
      ...(terms === 'white' ? {} : { provinceIds: selected }),
    });
    closePeace();
  };
  return (
    <div className="event-overlay">
      <div className="peace-modal">
        <div className="peace-head">
          <div>
            <p className="eyebrow">{showOffer ? '对方请求议和' : '和平会议'}</p>
            <h2>{content.countries.get(war.attacker)?.name} ↔ {content.countries.get(war.defender)?.name}</h2>
            <p className="muted">{war.warGoal || '无明确目标'} · 第 {game.day - war.startDay} 日</p>
          </div>
          <button onClick={() => {
            if (showOffer && offer) command({ type: 'diplomacy.rejectPeaceOffer', offerId: offer.id });
            closePeace();
          }}>关闭</button>
        </div>
        <div className="peace-score">
          <span>我方战争分 <b>{myScore}</b></span>
          <span>敌方 <b>{enemyScore}</b></span>
          <span>我方伤亡 <b>{myCasualties.toLocaleString()}</b></span>
          <span>敌方伤亡 <b>{enemyCasualties.toLocaleString()}</b></span>
          <span>投降倾向 <b>{surrenderTendency(game, war, player)}%</b></span>
        </div>
        {showOffer ? (
          <>
            <p>对方在长期消耗后请求停战。是否进入和平会议，按当前占领与战争贡献重新划定边界？</p>
            <div className="panel-actions">
              <button onClick={() => command({ type: 'diplomacy.rejectPeaceOffer', offerId: offer.id })}>拒绝</button>
              <button className="primary" onClick={() => openPeace(war.id)}>进入和谈</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">勾选要保留的占领地区。未勾选的地区会在和平后归还；战争贡献越高，越有能力索取更多地区。</p>
            <p className="muted">按当前战争贡献，最多可索取 <b>{maxClaims}</b> 个地区（已选 {selected.length}）。</p>
            <div className="peace-columns">
              <div>
                <h3>可索取地区</h3>
                {gains.length === 0 && <p className="muted">没有占领对方地区。</p>}
                {gains.map(id => (
                  <label className="peace-province" key={id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(id)}
                      disabled={!selected.includes(id) && selected.length >= maxClaims}
                      onChange={() => setSelected(current =>
                        current.includes(id) ? current.filter(entry => entry !== id) : [...current, id])}
                    />
                    <span>{content.provinces.get(id)?.name ?? id}</span>
                    <small>{content.prefectures.get(content.provinces.get(id)?.prefectureId ?? '')?.name ?? ''}</small>
                  </label>
                ))}
              </div>
              <div>
                <h3>我方失守地区</h3>
                {losses.length === 0 && <p className="muted">没有失守地区。</p>}
                {losses.map(id => (
                  <div className="peace-province lost" key={id}>
                    <span>{content.provinces.get(id)?.name ?? id}</span>
                    <small>和平后归还</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-actions">
              <button onClick={() => accept('white')}>白和（全部归还）</button>
              <button onClick={() => accept('status')}>按现状议和</button>
              <button
                className="primary"
                disabled={myScore <= enemyScore}
                title={myScore <= enemyScore ? '战争分不高于对方，无法强制索地' : '按战争分索取已勾选的占领地区'}
                onClick={() => accept('demand')}
              >
                强制议和（可索地）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
