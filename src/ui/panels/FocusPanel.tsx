import { useGameStore } from '../state/store';
import { FocusTree } from './FocusTree';

export function FocusPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const focuses = content.focusesByCountry.get(country.tag) ?? [];
  const active = country.focus ? content.focuses.get(country.focus.id) : null;
  const completedCount = focuses.filter(focus => country.completedFocuses.includes(focus.id)).length;
  const activeProgress = active ? Math.min(1, (country.focus?.progress ?? 0) / Math.max(1, active.costDays)) : 0;

  return (
    <div>
      <div className="panel focus-head-panel" style={{ paddingBottom: 0 }}>
        <h2>国策 · {content.countries.get(country.tag)?.name}</h2>
        <p className="muted">
          钢铁雄心式树形国策：横向为阶段，纵向为路线；金色连线是前置，红色虚线是互斥。
        </p>
        <div className="focus-summary">
          <span>已完成 <b>{completedCount}</b> / {focuses.length}</span>
          <span>{active ? `进行中 ${active.name}` : '当前未选择国策'}</span>
        </div>
        {active && (
          <>
            <div className="focus-progress-label">
              <span>{active.name}</span>
              <b>{Math.floor(country.focus?.progress ?? 0)} / {active.costDays} 日</b>
              <button className="focus-cancel" onClick={() => command({ type: 'focus.cancel' })}>取消国策</button>
            </div>
            <progress className="focus-progress" value={activeProgress} max={1} />
          </>
        )}
      </div>
      <FocusTree game={game} content={content} focuses={focuses} country={country} />
    </div>
  );
}
