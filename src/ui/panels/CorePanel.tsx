import { useGameStore } from '../state/store';
import { CORE_INTEGRATION_DAYS, CORE_INTEGRATION_FOOD, CORE_INTEGRATION_SILVER } from '../../engine/systems/core';
import { formatNumber } from '../format';

export function CorePanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const tag = game.playerTag;
  const controlled = Object.values(game.provinces).filter(province => province.controller === tag);
  const core = controlled.filter(province => province.cores.includes(tag));
  const occupied = controlled.filter(province => !province.cores.includes(tag));
  return (
    <div className="panel core-panel">
      <header className="panel-head">
        <div>
          <h2>核心</h2>
          <p className="muted">核心提供 100% 人力与资源；非核心占领区只提供 15%。</p>
        </div>
      </header>
      <section className="country-grid">
        <div className="country-stat"><span>核心地区</span><strong>{core.length}</strong></div>
        <div className="country-stat"><span>占领区</span><strong>{occupied.length}</strong></div>
      </section>
      <p className="muted">
        收买人心需 {formatNumber(CORE_INTEGRATION_SILVER)} 两、{formatNumber(CORE_INTEGRATION_FOOD)} 石，耗时 {CORE_INTEGRATION_DAYS} 日；期间失去控制会中断。
      </p>
      <section>
        <h3 className="section-title">待核心化地区</h3>
        {occupied.length === 0 && <p className="muted">当前没有非核心占领区。</p>}
        <div className="core-list">
          {occupied.map(province => {
            const def = content.provinces.get(province.id);
            const work = province.coreWork;
            const percent = work ? Math.min(100, Math.round((work.progress / Math.max(1, work.totalDays)) * 100)) : 0;
            return (
              <div className="core-row" key={province.id}>
                <div>
                  <b>{def?.name ?? province.id}</b>
                  <small>{content.prefectures.get(def?.prefectureId ?? '')?.name ?? ''} · 原属 {content.countries.get(province.owner)?.name ?? province.owner}</small>
                  {work && <div className="core-progress"><progress value={work.progress} max={work.totalDays} /><span>{percent}%</span></div>}
                </div>
                <button
                  disabled={Boolean(work)}
                  onClick={() => command({ type: 'province.integrateCore', provinceId: province.id })}
                >
                  {work ? '收买中' : '收买人心'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
