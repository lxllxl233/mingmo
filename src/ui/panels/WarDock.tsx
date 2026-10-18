import { surrenderTendency, warScore, warsOf } from '../../engine/rules/war';
import { armyStrengthOf } from '../../engine/systems/economy';
import { useGameStore } from '../state/store';

export function WarDock() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const openPanel = useGameStore(state => state.openPanel);
  if (!game) return null;
  const wars = warsOf(game, game.playerTag);

  return (
    <section className="war-dock">
      <div className="war-dock-head">
        <b>战争视图</b>
        <button onClick={() => openPanel('diplomacy')}>外交</button>
      </div>
      {wars.length === 0 && <p className="war-dock-empty">当前没有战争。宣战后，这里会持续显示双方伤亡、非战斗减员与投降倾向。</p>}
      {wars.map(war => {
        const enemy = war.attacker === game.playerTag ? war.defender : war.attacker;
        const score = warScore(game, war);
        const mine = war.attacker === game.playerTag ? score.attacker : score.defender;
        const theirs = war.attacker === game.playerTag ? score.defender : score.attacker;
        const casualties = war.casualties[game.playerTag] ?? 0;
        const attrition = war.attrition[game.playerTag] ?? 0;
        const enemyCasualties = war.casualties[enemy] ?? 0;
        const enemyAttrition = war.attrition[enemy] ?? 0;
        const surrender = surrenderTendency(game, war, game.playerTag);
        const occupiedByUs = Object.values(game.provinces).filter(province =>
          province.controller === game.playerTag && province.owner === enemy).length;
        const occupiedByThem = Object.values(game.provinces).filter(province =>
          province.controller === enemy && province.owner === game.playerTag).length;
        const ourStrength = armyStrengthOf(game, game.playerTag);
        const enemyStrength = armyStrengthOf(game, enemy);
        const days = game.day - war.startDay;
        return (
          <div className="war-dock-row" key={war.id}>
            <div className="war-dock-title">
              <b>{content.countries.get(enemy)?.name ?? enemy}</b>
              <span>{war.warGoal || '战争'} · 第 {days} 日</span>
            </div>
            <div className="war-dock-stats">
              <span>战争分 <b>{mine}</b> / {theirs}</span>
              <span>投降倾向 <b className={surrender > 60 ? 'danger' : ''}>{surrender}%</b></span>
            </div>
            <div className="war-dock-stats">
              <span>战斗伤亡 <b>{casualties.toLocaleString()}</b> / {enemyCasualties.toLocaleString()}</span>
              <span>非战斗减员 <b>{attrition.toLocaleString()}</b> / {enemyAttrition.toLocaleString()}</span>
            </div>
            <div className="war-dock-stats">
              <span>占敌地区 <b>{occupiedByUs}</b> · 敌占我 <b>{occupiedByThem}</b></span>
              <span>兵力 <b>{Math.round(ourStrength).toLocaleString()}</b> / {Math.round(enemyStrength).toLocaleString()}</span>
            </div>
            <div className="war-dock-stats">
              <span>厌战 <b>{Math.round(game.countries[game.playerTag]?.warExhaustion ?? 0)}</b> / {Math.round(game.countries[enemy]?.warExhaustion ?? 0)}</span>
              <button className="war-detail" onClick={() => openPanel('diplomacy')}>战报详情</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
