import type { Focus } from '../../content/types';
import { isFocusAvailable } from '../../engine/systems/focus';
import { useGameStore } from '../state/store';
import { effectsSummary } from '../format';

export function FocusPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const focuses = content.focusesByCountry.get(country.tag) ?? [];
  const branches = new Map<string, Focus[]>();
  for (const focus of focuses) {
    const list = branches.get(focus.branch) ?? [];
    list.push(focus);
    branches.set(focus.branch, list);
  }
  const active = country.focus ? content.focuses.get(country.focus.id) : null;

  return (
    <div>
      <div className="panel" style={{ paddingBottom: 0 }}>
        <h2>国策 · {content.countries.get(country.tag)?.name}</h2>
        <p className="muted">
          同时只能推进一条国策。国策是史观选择：剿/抚、战/和、迁都/死守、开海/海禁。
        </p>
        {active && (
          <div className="row">
            <span>进行中：{active.name}</span>
            <b>{Math.floor(country.focus?.progress ?? 0)} / {active.costDays} 日</b>
          </div>
        )}
      </div>
      <div className="focus-branches" style={{ padding: '0 16px 24px' }}>
        {[...branches.entries()].map(([branch, nodes]) => (
          <div className="focus-branch" key={branch}>
            <h3>{branch}</h3>
            {nodes.sort((a, b) => a.y - b.y).map(focus => {
              const completed = country.completedFocuses.includes(focus.id);
              const current = country.focus?.id === focus.id;
              const available = isFocusAvailable(game, content, country.tag, focus);
              const status = completed ? 'completed' : current ? 'active' : available ? 'available' : 'locked';
              const missing = focus.prerequisites.filter(id => !country.completedFocuses.includes(id));
              return (
                <div
                  key={focus.id}
                  className={`focus-node ${status}`}
                  onClick={() => {
                    if (available) command({ type: 'focus.start', focusId: focus.id });
                  }}
                  title={focus.desc}
                >
                  <div className="fname">{focus.name}</div>
                  <div className="fmeta">
                    {completed ? '已完成' : current ? `进行中 ${Math.floor(country.focus?.progress ?? 0)}/${focus.costDays}` : `${focus.costDays} 日`}
                  </div>
                  {missing.length > 0 && <div className="fmeta">缺：{missing.map(id => content.focuses.get(id)?.name ?? id).join('、')}</div>}
                  {focus.mutuallyExclusive.length > 0 && (
                    <div className="fmeta">互斥：{focus.mutuallyExclusive.map(id => content.focuses.get(id)?.name ?? id).join('、')}</div>
                  )}
                  <div className="fmeta">{effectsSummary(focus.completionEffect)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
