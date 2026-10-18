import { surrenderTendency, warScore, warsOf } from '../../engine/rules/war';
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
        return (
          <div className="war-dock-row" key={war.id}>
            <div className="war-dock-title">
              <b>{content.countries.get(enemy)?.name ?? enemy}</b>
              <span>{war.warGoal || '战争'}</span>
            </div>
            <div className="war-dock-stats">
              <span>分 <b>{mine}</b> / {theirs}</span>
              <span>伤亡 <b>{casualties.toLocaleString()}</b> / {enemyCasualties.toLocaleString()}</span>
            </div>
            <div className="war-dock-stats">
              <span>非战斗减员 <b>{attrition.toLocaleString()}</b> / {enemyAttrition.toLocaleString()}</span>
              <span>投降倾向 <b>{surrender}%</b></span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
