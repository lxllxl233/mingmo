import { useState } from 'react';
import { minimumAllocationShare } from '../../engine/systems/economy';
import { useGameStore } from '../state/store';

const ESTATE_COLORS = ['#9e2b25', '#b8892e', '#3f6f9a', '#6f8a5a', '#c46a2b', '#7a5f9a', '#4f8b86', '#8a7a60'];
const POPULATION_WEIGHTS: Record<string, number> = {
  dynasty: 0.015,
  nobles: 0.035,
  officials: 0.045,
  gentry: 0.14,
  merchants: 0.06,
  peasants: 0.56,
  soldiers: 0.08,
  clergy: 0.04,
};

function piePath(start: number, end: number): string {
  const center = 50;
  const radius = 46;
  const startAngle = start * Math.PI * 2 - Math.PI / 2;
  const endAngle = end * Math.PI * 2 - Math.PI / 2;
  const x1 = center + Math.cos(startAngle) * radius;
  const y1 = center + Math.sin(startAngle) * radius;
  const x2 = center + Math.cos(endAngle) * radius;
  const y2 = center + Math.sin(endAngle) * radius;
  const large = end - start > 0.5 ? 1 : 0;
  return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function EstatesPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const [hovered, setHovered] = useState<number | null>(null);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const configs = content.countryEstates.get(country.tag) ?? [];
  const report = country.lastReport;
  const controlled = Object.values(game.provinces).filter(province => province.controller === country.tag);
  const totalPopulation = controlled.reduce((sum, province) => sum + province.population, 0);
  const totalFields = controlled.reduce((sum, province) =>
    sum + (content.provinces.get(province.id)?.landholding ?? 0), 0);
  const populationWeights = configs.map(config => POPULATION_WEIGHTS[config.key] ?? 0.05);
  const populationWeightTotal = populationWeights.reduce((sum, value) => sum + value, 0);
  const raw = configs.map((config, index) => ({
    ...config,
    minimum: minimumAllocationShare(country.estates[config.key]?.influence ?? 0),
    value: Math.max(
      minimumAllocationShare(country.estates[config.key]?.influence ?? 0),
      country.allocation[config.key] ?? config.incomeShare * 100,
    ),
    population: totalPopulation * (populationWeights[index] ?? 0) / Math.max(0.01, populationWeightTotal),
  }));
  const rawTotal = raw.reduce((sum, config) => sum + config.value, 0);
  const scale = rawTotal > 100 ? 100 / rawTotal : 1;
  const shares = raw.map(config => config.value * scale / 100);
  const unallocated = Math.max(0, 1 - shares.reduce((sum, value) => sum + value, 0));
  const pieSlices = [
    ...raw.map((config, index) => ({
      label: config.name,
      share: shares[index] ?? 0,
      color: ESTATE_COLORS[index % ESTATE_COLORS.length]!,
      population: config.population,
      wealth: (report?.economicPie ?? 0) * (shares[index] ?? 0),
      tax: report?.taxByEstate?.[config.key] ?? 0,
      unallocated: false,
    })),
    {
      label: '未分配',
      share: unallocated,
      color: '#b7aa92',
      population: 0,
      wealth: (report?.economicPie ?? 0) * unallocated,
      tax: 0,
      unallocated: true,
    },
  ].filter(slice => slice.share > 0.0001);
  let cursor = 0;
  const paths = pieSlices.map((slice, index) => {
    const start = cursor;
    cursor += slice.share;
    return { ...slice, index, start, end: cursor };
  });
  const hoveredSlice = hovered === null ? null : paths.find(slice => slice.index === hovered) ?? null;
  return (
    <div className="panel allocation-panel">
      <h2>分配</h2>
      <p className="muted">
        全国人口与田地先形成经济大盘，再按阶级分配。影响力决定每个阶级的最低分配份额；份额越高，可征的税越多，但也要承担更多维稳成本。
      </p>
      <div className="allocation-top">
        <div className="allocation-pie-wrap">
          <svg className="allocation-pie-svg" viewBox="0 0 100 100" role="img" aria-label="财富大盘分配饼图">
            {paths.map(slice => (
              <path
                key={slice.label}
                d={piePath(slice.start, slice.end)}
                fill={slice.color}
                stroke="#f1e7d2"
                strokeWidth="0.8"
                onMouseEnter={() => setHovered(slice.index)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
            <circle cx="50" cy="50" r="25" fill="#f1e7d2" stroke="#cbb995" strokeWidth="0.8" />
          </svg>
          <div className="allocation-pie-hole">
            <b>{country.stability.toFixed(0)}</b>
            <small>稳定</small>
          </div>
          {hoveredSlice && (
            <div className="allocation-pie-tooltip">
              <b>{hoveredSlice.label}</b>
              <span>{(hoveredSlice.share * 100).toFixed(1)}%</span>
              {!hoveredSlice.unallocated && <span>人口 {Math.round(hoveredSlice.population).toLocaleString()}</span>}
              <span>财富 {Math.round(hoveredSlice.wealth).toLocaleString()} 两</span>
              <span>税收 {Math.round(hoveredSlice.tax).toLocaleString()} 两</span>
            </div>
          )}
        </div>
        <div className="allocation-overview">
          <div className="row"><span>总人口</span><b>{Math.round(totalPopulation).toLocaleString()}</b></div>
          <div className="row"><span>田地</span><b>{Math.round(totalFields).toLocaleString()} 亩</b></div>
          <div className="row"><span>经济大盘</span><b>{Math.round(report?.economicPie ?? 0).toLocaleString()} 两 / 月</b></div>
          <div className="row"><span>未分配</span><b className={unallocated > 0.2 ? 'warn' : ''}>{(unallocated * 100).toFixed(1)}%</b></div>
          <div className="row"><span>稳定影响</span><b>{(55 + country.stability * 0.45).toFixed(0)}%</b></div>
          <div className="row"><span>腐败侵蚀</span><b className="danger">-{Math.round(report?.corruptionLoss ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>忠诚维稳</span><b className="danger">-{Math.round(report?.loyaltyCost ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>最终银收</span><b className="good">{Math.round(report?.net ?? 0).toLocaleString()}</b></div>
        </div>
      </div>

      <h3>阶级分配</h3>
      {raw.length === 0 && <p className="muted">本国没有可分配阶级。</p>}
      {raw.map((config, index) => {
        const estate = country.estates[config.key];
        if (!estate) return null;
        const laws = (content.taxLawsByEstate.get(config.key) ?? [])
          .filter(law => law.country === undefined || law.country === country.tag)
          .sort((a, b) => a.rate - b.rate);
        const currentLaw = content.taxLaws.get(estate.taxLaw);
        return (
          <div className="allocation-card" key={config.key}>
            <div className="allocation-card-head">
              <span className="allocation-swatch" style={{ background: ESTATE_COLORS[index % ESTATE_COLORS.length] }} />
              <b>{config.name}</b>
              <span className="muted">影响 {estate.influence.toFixed(0)} · 最低 {config.minimum.toFixed(1)}%</span>
              <strong>{(shares[index]! * 100).toFixed(1)}%</strong>
            </div>
            <input
              className="allocation-range"
              type="range"
              min={config.minimum}
              max={100}
              step={0.5}
              value={config.value}
              onChange={event => command({
                type: 'economy.setAllocation',
                estate: config.key,
                value: Number(event.target.value),
              })}
            />
            <div className="allocation-metrics">
              <span>人口 {Math.round(config.population).toLocaleString()}（{totalPopulation > 0 ? (config.population / totalPopulation * 100).toFixed(1) : '0.0'}%）</span>
              <span>忠诚 {estate.loyalty.toFixed(0)}</span>
              <span>本阶级收入 {Math.round(estate.income / 12).toLocaleString()} 两/月</span>
              <span>实际入库 {Math.round(estate.collected).toLocaleString()} 两/月</span>
            </div>
            <div className="allocation-controls">
              <label>
                税法
                <select
                  value={estate.taxLaw}
                  disabled={estate.reform !== null || estate.cooldownDays > 0}
                  onChange={event => command({ type: 'tax.setLaw', estate: config.key, lawId: event.target.value })}
                >
                  {laws.map(law => (
                    <option key={law.id} value={law.id}>
                      {law.name} · {(law.rate * 100).toFixed(1)}%
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="muted">
              现行税法：{currentLaw?.name ?? estate.taxLaw}
              {estate.reform && ` · 改革中 ${estate.reform.daysLeft} 日`}
            </div>
          </div>
        );
      })}

      <h3>粮食采购</h3>
      <div className="allocation-food">
        <div>
          <b>{country.foodPurchasePct.toFixed(0)}%</b>
          <span className="muted"> 的可用银收入用于买粮</span>
        </div>
        <input
          className="allocation-range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={country.foodPurchasePct}
          onChange={event => command({ type: 'economy.setFoodPurchasePct', value: Number(event.target.value) })}
        />
        <small>
          购粮支出 {Math.round(report?.foodPurchaseSilver ?? 0).toLocaleString()} 两 ·
          购入 {Math.round(report?.foodPurchased ?? 0).toLocaleString()} 石 ·
          粮储 {Math.round(country.food).toLocaleString()} 石
        </small>
        {country.flags['food_shortage'] && <p className="danger">粮食短缺，正在降低各阶级忠诚与稳定。</p>}
      </div>
      <p className="muted">税后先扣腐败与低忠诚导致的维稳成本，再扣军饷与购粮支出，剩余才进入国库。</p>
    </div>
  );
}



