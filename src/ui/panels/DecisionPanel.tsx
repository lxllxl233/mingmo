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
  return (
    <div className="panel">
      <h2>决议</h2>
      <p className="muted">主动施政：有成本、有冷却、有可见条件。</p>
      {decisions.length === 0 && <p className="muted">暂无可用的决议。</p>}
      {decisions.map(decision => {
        const cooldown = country.cooldowns[decision.id] ?? 0;
        const visible = !decision.visible || evaluateTrigger(decision.visible, { state: game, content, country: country.tag });
        const available = !decision.available || evaluateTrigger(decision.available, { state: game, content, country: country.tag });
        const affordable = (decision.cost.treasury ?? 0) <= country.treasury
          && (decision.cost.politicalPower ?? 0) <= country.politicalPower
          && (decision.cost.food ?? 0) <= country.food;
        if (!visible) return null;
        return (
          <div className="estate-card" key={decision.id}>
            <div className="head"><span className="name">{decision.name}</span><span className="muted">{cooldown > 0 ? `冷却 ${cooldown} 日` : '可用'}</span></div>
            <div className="muted">{decision.desc}</div>
            <div className="law">
              成本：{decision.cost.treasury ? `银 ${decision.cost.treasury} ` : ''}
              {decision.cost.politicalPower ? `政治 ${decision.cost.politicalPower} ` : ''}
              {decision.cost.food ? `粮 ${decision.cost.food}` : ''}
              {!decision.cost.treasury && !decision.cost.politicalPower && !decision.cost.food ? '无' : ''}
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
