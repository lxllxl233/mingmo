import { useMemo, useState } from 'react';
import type { ContentIndex, Focus } from '../../content/types';
import type { GameState } from '../../engine/state/types';
import { isFocusAvailable } from '../../engine/systems/focus';
import { effectsSummary } from '../format';
import { FocusImage } from './FocusImage';
import { useGameStore } from '../state/store';

const NODE_WIDTH = 168;
const NODE_HEIGHT = 78;
const COLUMN_GAP = 208;
const LANE_GAP = 108;
const LEFT_GUTTER = 92;
const TOP_GUTTER = 32;

function positionOf(focus: Focus, branchIndex: number): { x: number; y: number } {
  return {
    x: LEFT_GUTTER + focus.y * COLUMN_GAP,
    y: TOP_GUTTER + branchIndex * LANE_GAP,
  };
}

export function FocusTree({ game, content, focuses, country }: {
  game: GameState;
  content: ContentIndex;
  focuses: Focus[];
  country: GameState['countries'][string];
}) {
  const command = useGameStore(state => state.command);
  const branchNames = useMemo(() => [...new Set(focuses.map(focus => focus.branch))], [focuses]);
  const [selectedId, setSelectedId] = useState<string | null>(
    country.focus?.id ?? focuses[0]?.id ?? null,
  );
  const selected = focusedSelected(selectedId, focuses) ?? focuses[0] ?? null;
  const positions = new Map<string, { x: number; y: number }>();
  for (const focus of focuses) {
    const branchIndex = branchNames.indexOf(focus.branch);
    positions.set(focus.id, positionOf(focus, Math.max(0, branchIndex)));
  }
  const width = LEFT_GUTTER + 6 * COLUMN_GAP + NODE_WIDTH + 24;
  const height = TOP_GUTTER + branchNames.length * LANE_GAP + NODE_HEIGHT;
  const exclusions = new Map<string, Focus[]>();
  for (const focus of focuses) {
    if (focus.mutuallyExclusive.length === 0) continue;
    exclusions.set(focus.id, focus.mutuallyExclusive
      .map(id => focuses.find(entry => entry.id === id))
      .filter((entry): entry is Focus => entry !== undefined));
  }

  return (
    <div className="focus-tree-wrap">
      <div className="focus-tree-scroll">
        <div className="focus-tree-canvas" style={{ width, height }}>
          <svg className="focus-tree-lines" width={width} height={height} aria-hidden="true">
            {focuses.flatMap(focus => {
              const to = positions.get(focus.id);
              if (!to) return [];
              return focus.prerequisites.flatMap(prerequisiteId => {
                const from = positions.get(prerequisiteId);
                if (!from) return [];
                const x1 = from.x + NODE_WIDTH;
                const y1 = from.y + NODE_HEIGHT / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_HEIGHT / 2;
                const mid = (x1 + x2) / 2;
                return [(
                  <path
                    key={`${prerequisiteId}-${focus.id}`}
                    d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                    className={country.completedFocuses.includes(focus.id) ? 'focus-link done' : 'focus-link'}
                  />
                )];
              });
            })}
            {[...exclusions.entries()].flatMap(([id, partners]) => {
              const from = positions.get(id);
              if (!from) return [];
              return partners.map(partner => {
                const to = positions.get(partner.id);
                if (!to) return null;
                return (
                  <line
                    key={`exclude-${id}-${partner.id}`}
                    x1={from.x + NODE_WIDTH / 2}
                    y1={from.y + NODE_HEIGHT / 2}
                    x2={to.x + NODE_WIDTH / 2}
                    y2={to.y + NODE_HEIGHT / 2}
                    className="focus-exclusion-line"
                  />
                );
              }).filter((entry): entry is JSX.Element => entry !== null);
            })}
          </svg>
          {branchNames.map((branch, index) => (
            <div key={branch} className="focus-tree-branch-label" style={{ top: TOP_GUTTER + index * LANE_GAP + 24 }}>
              {branch}
            </div>
          ))}
          {focuses.map(focus => {
            const pos = positions.get(focus.id);
            if (!pos) return null;
            const completed = country.completedFocuses.includes(focus.id);
            const current = country.focus?.id === focus.id;
            const available = isFocusAvailable(game, content, country.tag, focus);
            const status = completed ? 'completed' : current ? 'active' : available ? 'available' : 'locked';
            const exclusive = focus.mutuallyExclusive.length > 0;
            return (
              <button
                key={focus.id}
                className={`focus-tree-node ${status}${exclusive ? ' exclusive' : ''}${selected?.id === focus.id ? ' selected' : ''}`}
                style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                onClick={() => setSelectedId(focus.id)}
                title={focus.name}
              >
                <FocusImage focusId={focus.id} branch={focus.branch} size={40} />
                <span className="focus-tree-node-text">
                  <b>{focus.name}</b>
                  <small>{completed ? '已完成' : current ? `进行中 ${Math.floor(country.focus?.progress ?? 0)}/${focus.costDays} 日` : `${focus.costDays} 日`}</small>
                </span>
                {exclusive && <i className="focus-tree-exclusive">互斥</i>}
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="focus-tree-detail">
          <div className="focus-tree-detail-head">
            <div>
              <span className="eyebrow">{selected.branch} · 阶段 {selected.y + 1} / 7</span>
              <h3>{selected.name}</h3>
            </div>
            <span className="focus-card-status">
              {country.completedFocuses.includes(selected.id) ? '已完成' : country.focus?.id === selected.id ? '进行中' : `${selected.costDays} 日`}
            </span>
          </div>
          {selected.desc && <p>{selected.desc}</p>}
          {selected.prerequisites.length > 0 && (
            <p className="muted">前置：{selected.prerequisites.map(id => content.focuses.get(id)?.name ?? id).join('、')}</p>
          )}
          {selected.mutuallyExclusive.length > 0 && (
            <p className="danger">互斥：{selected.mutuallyExclusive.map(id => content.focuses.get(id)?.name ?? id).join('、')}（不可同时完成）</p>
          )}
          {selected.grants && selected.grants.length > 0 && (
            <p className="muted">核心目标：{selected.grants.map(id => content.provinces.get(id)?.name ?? id).join('、')}（只获核心，不直接改属）</p>
          )}
          <p className="focus-card-effect">完成效果：{effectsSummary(selected.completionEffect) || '无直接数值效果'}</p>
          <div className="focus-tree-detail-actions">
            {country.focus?.id === selected.id ? (
              <button onClick={() => command({ type: 'focus.cancel' })}>取消当前国策</button>
            ) : (
              <button
                className="primary"
                disabled={!isFocusAvailable(game, content, country.tag, selected)}
                onClick={() => command({ type: 'focus.start', focusId: selected.id })}
              >
                开始国策
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function focusedSelected(id: string | null, focuses: Focus[]): Focus | null {
  if (!id) return null;
  return focuses.find(focus => focus.id === id) ?? null;
}
