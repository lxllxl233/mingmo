import type { General } from '../../content/types';
import type { ArmyState } from '../../engine/state/types';
import { useGameStore } from '../state/store';
import { formatNumber } from '../format';
import { GeneralPortrait } from './GeneralPortrait';

const STANCE_NAMES: Record<string, string> = {
  hold: '驻扎',
  move: '行军',
  siege: '围城',
  battle: '交战',
};

function strengthOf(army: ArmyState): number {
  return Object.values(army.composition).reduce((sum, value) => sum + value, 0);
}

export function ArmyPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const selectedArmy = useGameStore(state => state.selectedArmy);
  const closePanel = useGameStore(state => state.closePanel);
  const selectArmy = useGameStore(state => state.selectArmy);
  const openPanel = useGameStore(state => state.openPanel);
  const command = useGameStore(state => state.command);
  if (!game || !selectedArmy) return null;
  const army = game.armies[selectedArmy];
  if (!army || army.tag !== game.playerTag) return null;
  const def = content.countries.get(army.tag);
  const province = content.provinces.get(army.province);
  const general = army.general ? content.generals.get(army.general) ?? null : null;
  const assigned = new Set(
    Object.values(game.armies)
      .filter(entry => entry.general !== null && entry.id !== army.id)
      .map(entry => entry.general),
  );
  const available: General[] = [...content.generals.values()].filter(candidate =>
    candidate.country === army.tag && !assigned.has(candidate.id));
  const strength = strengthOf(army);
  const target = army.movePath.length > 0
    ? content.provinces.get(army.movePath[army.movePath.length - 1] ?? '')?.name ?? ''
    : null;
  const history = (army.history ?? [])
    .map(id => content.provinces.get(id)?.name ?? id)
    .slice(-6);

  return (
    <div className="panel army-panel">
      <header className="panel-head">
        <div>
          <h2>{army.name}</h2>
          <p className="muted">{province?.name ?? army.province} · {STANCE_NAMES[army.stance] ?? army.stance} · {def?.name ?? army.tag}</p>
        </div>
        <button onClick={closePanel}>关闭</button>
      </header>

      <section className="general-card">
        <GeneralPortrait general={general} countryColor={def?.color ?? '#7a7468'} size={104} />
        <div className="general-info">
          <p className="eyebrow">军团将领</p>
          <h3>{general ? general.name : '无将领'}</h3>
          <p className="muted">{general ? (general.generic ? '通用将领' : general.traits.join(' · ') || '行伍出身') : '可由任意将领统领'}</p>
          {general && (
            <div className="general-stats">
              <span>攻 {general.attack}</span>
              <span>防 {general.defense}</span>
              <span>机动 {general.maneuver}</span>
              <span>攻城 {general.siege}</span>
              <span>忠诚 {general.loyalty}</span>
            </div>
          )}
        </div>
      </section>

      <label className="general-picker">
        <span>更换将领</span>
        <select
          value={army.general ?? ''}
          onChange={event => {
            const value = event.target.value;
            command({ type: 'army.assignGeneral', armyId: army.id, generalId: value || null });
          }}
        >
          <option value="">无将领</option>
          {available.map(candidate => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · 攻{candidate.attack} 防{candidate.defense}
            </option>
          ))}
        </select>
      </label>

      <section className="country-grid">
        <div className="country-stat"><span>兵力</span><strong>{formatNumber(strength)}</strong></div>
        <div className="country-stat"><span>组织 / 补给</span><strong>{army.organization.toFixed(0)} / {army.supply.toFixed(0)}</strong></div>
        <div className="country-stat"><span>训练 / 装备</span><strong>{army.training.toFixed(0)} / {army.equipment.toFixed(0)}</strong></div>
        <div className="country-stat"><span>行军目标</span><strong>{target ?? '驻扎'}</strong></div>
      </section>

      <section>
        <h3 className="section-title">兵种</h3>
        <div className="army-composition">
          <span>步兵 <b>{formatNumber(army.composition.infantry)}</b></span>
          <span>火器 <b>{formatNumber(army.composition.firearm)}</b></span>
          <span>骑兵 <b>{formatNumber(army.composition.cavalry)}</b></span>
          <span>炮兵 <b>{formatNumber(army.composition.artillery)}</b></span>
          <span>水师 <b>{formatNumber(army.composition.naval)}</b></span>
        </div>
      </section>

      <section>
        <h3 className="section-title">行军轨迹</h3>
        {history.length === 0 && <p className="muted">尚未移动。</p>}
        {history.length > 0 && <p className="muted">{history.join(' → ')} → {province?.name ?? army.province}</p>}
        {target && <p className="muted">当前目标：{target}</p>}
      </section>

      <footer className="panel-actions">
        <button className="primary" onClick={() => openPanel('military')}>军事列表</button>
        <button onClick={() => command({ type: 'army.stop', armyId: army.id })}>停止</button>
        <button className="ghost" onClick={() => selectArmy(null)}>取消选择</button>
      </footer>
    </div>
  );
}
