import { useState } from 'react';
import type { ContentIndex } from '../../content/types';
import { useGameStore } from '../state/store';
import { formatNumber } from '../format';

function findPath(content: ContentIndex, from: string, to: string): string[] | null {
  if (from === to) return [];
  const queue: Array<{ id: string; path: string[] }> = [{ id: from, path: [] }];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const def = content.provinces.get(current.id);
    if (!def) continue;
    for (const next of def.neighbors) {
      if (seen.has(next)) continue;
      seen.add(next);
      const path = [...current.path, next];
      if (next === to) return path;
      if (path.length < 30) queue.push({ id: next, path });
    }
  }
  return null;
}

export function MilitaryPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const selectedArmy = useGameStore(state => state.selectedArmy);
  const selectArmy = useGameStore(state => state.selectArmy);
  const selectedProvince = useGameStore(state => state.selectedProvince);
  const [template, setTemplate] = useState('ming_guard');
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const armies = Object.values(game.armies).filter(army => army.tag === game.playerTag);
  const army = selectedArmy ? game.armies[selectedArmy] : null;

  return (
    <div className="panel">
      <h2>军事</h2>
      <p className="muted">军队按省移动，逐日结算战斗与围城。欠饷会先打募兵，再打家丁。</p>
      <div className="panel-actions">
        <select value={template} onChange={event => setTemplate(event.target.value)}>
          {[...content.armyTemplates.values()].map(entry => (
            <option key={entry.id} value={entry.id}>{entry.name} · {entry.composition.infantry + entry.composition.firearm + entry.composition.cavalry + entry.composition.artillery + entry.composition.naval} 人/营</option>
          ))}
        </select>
        <button
          className="primary"
          onClick={() => command({ type: 'army.recruit', province: country.capital, template, size: 2 })}
        >
          在京师征募 2 营
        </button>
      </div>
      <h3>军团</h3>
      {armies.length === 0 && <p className="muted">无</p>}
      {armies.map(entry => {
        const strength = entry.composition.infantry + entry.composition.firearm + entry.composition.cavalry
          + entry.composition.artillery + entry.composition.naval;
        return (
          <div
            key={entry.id}
            className={`estate-card${selectedArmy === entry.id ? ' selected' : ''}`}
            onClick={() => selectArmy(entry.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="head"><span className="name">{entry.name}</span><span className="muted">{entry.stance}</span></div>
            <div className="metrics">
              <span>{Math.round(strength).toLocaleString()} 人</span>
              <span>组织 {entry.organization.toFixed(0)}</span>
              <span>补给 {entry.supply.toFixed(0)}</span>
            </div>
            <div className="muted">
              {content.provinces.get(entry.province)?.name ?? entry.province}
              {entry.movePath.length > 0 ? ` → ${content.provinces.get(entry.movePath[entry.movePath.length - 1] ?? '')?.name ?? ''}` : ''}
            </div>
          </div>
        );
      })}
      {army && (
        <>
          <h3>命令：{army.name}</h3>
          <div className="row"><span>位置</span><b>{content.provinces.get(army.province)?.name ?? army.province}</b></div>
          <div className="row"><span>将领</span><b>
            {army.general ? content.generals.get(army.general)?.name ?? army.general : '无'}
          </b></div>
          <div className="row"><span>训练 / 装备</span><b>{army.training.toFixed(0)} / {army.equipment.toFixed(0)}</b></div>
          <div className="row"><span>兵种</span><b>
            步 {formatNumber(army.composition.infantry)} · 火 {formatNumber(army.composition.firearm)} · 骑 {formatNumber(army.composition.cavalry)} · 炮 {formatNumber(army.composition.artillery)}
          </b></div>
          <div className="panel-actions">
            <button
              className="primary"
              disabled={!selectedProvince}
              onClick={() => {
                if (!selectedProvince) return;
                const path = findPath(content, army.province, selectedProvince);
                if (!path) {
                  useGameStore.setState({ message: '没有可通行路径' });
                  return;
                }
                command({ type: 'army.move', armyId: army.id, path });
              }}
            >
              行军到选中省份
            </button>
            <button onClick={() => command({ type: 'army.stop', armyId: army.id })}>停止</button>
            <button className="ghost" onClick={() => selectArmy(null)}>取消选择</button>
          </div>
        </>
      )}
    </div>
  );
}
