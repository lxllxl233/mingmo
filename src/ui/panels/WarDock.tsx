import { memo, useState } from 'react';
import { surrenderTendency, warScore, warsOf } from '../../engine/rules/war';
import { armyStrengthOf } from '../../engine/systems/economy';
import { useGameStore } from '../state/store';

function WarDays({ startDay }: { startDay: number }) {
  const day = useGameStore(state => state.game?.day ?? startDay);
  return <>· 第 {day - startDay} 日</>;
}

/**
 * 战争视图的数值只在战斗、易主、厌战或兵力变化时更新；
 * 每日推进只刷新“第 N 日”。这样 32x 推进时不会每 tick 重算战争分与全省扫描。
 */
function warSignature(game: NonNullable<ReturnType<typeof useGameStore.getState>['game']>): string {
  const parts: string[] = [game.playerTag, String(game.mapRevision)];
  for (const war of game.wars) {
    parts.push([
      war.id, war.attacker, war.defender, war.warGoal, war.startDay,
      war.casualties[war.attacker] ?? 0, war.casualties[war.defender] ?? 0,
      war.attrition[war.attacker] ?? 0, war.attrition[war.defender] ?? 0,
      war.exhaustion[war.attacker] ?? 0, war.exhaustion[war.defender] ?? 0,
    ].join(','));
  }
  for (const tag of [game.playerTag, ...game.wars.map(war => (war.attacker === game.playerTag ? war.defender : war.attacker))]) {
    parts.push(`${tag}:${game.countries[tag]?.warExhaustion ?? 0}`);
  }
  for (const army of Object.values(game.armies)) {
    const c = army.composition;
    parts.push(`${army.tag}:${c.infantry + c.firearm + c.cavalry + c.artillery + c.naval}`);
  }
  return parts.join('|');
}

export const WarDock = memo(function WarDock() {
  const signature = useGameStore(state => (state.game ? warSignature(state.game) : ''));
  const content = useGameStore(state => state.content);
  const openPanel = useGameStore(state => state.openPanel);
  const [collapsed, setCollapsed] = useState(false);
  const game = useGameStore.getState().game;
  if (!game || signature === '') return null;
  const wars = warsOf(game, game.playerTag);

  return (
    <section className={`war-dock${collapsed ? ' collapsed' : ''}`}>
      <div className="war-dock-head">
        <b>战争视图</b>
        <div className="war-dock-head-actions">
          <button onClick={() => setCollapsed(value => !value)}>
            {collapsed ? '展开' : '收起'}
          </button>
          <button onClick={() => openPanel('diplomacy')}>外交</button>
        </div>
      </div>
      {!collapsed && wars.length === 0 && <p className="war-dock-empty">当前没有战争。宣战后，这里会持续显示双方伤亡、非战斗减员与投降倾向。</p>}
      {!collapsed && wars.map(war => {
        const enemy = war.attacker === game.playerTag ? war.defender : war.attacker;
        const score = warScore(game, war);
        const mine = war.attacker === game.playerTag ? score.attacker : score.defender;
        const theirs = war.attacker === game.playerTag ? score.defender : score.attacker;
        const casualties = war.casualties[game.playerTag] ?? 0;
        const attrition = war.attrition[game.playerTag] ?? 0;
        const enemyCasualties = war.casualties[enemy] ?? 0;
        const enemyAttrition = war.attrition[enemy] ?? 0;
        const surrender = surrenderTendency(game, war, game.playerTag);
        const occupiedByUs = game.playerTag === war.attacker ? score.attackerOccupied : score.defenderOccupied;
        const occupiedByThem = game.playerTag === war.attacker ? score.defenderOccupied : score.attackerOccupied;
        const ourStrength = armyStrengthOf(game, game.playerTag);
        const enemyStrength = armyStrengthOf(game, enemy);
        return (
          <div className="war-dock-row" key={war.id}>
            <div className="war-dock-title">
              <b>{content.countries.get(enemy)?.name ?? enemy}</b>
              <span>{war.warGoal || '战争'} <WarDays startDay={war.startDay} /></span>
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
});
