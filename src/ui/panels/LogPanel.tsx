import { formatDate } from '../../engine/core/clock';
import { useGameStore } from '../state/store';

export function LogPanel() {
  const game = useGameStore(state => state.game);
  if (!game) return null;
  const entries = [...game.log].slice(-200).reverse();
  return (
    <div className="panel">
      <h2>事件日志</h2>
      <p className="muted">按时间倒序。财政、军事、外交、阶级、灾荒与宫廷事件都会留痕。</p>
      {entries.map((entry, index) => (
        <div className={`log-line ${entry.severity}`} key={`${entry.day}-${index}`}>
          <span className="day">{formatDate(entry.day)}</span>
          <span className="muted">[{entry.category}] </span>
          {entry.text}
        </div>
      ))}
    </div>
  );
}
