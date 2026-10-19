import { evaluateTrigger } from '../../engine/rules/triggers';
import { useGameStore } from '../state/store';
import { effectsSummary } from '../format';

export function DecisionPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const decisions = [...content.decisions.values()].filter(decision => decision.country === country.tag);
  const visibleDecisions = decisions.filter(decision =>
    !decision.visible || evaluateTrigger(decision.visible, { state: game, content, country: country.tag }));
  const readyCount = visibleDecisions.filter(decision =>
    (country.cooldowns[decision.id] ?? 0) <= game.day).length;
  return (
    <div className="panel">
      <h2>决议</h2>
      <p className="muted">全国施策：消耗国库、粮食与政治点，365 日冷却。收益直接作用于税收、粮食产出、军费、腐败或阶级忠诚。</p>
      <div className="decision-summary">
        <span>可见决议 <b>{visibleDecisions.length}</b></span>
        <span>当前可用 <b>{readyCount}</b></span>
        <span>国库 <b>{Math.round(country.treasury).toLocaleString()}</b> 两</span>
        <span>政治 <b>{Math.round(country.politicalPower)}</b></span>
        <span>粮食 <b>{Math.round(country.food).toLocaleString()}</b> 石</span>
      </div>
      {decisions.length === 0 && <p className="muted">暂无可用的决议。</p>}
      {decisions.map(decision => {
        const cooldown = Math.max(0, (country.cooldowns[decision.id] ?? 0) - game.day);
        const visible = !decision.visible || evaluateTrigger(decision.visible, { state: game, content, country: country.tag });
        const available = !decision.available || evaluateTrigger(decision.available, { state: game, content, country: country.tag });
        const affordable = (decision.cost.treasury ?? 0) <= country.treasury
          && (decision.cost.politicalPower ?? 0) <= country.politicalPower
          && (decision.cost.food ?? 0) <= country.food;
        if (!visible) return null;
        return (
          <div className="estate-card decision-card" key={decision.id}>
            <div className="head"><span className="name">{decision.name}</span><span className={cooldown > 0 ? 'muted' : 'decision-ready'}>{cooldown > 0 ? `冷却 ${cooldown} 日` : '可执行'}</span></div>
            <div className="muted">{decision.desc}</div>
            <div className="decision-cost">
              {decision.cost.treasury ? <span>银 {decision.cost.treasury.toLocaleString()}</span> : null}
              {decision.cost.politicalPower ? <span>政治 {decision.cost.politicalPower}</span> : null}
              {decision.cost.food ? <span>粮 {decision.cost.food.toLocaleString()}</span> : null}
              {!decision.cost.treasury && !decision.cost.politicalPower && !decision.cost.food ? <span>无成本</span> : null}
            </div>
            <div className="law">效果：{effectsSummary(decision.effect)}</div>
            <button
              className="primary"
              disabled={cooldown > 0 || !available || !affordable}
              onClick={() => command({ type: 'decision.take', decisionId: decision.id })}
            >
              {available ? (affordable ? '执行' : '资源不足') : '条件不满足'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

