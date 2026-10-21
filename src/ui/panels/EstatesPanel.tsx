import { useRef, useState } from 'react';
import {
  distributeAllocation,
  estateAllocationFloor,
  estatePopulationShare,
  minimumAllocationShare,
  stabilityFactor,
} from '../../engine/systems/economy';
import { previewAllocationImpact } from './allocationImpact';
import { canUseTaxLaw } from '../../engine/systems/tax';
import { useGameStore } from '../state/store';

const ESTATE_COLORS: Record<string, string> = {
  ruling: '#9e2b25',
  merchants: '#c46a2b',
  landlords: '#6f8a5a',
  artisans: '#4f8b86',
  peasants: '#9a7b4f',
};
function estateColor(key: string): string {
  return ESTATE_COLORS[key] ?? '#8a7a60';
}
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
  const setSpeed = useGameStore(state => state.setSpeed);
  const [hovered, setHovered] = useState<number | null>(null);
  const resumeSpeed = useRef<0 | 1 | 2 | 4 | 8 | 16 | 32>(0);
  const pauseForDrag = () => {
    const speed = useGameStore.getState().speed;
    if (speed !== 0) resumeSpeed.current = speed;
    setSpeed(0);
  };
  const resumeAfterDrag = () => {
    if (resumeSpeed.current > 0) setSpeed(resumeSpeed.current);
    resumeSpeed.current = 0;
  };
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const configs = content.countryEstates.get(country.tag) ?? [];
  const report = country.lastReport;
  const controlled = Object.values(game.provinces).filter(province => province.controller === country.tag);
  const totalPopulation = controlled.reduce((sum, province) => sum + province.population, 0);
  const totalFields = controlled.reduce((sum, province) =>
    sum + (content.provinces.get(province.id)?.landholding ?? 0), 0);
  const populationWeights = configs.map(config => estatePopulationShare(content, country.tag, config.key));
  const populationWeightTotal = populationWeights.reduce((sum, value) => sum + value, 0);
  const raw = configs.map((config, index) => {
    const estate = country.estates[config.key];
    const influence = estate?.influence ?? 0;
    const minimum = minimumAllocationShare(influence);
    const floor = estate
      ? estateAllocationFloor(content, country.tag, config.key, influence, estate.allocationUnlocked)
      : minimum;
    return {
      ...config,
      minimum,
      floor,
      unlocked: estate?.allocationUnlocked === true,
      value: Math.max(floor, country.allocation[config.key] ?? config.incomeShare * 100),
      population: totalPopulation * (populationWeights[index] ?? 0) / Math.max(0.01, populationWeightTotal),
    };
  });
  // 与引擎同一套「带下限归一化」：预览份额不会绕过既得利益锁定。
  const sharesMap = distributeAllocation(
    Object.fromEntries(raw.map(config => [config.key, config.value])),
    Object.fromEntries(raw.map(config => [config.key, config.floor])),
  );
  const shares = raw.map(config => (sharesMap[config.key] ?? 0) / 100);
  const floorTotal = raw.reduce((sum, config) => sum + config.floor, 0);
  const lastAllocation = report?.allocation ?? {};
  // 用入银部分（silverByEstate）而不是含粮折的总税，否则预计收入与月报的「总收入」不可比，
  // 会把基层维稳等按收入估计的支出一起抬高。
  const lastTax = report?.silverByEstate ?? {};
  const projectedTax = raw.reduce((sum, config, index) => {
    const previous = lastAllocation[config.key] ?? shares[index] ?? 0;
    const tax = lastTax[config.key] ?? 0;
    return sum + (previous > 0 ? tax * (shares[index] ?? 0) / previous : 0);
  }, 0);
  const projectedTrade = (report?.tradePostIncome ?? 0) + (report?.sakokuIncome ?? 0);
  const projectedIncome = projectedTax + projectedTrade;
  const projectedRatio = (report?.income ?? 0) > 0 ? projectedIncome / (report?.income ?? 1) : 1;
  const projectedCorruption = (report?.corruptionLoss ?? 0) * projectedRatio;
  // 与引擎一致：维稳基数按史实惯例份额推算，不随玩家拖动分配而变化。
  const referenceTax = raw.reduce((sum, config) => {
    // report.allocation 存的是 0–1 的份额，与 config.incomeShare 同量纲。
    const previous = lastAllocation[config.key] ?? 0;
    const tax = lastTax[config.key] ?? 0;
    return sum + (previous > 0 ? tax * config.incomeShare / previous : 0);
  }, 0);
  // silverByEstate 是封锁/过度扩张折扣前的值；用月报实际银税把这个折扣补回来。
  const lastSilverTotal = Object.values(lastTax).reduce((sum, value) => sum + value, 0);
  const taxedIncome = Math.max(0, (report?.income ?? 0) - projectedTrade);
  const referenceIncome = lastSilverTotal > 0
    ? taxedIncome * referenceTax / lastSilverTotal + projectedTrade
    : projectedTrade;
  // 与月结同构的下月预览：份额 → 各阶级忠诚 → 稳定目标；基层人口/忠诚 → 基层维稳。
  const impact = previewAllocationImpact(content, country, configs, shares, referenceIncome);
  const projectedPressure = report?.expenseCourt ?? 0;
  const projectedArmyDue = report?.expenseArmy ?? 0;
  // 与引擎一致：腐败/维稳先扣收入，维持成本可超支，军饷再吃现金。
  const projectedAvailable = projectedIncome - projectedCorruption - impact.maintenanceCost - projectedPressure;
  const projectedLiquid = Math.max(0, projectedAvailable + country.treasury);
  const projectedArmy = Math.min(projectedArmyDue, projectedLiquid);
  const projectedCashAfterArmy = Math.max(0, projectedLiquid - projectedArmy);
  const projectedFoodTarget = Math.max(0, projectedAvailable) * country.foodPurchasePct / 100;
  const projectedFoodSilver = Math.min(projectedFoodTarget, projectedCashAfterArmy);
  const projectedFood = projectedFoodSilver / Math.max(0.1, content.balance.economy.grainPrice);
  const projectedNet = projectedAvailable - projectedArmy - projectedFoodSilver;
  // 首月结算前 report.foodArmy 尚未产生（为 0/undefined）；此时"温饱 N 个月"无意义，按 null 处理。
  const armyFood = report?.foodArmy ?? 0;
  const foodMonths = armyFood > 0 ? (country.food + projectedFood) / armyFood : null;
  const pieSlices = raw.map((config, index) => ({
    label: config.name,
    share: shares[index] ?? 0,
    color: estateColor(config.key),
    population: config.population,
    wealth: (report?.economicPie ?? 0) * (shares[index] ?? 0),
    tax: report?.taxByEstate?.[config.key] ?? 0,
  })).filter(slice => slice.share > 0.0001);
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
        全国人口与田地先形成经济大盘，再按阶级分配。份额高于惯例会让该阶级的影响力缓慢上升（反之下降），
        影响力再决定下月的最低分配份额。影响力越大，越难把财富从该阶级手里拿走：未改革时只能在惯例份额附近小幅下调，
        完成该阶级的税制改革后锁定才会解除。只有农民与匠户是维稳对象，其低忠诚才会产生基层维稳成本。
      </p>
      {!report && (
        <p className="muted">尚未进行首次月度结算，下方经济数字会在首月结算后更新。</p>
      )}
      <div className="allocation-preview">
        <span>当前分配预计温饱 <b className={foodMonths !== null && foodMonths < 1 ? 'danger' : 'good'}>{foodMonths === null ? '—（首月结算后显示）' : `${foodMonths.toFixed(1)} 个月`}</b></span>
        <span>预计月净银（不含火耗） <b className={projectedNet < 0 ? 'danger' : ''}>{Math.round(projectedNet).toLocaleString()} 两</b></span>
        <span>预计购粮 <b>{Math.round(projectedFood).toLocaleString()} 石</b></span>
        <span>
          预计稳定（下月） <b className={impact.stabilityDelta >= 0 ? 'good' : 'danger'}>{impact.stability.toFixed(1)}</b>
          <small className="muted">（{impact.stabilityDelta >= 0 ? '+' : ''}{impact.stabilityDelta.toFixed(2)}/月，目标 {impact.stabilityTarget.toFixed(0)}）</small>
        </span>
        <span>
          预计基层维稳（下月） <b className="danger">-{Math.round(impact.maintenanceCost).toLocaleString()} 两/月</b>
          <small className="muted">（农民+匠户占人口 {(impact.bottomPopShare * 100).toFixed(0)}%，基层忠诚 {impact.bottomLoyalty.toFixed(1)}）</small>
        </span>
      </div>
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
              <span>人口 {Math.round(hoveredSlice.population).toLocaleString()}</span>
              <span>财富 {Math.round(hoveredSlice.wealth).toLocaleString()} 两</span>
              <span>税收 {Math.round(hoveredSlice.tax).toLocaleString()} 两</span>
            </div>
          )}
        </div>
        <div className="allocation-overview">
          <div className="row"><span>总人口</span><b>{Math.round(totalPopulation).toLocaleString()}</b></div>
          <div className="row"><span>田地</span><b>{Math.round(totalFields).toLocaleString()} 万亩</b></div>
          <div className="row"><span>经济大盘</span><b>{Math.round(report?.economicPie ?? 0).toLocaleString()} 两 / 月</b></div>
          <div className="row"><span>稳定系数</span><b>{(stabilityFactor(country.stability) * 100).toFixed(0)}%</b></div>
          <div className="row"><span>总收入（税 / 贸易站 / 锁国）</span><b>{Math.round(report?.income ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>其中税收</span><b>{Math.round(report?.taxIncome ?? 0).toLocaleString()} · 贸易站 {Math.round(report?.tradePostIncome ?? 0).toLocaleString()} · 锁国 {Math.round(report?.sakokuIncome ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>军饷（实付 / 应付）</span><b className="danger">-{Math.round(report?.expenseArmyPaid ?? report?.expenseArmy ?? 0).toLocaleString()} / {Math.round(report?.expenseArmy ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>购粮</span><b className="danger">-{Math.round(report?.foodPurchaseSilver ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>训练</span><b className="danger">-{Math.round(report?.expenseTraining ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>腐败侵蚀</span><b className="danger">-{Math.round(report?.corruptionLoss ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>基层维稳</span><b className="danger">-{Math.round(report?.loyaltyCost ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>维持成本（行政/军镇）</span><b className="danger">-{Math.round(report?.expenseCourt ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>囤银压力</span><b className={(report?.hoardPressure ?? 0) > 0 ? 'warn' : ''}>{((report?.hoardPressure ?? 0) * 100).toFixed(0)}%</b></div>
          <div className="row"><span>最终净银</span><b className={(report?.net ?? 0) >= 0 ? 'good' : 'danger'}>{Math.round(report?.net ?? 0).toLocaleString()}</b></div>
          <div className="row"><span>基层忠诚（人口占比）</span><b>{(report?.bottomLoyalty ?? 0).toFixed(0)}%（{((report?.bottomPopShare ?? 0) * 100).toFixed(0)}%）</b></div>
          {((report?.trainingStalledSilver ?? 0) > 0 || (report?.trainingStalledFood ?? 0) > 0) && (
            <p className="warn">
              训练停滞：{report?.trainingStalledSilver ? '缺银' : ''}{report?.trainingStalledSilver && report?.trainingStalledFood ? '、' : ''}{report?.trainingStalledFood ? '缺粮' : ''}
              （当月累计 {Math.max(report?.trainingStalledSilver ?? 0, report?.trainingStalledFood ?? 0)} 日次，不形成债务）
            </p>
          )}
          {(report?.wageShortfall ?? 0) > 0 && <p className="danger">本月欠饷 {Math.round(report?.wageShortfall ?? 0).toLocaleString()} 两；购粮不足不形成债务。</p>}
          {(report?.hoardPressure ?? 0) > 0 && <p className="warn">国库超过囤银上限：腐败与通胀会持续上升，建议扩军、买粮或投资。</p>}
          {country.corruption >= 70 && <p className="danger">腐败正在吞掉约 {Math.round(Math.min(85, country.corruption / 135 * 100))}% 的税收；养廉银或「京察/考成」可降低腐败。</p>}
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
        // 与引擎一致：忠诚漂移以史实惯例份额为基准，而不是人口占比。
        const loyaltyPreview = (shares[index]! - config.incomeShare) * 3;
        const projectedInfluence = impact.influences[index] ?? estate.influence;
        const projectedMinimum = impact.minimums[index] ?? config.minimum;
        const minimumWillBind = projectedMinimum > shares[index]! * 100 + 0.05;
        // 该阶级最多能拿到的份额：其余阶级的可动下限之和之外的部分。
        const maxShare = Math.round(
          Math.max(config.floor, 100 - Math.max(0, floorTotal - config.floor)) * 100,
        ) / 100;
        const atFloor = !config.unlocked && config.value <= config.floor + 0.05;
        return (
          <div className="allocation-card" key={config.key}>
            <div className="allocation-card-head">
              <span className="allocation-swatch" style={{ background: estateColor(config.key) }} />
              <b>{config.name}</b>
              <span className="muted">
                影响 {estate.influence.toFixed(1)} → {impact.influences[index]!.toFixed(1)}
                {' '}· 政治底线 {config.minimum.toFixed(2)}% → {impact.minimums[index]!.toFixed(2)}%
              </span>
              <strong>{(shares[index]! * 100).toFixed(1)}%</strong>
            </div>
            <input
              className="allocation-range"
              type="range"
              min={config.floor}
              max={maxShare}
              step="any"
              value={config.value}
              onPointerDown={pauseForDrag}
              onPointerUp={resumeAfterDrag}
              onTouchStart={pauseForDrag}
              onTouchEnd={resumeAfterDrag}
              onChange={event => command({
                type: 'economy.setAllocation',
                estate: config.key,
                value: Number(event.target.value),
              })}
            />
            {!config.unlocked && config.floor > config.minimum + 0.05 && (
              <p className={atFloor ? 'warn' : 'muted'}>
                分配锁定：可动下限 {config.floor.toFixed(1)}%。
                {atFloor ? ' 已触底，启动该阶级的税制改革才能继续下调。' : ''}
              </p>
            )}
            <div className="allocation-metrics">
              <span>人口 {Math.round(config.population).toLocaleString()}（{totalPopulation > 0 ? (config.population / totalPopulation * 100).toFixed(1) : '0.0'}%）</span>
              <span className={config.unlocked ? 'good' : 'muted'}>
                可动下限 {config.floor.toFixed(1)}%{config.unlocked ? '（已改革解锁）' : ''}
              </span>
              <span>忠诚 {estate.loyalty.toFixed(0)}</span>
              <span className={loyaltyPreview < 0 ? 'danger' : 'good'}>分配忠诚影响 {loyaltyPreview >= 0 ? '+' : ''}{loyaltyPreview.toFixed(2)}/月</span>
              <span className={projectedInfluence < estate.influence ? 'warn' : 'good'}>
                影响力 {projectedInfluence >= estate.influence ? '+' : ''}{(projectedInfluence - estate.influence).toFixed(2)}/月
              </span>
              {minimumWillBind && (
                <span className="warn">下月份额将被最低 {projectedMinimum.toFixed(2)}% 抬升</span>
              )}
              <span>本阶级收入 {Math.round(estate.income / 12).toLocaleString()} 两/月</span>
              <span>实收税（含粮折） {Math.round(estate.collected).toLocaleString()} 两/月</span>
              <span className="danger">腐败归属 -{Math.round(report?.corruptionByEstate?.[config.key] ?? 0).toLocaleString()} 两/月</span>
            </div>
            <div className="allocation-controls">
              <label>
                税法
                <select
                  value={estate.taxLaw}
                  disabled={estate.reform !== null || estate.cooldownDays > 0}
                  onChange={event => command({ type: 'tax.setLaw', estate: config.key, lawId: event.target.value })}
                >
                  {laws.map(law => {
                    const available = law.id === estate.taxLaw
                      || (country.politicalPower >= 50
                        && canUseTaxLaw(game, content, country.tag, config.key, law.id));
                    return (
                      <option key={law.id} value={law.id} disabled={!available}>
                        {law.name} · {(law.rate * 100).toFixed(1)}%
                        {' '}· 忠诚{law.loyaltyDrift >= 0 ? '+' : ''}{law.loyaltyDrift.toFixed(1)}
                        {!available && law.id !== estate.taxLaw ? '（条件不足）' : ''}
                      </option>
                    );
                  })}
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
          onPointerDown={pauseForDrag}
          onPointerUp={resumeAfterDrag}
          onTouchStart={pauseForDrag}
          onTouchEnd={resumeAfterDrag}
          onChange={event => command({ type: 'economy.setFoodPurchasePct', value: Number(event.target.value) })}
        />
        <small>
          预计每月购粮 <b>{Math.round(projectedFood).toLocaleString()} 石</b>（花 {Math.round(projectedFoodSilver).toLocaleString()} 两银）
        </small>
        <small className="muted">
          上月实际：支出 {Math.round(report?.foodPurchaseSilver ?? 0).toLocaleString()} 两 ·
          购入 {Math.round(report?.foodPurchased ?? 0).toLocaleString()} 石 ·
          粮储 {Math.round(country.food).toLocaleString()} 石
        </small>
        {country.flags['food_shortage'] && <p className="danger">粮食短缺，正在降低各阶级忠诚与稳定。</p>}
      </div>
      <p className="muted">税后先扣腐败与低忠诚导致的维稳成本，再扣军饷与购粮支出，剩余才进入国库。</p>
    </div>
  );
}









