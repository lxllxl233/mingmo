import { useState } from 'react';
import type { Focus } from '../../content/types';
import { isFocusAvailable } from '../../engine/systems/focus';
import { useGameStore } from '../state/store';
import { effectsSummary } from '../format';

export function FocusPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const [branchChoice, setBranchChoice] = useState<string | null>(null);
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
  const completedCount = focuses.filter(focus => country.completedFocuses.includes(focus.id)).length;
  const activeProgress = active ? Math.min(1, (country.focus?.progress ?? 0) / Math.max(1, active.costDays)) : 0;
  const branchEntries = [...branches.entries()];
  const selectedBranch = branchChoice && branches.has(branchChoice) ? branchChoice : branchEntries[0]?.[0] ?? null;
  const selectedNodes = selectedBranch ? branches.get(selectedBranch) ?? [] : [];
  const branchIntro = selectedNodes[0]?.historicalContext
    ?? selectedNodes.find(node => node.desc.startsWith(`${node.name}。`))?.desc.slice(
      (selectedNodes.find(node => node.desc.startsWith(`${node.name}。`))?.name.length ?? 0) + 1,
    )
    ?? selectedNodes[0]?.desc
    ?? '';

  return (
    <div>
      <div className="panel focus-head-panel" style={{ paddingBottom: 0 }}>
        <h2>国策 · {content.countries.get(country.tag)?.name}</h2>
        <p className="muted">
          同时只能推进一条国策。国策是史观选择：剿/抚、战/和、迁都/死守、开海/海禁。
        </p>
        <div className="focus-summary">
          <span>已完成 <b>{completedCount}</b> / {focuses.length}</span>
          <span>分支 <b>{branches.size}</b></span>
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
      <div className="focus-tabs">
        {branchEntries.map(([branch, nodes]) => {
          const done = nodes.filter(focus => country.completedFocuses.includes(focus.id)).length;
          return (
            <button
              key={branch}
              className={branch === selectedBranch ? 'active' : ''}
              onClick={() => setBranchChoice(branch)}
            >
              {branch}
              <small>{done}/{nodes.length}</small>
            </button>
          );
        })}
      </div>
      <div className="focus-branch-panel">
        <h3>{selectedBranch ?? '国策'}</h3>
        {branchIntro && <p className="focus-branch-desc">{branchIntro}</p>}
        <div className="focus-card-grid">
          {selectedNodes.sort((a, b) => a.y - b.y).map(focus => {
            const completed = country.completedFocuses.includes(focus.id);
            const current = country.focus?.id === focus.id;
            const available = isFocusAvailable(game, content, country.tag, focus);
            const status = completed ? 'completed' : current ? 'active' : available ? 'available' : 'locked';
            const missing = focus.prerequisites.filter(id => !country.completedFocuses.includes(id));
            return (
              <div
                key={focus.id}
                className={`focus-card ${status}`}
                onClick={() => {
                  if (available) command({ type: 'focus.start', focusId: focus.id });
                }}
              >
                <div className="focus-card-head">
                  <span className="focus-card-name">{focus.name}</span>
                  <span className="focus-card-status">
                    {completed ? '已完成' : current ? `进行中 ${Math.floor(country.focus?.progress ?? 0)}/${focus.costDays}` : `${focus.costDays} 日`}
                  </span>
                </div>
                <div className="focus-card-meta">路线：{focus.branch} · 阶段 {focus.y + 1} / 7</div>
                {missing.length > 0 && <div className="focus-card-meta">前置：{missing.map(id => content.focuses.get(id)?.name ?? id).join('、')}</div>}
                {focus.mutuallyExclusive.length > 0 && (
                  <div className="focus-card-meta">互斥：{focus.mutuallyExclusive.map(id => content.focuses.get(id)?.name ?? id).join('、')}</div>
                )}
                <div className="focus-card-effect">完成效果：{effectsSummary(focus.completionEffect) || '无直接数值效果'}</div>
                {current && (
                  <button className="focus-cancel" onClick={event => {
                    event.stopPropagation();
                    command({ type: 'focus.cancel' });
                  }}>取消国策（进度清零）</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
