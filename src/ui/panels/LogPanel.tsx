import { formatDate } from '../../engine/core/clock';
import { useGameStore } from '../state/store';

const CATEGORY_NAMES: Record<string, string> = {
  economy: '财政',
  military: '军事',
  diplomacy: '外交',
  politics: '政治',
  estate: '阶级',
  disaster: '灾荒',
  event: '事件',
  system: '系统',
};

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
          <span className="muted">[{CATEGORY_NAMES[entry.category] ?? entry.category}] </span>
          {entry.text}
        </div>
      ))}
    </div>
  );
}
