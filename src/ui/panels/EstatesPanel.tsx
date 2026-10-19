import { minimumAllocationShare } from '../../engine/systems/economy';
import { useGameStore } from '../state/store';

const ESTATE_COLORS = ['#9e2b25', '#b8892e', '#3f6f9a', '#6f8a5a', '#c46a2b', '#7a5f9a', '#4f8b86', '#8a7a60'];

export function EstatesPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const configs = content.countryEstates.get(country.tag) ?? [];
  const report = country.lastReport;
  const controlled = Object.values(game.provinces).filter(province => province.controller === country.tag);
  const totalPopulation = controlled.reduce((sum, province) => sum + province.population, 0);
  const totalFields = controlled.reduce((sum, province) =>
    sum + (content.provinces.get(province.id)?.landholding ?? 0), 0);
  const raw = configs.map(config => ({
    ...config,
    minimum: minimumAllocationShare(country.estates[config.key]?.influence ?? 0),
    value: Math.max(
      minimumAllocationShare(country.estates[config.key]?.influence ?? 0),
      country.allocation[config.key] ?? config.incomeShare * 100,
    ),
  }));
  const rawTotal = raw.reduce((sum, config) => sum + config.value, 0);
  const shares = raw.map(config => rawTotal > 0 ? config.value / rawTotal : 0);
  let cursor = 0;
  const gradient = raw.map((_config, index) => {
    const start = cursor;
    cursor += shares[index] ?? 0;
    return `${ESTATE_COLORS[index % ESTATE_COLORS.length]} ${(start * 100).toFixed(2)}% ${(cursor * 100).toFixed(2)}%`;
  }).join(', ');

  return (
    <div className="panel allocation-panel">
      <h2>分配</h2>
      <p className="muted">
        全国人口与田地先形成经济大盘，再按阶级分配。影响力决定每个阶级的最低分配份额；份额越高，可征的税越多，但也要承担更多维稳成本。
      </p>
      <div className="allocation-top">
        <div className="allocation-pie" style={{ background: `conic-gradient(${gradient || '#8a8578 0 100%'})` }}>
          <div className="allocation-pie-hole">
            <b>{(country.stability).toFixed(0)}</b>
            <small>稳定</small>
          </div>
        </div>
        <div className="allocation-overview">
          <div className="row"><span>总人口</span><b>{Math.round(totalPopulation).toLocaleString()}</b></div>
          <div className="row"><span>田地</span><b>{Math.round(totalFields).toLocaleString()} 亩</b></div>
          <div className="row"><span>经济大盘</span><b>{Math.round(report?.economicPie ?? 0).toLocaleString()} 两 / 月</b></div>
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
        const plan = country.estateFoodPlan[config.key] ?? 'market';
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
              <label>
                粮食方案
                <select
                  value={plan}
                  onChange={event => command({
                    type: 'economy.setEstateFoodPlan',
                    estate: config.key,
                    plan: event.target.value as 'market' | 'subsidy' | 'ration',
                  })}
                >
                  <option value="market">市场供给</option>
                  <option value="subsidy">平价补贴 · 忠诚 +</option>
                  <option value="ration">配给 · 省粮但忠诚 -</option>
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

