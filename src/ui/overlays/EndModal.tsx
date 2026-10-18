import { useGameStore } from '../state/store';

export function EndModal() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const reset = useGameStore(state => state.reset);
  if (!game?.ended) return null;
  const result = game.victory;
  const winner = result?.winner ? content.countries.get(result.winner) : null;
  return (
    <div className="overlay">
      <div className="modal">
        <h2>{result?.reason ?? '终局'}</h2>
        <p className="muted">
          {winner ? `天下归 ${winner.name}` : '天下未定'}
          {result ? ` · 评分 ${result.score}` : ''}
        </p>
        {result && (
          <table className="table">
            <tbody>
              {Object.entries(result.breakdown).map(([key, value]) => (
                <tr key={key}><td>{key}</td><td>{value}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="panel-actions" style={{ marginTop: 18 }}>
          <button className="primary" onClick={reset}>返回主菜单</button>
        </div>
      </div>
    </div>
  );
}
