import { useState, type ReactNode } from 'react';
import { formatDate } from '../../engine/core/clock';
import { sound } from '../../app/audio/sound';
import { controlledProvinceCount } from '../../engine/rules/geography';
import { useGameStore } from '../state/store';
import { MusicControl } from './MusicControl';

function number(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toFixed(digits);
}

function Stat({
  label,
  value,
  tone = '',
  tooltip,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  tooltip: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`stat has-tooltip${tone ? ` ${tone}` : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {label} <b>{value}</b>
      {open && <span className="stat-tooltip">{tooltip}</span>}
    </span>
  );
}

export function TopBar() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const save = useGameStore(state => state.save);
  const load = useGameStore(state => state.load);
  const reset = useGameStore(state => state.reset);
  const [muted, setMuted] = useState(sound.isMuted);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  const countryDef = content.countries.get(game.playerTag);
  const report = country?.lastReport;
  const arrearsMonths = country && report && report.expenseArmy > 0
    ? country.arrears / report.expenseArmy
    : 0;
  const pending = game.pendingEvents.filter(event => event.country === game.playerTag).length;
  const armies = Object.values(game.armies).filter(army => army.tag === game.playerTag);
  const armyStrength = armies.reduce((sum, army) => sum
    + army.composition.infantry + army.composition.firearm + army.composition.cavalry
    + army.composition.artillery + army.composition.naval, 0);
  const provinces = Object.values(game.provinces).filter(province => province.controller === game.playerTag).length;
  const controlledProvinces = Object.values(game.provinces).filter(province => province.controller === game.playerTag);
  const totalPopulation = controlledProvinces.reduce((sum, province) => sum + province.population, 0);
  const corePopulation = controlledProvinces
    .filter(province => province.cores.includes(game.playerTag))
    .reduce((sum, province) => sum + province.population, 0);
  const nonCorePopulation = totalPopulation - corePopulation;
  const disloyalProvinces = controlledProvinces.filter(province => province.unrest >= 20);
  const disloyalPopulation = disloyalProvinces.reduce((sum, province) => sum + province.population, 0);
  const foodBalance = (report?.foodPurchased ?? 0) - (report?.foodArmy ?? 0);
  const estateStability = country
    ? Object.values(country.estates).map(estate => {
      const config = content.countryEstates.get(country.tag)?.find(entry => entry.key === estate.key);
      const weight = Math.max(1, estate.influence);
      return {
        key: estate.key,
        name: config?.name ?? content.estateDefs.get(estate.key)?.name ?? estate.key,
        loyalty: estate.loyalty,
        influence: estate.influence,
        weight,
      };
    }).sort((a, b) => b.loyalty * b.weight - a.loyalty * a.weight)
    : [];
  const stabilityWeight = estateStability.reduce((sum, estate) => sum + estate.weight, 0);
  const stabilityTarget = stabilityWeight > 0
    ? estateStability.reduce((sum, estate) => sum + estate.loyalty * estate.weight, 0) / stabilityWeight
    : 0;
  const provinceGroups = controlledProvinceCount(game, content, game.playerTag);
  const playerTraining = game.training.filter(entry => entry.tag === game.playerTag);
  const trainingSilverDay = playerTraining.reduce((sum, entry) =>
    sum + (entry.totalDays > 0 ? entry.costSilver / entry.totalDays : 0), 0);
  const trainingFoodDay = playerTraining.reduce((sum, entry) =>
    sum + (entry.totalDays > 0 ? entry.costFood / entry.totalDays : 0), 0);

  return (
    <header className="topbar">
      <span className="date">{formatDate(game.day)}</span>
      <span className="stat" style={{ color: countryDef?.color }}>{countryDef?.name ?? game.playerTag}</span>
      <Stat
        label="银"
        value={number(country?.treasury ?? 0)}
        tone={(country?.treasury ?? 0) < 100000 ? 'warn' : ''}
        tooltip={
          <>
            <b>国库 {number(country?.treasury ?? 0)} 两</b>
            <span>本月收入 {number(report?.income ?? 0)} 两</span>
            <span>本月支出 {number(report?.expense ?? 0)} 两</span>
            <span>本月净额 <i className={(report?.net ?? 0) >= 0 ? 'good' : 'danger'}>{number(report?.net ?? 0)}</i> 两</span>
            <span>军饷 {number(report?.expenseArmy ?? 0)} · 购粮 {number(report?.foodPurchaseSilver ?? 0)}</span>
            <span>腐败损耗 {number(report?.corruptionLoss ?? 0)} · 忠诚维稳 {number(report?.loyaltyCost ?? 0)}</span>
            <span>训练日耗 {number(trainingSilverDay)} 两</span>
            <span>欠饷 {number(country?.arrears ?? 0)} 两 · {arrearsMonths.toFixed(1)} 个月</span>
            <small>收入由经济大盘按阶级分配、税法与征收效率计算；税后扣腐败、维稳、军饷与购粮。</small>
          </>
        }
      />
      <Stat
        label="粮"
        value={number(country?.food ?? 0)}
        tone={(country?.food ?? 0) < 500000 ? 'warn' : ''}
        tooltip={
          <>
            <b>粮储 {number(country?.food ?? 0)} 石</b>
            <span>本月购粮 {number(report?.foodPurchased ?? 0)} 石</span>
            <span>军队口粮 {number(report?.foodArmy ?? 0)} 石</span>
            <span>本月结余 <i className={foodBalance >= 0 ? 'good' : 'danger'}>{foodBalance >= 0 ? '+' : ''}{number(foodBalance)}</i> 石</span>
            <span>购粮支出 {number(report?.foodPurchaseSilver ?? 0)} 两</span>
            <span>训练日耗 {number(trainingFoodDay)} 石</span>
            <span>粮价系数 {content.balance.economy.grainPrice.toFixed(2)}</span>
            <span>控制省份 {provinceGroups} / {content.prefectures.size} · 地区 {provinces} / {content.provinces.size}</span>
            <small>军队规模越大，每月军饷和口粮越高；粮储过低会降低稳定。</small>
          </>
        }
      />
      <Stat
        label="人口"
        value={number(totalPopulation)}
        tooltip={
          <>
            <b>总人口 {Math.round(totalPopulation).toLocaleString()}</b>
            <span>核心人口 {Math.round(corePopulation).toLocaleString()}</span>
            <span>非核心人口 {Math.round(nonCorePopulation).toLocaleString()}</span>
            <span className="danger">不忠诚人口（民怨≥20） {Math.round(disloyalPopulation).toLocaleString()}（{totalPopulation > 0 ? (disloyalPopulation / totalPopulation * 100).toFixed(1) : '0.0'}%）</span>
            <span>不忠诚地区 {disloyalProvinces.length} / {controlledProvinces.length}</span>
            <small>人口与田地共同形成经济大盘；非核心与不忠诚人口提供的财政和兵源更低。</small>
          </>
        }
      />
      <Stat
        label="兵源"
        value={number(country?.manpower ?? 0)}
        tooltip={
          <>
            <b>可用兵源 {number(country?.manpower ?? 0)}</b>
            <span>军团 {armies.length} 支 · 总兵力 {number(armyStrength)}</span>
            <span>军心 {Math.round(country?.armyLoyalty ?? 0)}</span>
            <small>兵源按人口与稳定恢复；欠饷会先打击募兵，再打击家丁。</small>
          </>
        }
      />
      <Stat
        label="稳定"
        value={number(country?.stability ?? 0, 0)}
        tone={(country?.stability ?? 0) < 30 ? 'danger' : ''}
        tooltip={
          <>
            <b>稳定 {Math.round(country?.stability ?? 0)} / 100</b>
            <span>天命 {Math.round(country?.mandate ?? 0)} · 皇权 {Math.round(country?.authority ?? 0)}</span>
            <span>战争疲劳 {Math.round(country?.warExhaustion ?? 0)}</span>
            <span>稳定目标 {stabilityTarget.toFixed(0)}（各阶级忠诚加权）</span>
            {estateStability.map(estate => (
              <span key={estate.key} className="estate-stability-line">
                {estate.name} · 忠诚 {Math.round(estate.loyalty)} · 影响 {Math.round(estate.influence)} · 贡献 {(estate.loyalty * estate.weight / Math.max(1, stabilityWeight)).toFixed(1)}
              </span>
            ))}
            <small>稳定主要由各阶级忠诚按影响力加权驱动；税法、分配、缺粮与战争都会改变忠诚，进而改变稳定。稳定影响天命、税收与民怨。</small>
          </>
        }
      />
      <Stat
        label="天命"
        value={number(country?.mandate ?? 0, 0)}
        tone={(country?.mandate ?? 0) < 30 ? 'warn' : ''}
        tooltip={
          <>
            <b>天命 {Math.round(country?.mandate ?? 0)} / 100</b>
            <span>稳定 {Math.round(country?.stability ?? 0)} · 腐败 {Math.round(country?.corruption ?? 0)}</span>
            <small>天命随稳定缓慢变化；部分胜利条件要求高天命。</small>
          </>
        }
      />
      <Stat
        label="欠饷"
        value={`${arrearsMonths.toFixed(1)} 月`}
        tone={arrearsMonths > 3 ? 'danger' : ''}
        tooltip={
          <>
            <b>欠饷 {number(country?.arrears ?? 0)} 两</b>
            <span>每月军饷 {number(report?.expenseArmy ?? 0)} 两</span>
            <span>折合 {arrearsMonths.toFixed(1)} 个月</span>
            <small>欠饷超过 3 个月会快速降低军心与组织度，并可能触发兵变。</small>
          </>
        }
      />
      {pending > 0 && <span className="danger">待决事件 {pending}</span>}
      <span className="spacer" />
      <MusicControl />
      <button
        title={muted ? '打开音效' : '关闭音效'}
        onClick={() => {
          const next = sound.toggleMuted();
          setMuted(next);
          if (!next) sound.play('click');
        }}
      >
        {muted ? '♪̶' : '♪'}
      </button>
      <button onClick={() => save('manual')}>存档</button>
      <button onClick={() => load('manual')}>读档</button>
      <button onClick={reset}>退出</button>
    </header>
  );
}


