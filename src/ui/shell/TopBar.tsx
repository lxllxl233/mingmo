import { memo, useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatDate } from '../../engine/core/clock';
import { sound } from '../../app/audio/sound';
import { monthlyPoliticalGain } from '../../engine/systems/politics';
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
  /** 仅在悬浮/聚焦时求值，避免每个 tick 构造整套 tooltip 元素。 */
  tooltip: () => ReactNode;
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
      {open && <span className="stat-tooltip">{tooltip()}</span>}
    </span>
  );
}

function DateLabel() {
  const day = useGameStore(state => state.game?.day ?? 0);
  return <span className="date">{formatDate(day)}</span>;
}

/**
 * 顶栏高频数据一次性聚合为原始值，再用 useShallow 比较。
 * 秒级 tick 只改变日期；国库、人口等月度数据未变时这里不会重渲染。
 */
function TopBarStats() {
  const data = useGameStore(useShallow(state => {
    const game = state.game;
    if (!game) return null;
    const playerTag = game.playerTag;
    const country = game.countries[playerTag];
    const report = country?.lastReport;
    let controlledCount = 0;
    const controlledPrefectures = new Set<string>();
    let totalPopulation = 0;
    let corePopulation = 0;
    let disloyalPopulation = 0;
    let disloyalCount = 0;
    for (const province of Object.values(game.provinces)) {
      if (province.controller !== playerTag) continue;
      controlledCount += 1;
      const prefectureId = state.content.provinces.get(province.id)?.prefectureId;
      if (prefectureId) controlledPrefectures.add(prefectureId);
      totalPopulation += province.population;
      if (province.cores.includes(playerTag)) corePopulation += province.population;
      if (province.unrest >= 20) {
        disloyalCount += 1;
        disloyalPopulation += province.population;
      }
    }
    let armyCount = 0;
    let armyStrength = 0;
    for (const army of Object.values(game.armies)) {
      if (army.tag !== playerTag) continue;
      armyCount += 1;
      armyStrength += army.composition.infantry + army.composition.firearm + army.composition.cavalry
        + army.composition.artillery + army.composition.naval;
    }
    let trainingSilverDay = 0;
    let trainingFoodDay = 0;
    for (const entry of game.training) {
      if (entry.tag !== playerTag || entry.totalDays <= 0) continue;
      trainingSilverDay += entry.costSilver / entry.totalDays;
      trainingFoodDay += entry.costFood / entry.totalDays;
    }
    let pending = 0;
    for (const event of game.pendingEvents) if (event.country === playerTag) pending += 1;
    return {
      playerTag,
      treasury: country?.treasury ?? 0,
      food: country?.food ?? 0,
      manpower: country?.manpower ?? 0,
      politicalPower: country?.politicalPower ?? 0,
      stability: country?.stability ?? 0,
      mandate: country?.mandate ?? 0,
      authority: country?.authority ?? 0,
      armyLoyalty: country?.armyLoyalty ?? 0,
      warExhaustion: country?.warExhaustion ?? 0,
      corruption: country?.corruption ?? 0,
      arrears: country?.arrears ?? 0,
      wageArrears: country?.wageArrears ?? 0,
      income: report?.income ?? 0,
      taxIncome: report?.taxIncome ?? 0,
      tradePostIncome: report?.tradePostIncome ?? 0,
      sakokuIncome: report?.sakokuIncome ?? 0,
      expense: report?.expense ?? 0,
      net: report?.net ?? 0,
      expenseArmy: report?.expenseArmy ?? 0,
      expenseArmyPaid: report?.expenseArmyPaid ?? 0,
      wageShortfall: report?.wageShortfall ?? 0,
      expenseTraining: report?.expenseTraining ?? 0,
      expenseCourt: report?.expenseCourt ?? 0,
      hoardPressure: report?.hoardPressure ?? 0,
      foodPurchaseSilver: report?.foodPurchaseSilver ?? 0,
      corruptionLoss: report?.corruptionLoss ?? 0,
      loyaltyCost: report?.loyaltyCost ?? 0,
      foodPurchased: report?.foodPurchased ?? 0,
      foodArmy: report?.foodArmy ?? 0,
      controlledCount,
      controlledPrefectures: controlledPrefectures.size,
      totalPopulation,
      corePopulation,
      disloyalPopulation,
      disloyalCount,
      armyCount,
      armyStrength,
      trainingSilverDay,
      trainingFoodDay,
      pending,
    };
  }));
  const content = useGameStore(state => state.content);
  if (!data) return null;
  const countryDef = content.countries.get(data.playerTag);
  const nonCorePopulation = data.totalPopulation - data.corePopulation;
  const foodBalance = data.foodPurchased - data.foodArmy;
  const arrearsMonths = data.expenseArmy > 0 ? data.arrears / data.expenseArmy : 0;
  const politicalGain = monthlyPoliticalGain(data.authority, data.stability);

  return (
    <>
      <span className="stat" style={{ color: countryDef?.color }}>{countryDef?.name ?? data.playerTag}</span>
      <Stat
        label="银"
        value={number(data.treasury)}
        tone={data.treasury < 100000 ? 'warn' : ''}
        tooltip={() => (
          <>
            <b>国库 {number(data.treasury)} 两</b>
            <span>本月收入 {number(data.income)} 两（税 {number(data.taxIncome)} · 贸易站 {number(data.tradePostIncome)} · 锁国 {number(data.sakokuIncome)}）</span>
            <span>本月支出 {number(data.expense)} 两</span>
            <span>本月净额 <i className={data.net >= 0 ? 'good' : 'danger'}>{number(data.net)}</i> 两</span>
            <span>军饷 实付 {number(data.expenseArmyPaid)} / 应付 {number(data.expenseArmy)} · 购粮 {number(data.foodPurchaseSilver)}</span>
            {data.wageShortfall > 0 && <span className="danger">本月欠饷 {number(data.wageShortfall)} 两（只有军饷缺口形成债务）</span>}
            <span>腐败损耗 {number(data.corruptionLoss)} · 基层维稳 {number(data.loyaltyCost)} · 维持成本 {number(data.expenseCourt)}</span>
            <span>训练支出 {number(data.expenseTraining)} · 日耗 {number(data.trainingSilverDay)} 两</span>
            {data.hoardPressure > 0 && <span className="warn">囤银压力 {(data.hoardPressure * 100).toFixed(0)}%：腐败与通胀上升</span>}
            <span>债务 {number(data.arrears)} 两 · {arrearsMonths.toFixed(1)} 个月军饷</span>
            <small>结算顺序：税收 → 腐败/基层维稳 → 维持成本 → 军饷 → 购粮；购粮不足不形成债务。</small>
          </>
        )}
      />
      <Stat
        label="粮"
        value={number(data.food)}
        tone={data.food < 500000 ? 'warn' : ''}
        tooltip={() => (
          <>
            <b>粮储 {number(data.food)} 石</b>
            <span>本月购粮 {number(data.foodPurchased)} 石</span>
            <span>军队口粮 {number(data.foodArmy)} 石</span>
            <span>本月结余 <i className={foodBalance >= 0 ? 'good' : 'danger'}>{foodBalance >= 0 ? '+' : ''}{number(foodBalance)}</i> 石</span>
            <span>购粮支出 {number(data.foodPurchaseSilver)} 两</span>
            <span>训练日耗 {number(data.trainingFoodDay)} 石</span>
            <span>粮价系数 {content.balance.economy.grainPrice.toFixed(2)}</span>
            <span>控制省份 {data.controlledPrefectures} / {content.prefectures.size} · 地区 {data.controlledCount} / {content.provinces.size}</span>
            <small>军队规模越大，每月军饷和口粮越高；粮储过低会降低稳定。</small>
          </>
        )}
      />
      <Stat
        label="人口"
        value={number(data.totalPopulation)}
        tooltip={() => (
          <>
            <b>总人口 {Math.round(data.totalPopulation).toLocaleString()}</b>
            <span>核心人口 {Math.round(data.corePopulation).toLocaleString()}</span>
            <span>非核心人口 {Math.round(nonCorePopulation).toLocaleString()}</span>
            <span className="danger">不忠诚人口（民怨≥20） {Math.round(data.disloyalPopulation).toLocaleString()}（{data.totalPopulation > 0 ? (data.disloyalPopulation / data.totalPopulation * 100).toFixed(1) : '0.0'}%）</span>
            <span>不忠诚地区 {data.disloyalCount} / {data.controlledCount}</span>
            <small>人口与田地共同形成经济大盘；非核心与不忠诚人口提供的财政和兵源更低。</small>
          </>
        )}
      />
      <Stat
        label="兵源"
        value={number(data.manpower)}
        tooltip={() => (
          <>
            <b>可用兵源 {number(data.manpower)}</b>
            <span>军团 {data.armyCount} 支 · 总兵力 {number(data.armyStrength)}</span>
            <span>军心 {Math.round(data.armyLoyalty)}</span>
            <small>兵源按人口与稳定恢复；拖欠军饷会先打击募兵，再打击家丁。</small>
          </>
        )}
      />
      <Stat
        label="政治"
        value={number(data.politicalPower, 0)}
        tone={data.politicalPower < 10 ? 'warn' : ''}
        tooltip={() => (
          <>
            <b>政治点 {Math.round(data.politicalPower)} / 200</b>
            <span>每月恢复 +{politicalGain.toFixed(2)}</span>
            <span>基础 +1.00</span>
            <span>皇权 +{(data.authority / 100).toFixed(2)}</span>
            <span>稳定 +{(data.stability / 200).toFixed(2)}</span>
            <small>国策、事件与改革可一次性获得政治点；决议消耗 10，税制改革消耗 50；上限 200。</small>
          </>
        )}
      />
      <Stat
        label="稳定"
        value={number(data.stability, 0)}
        tone={data.stability < 30 ? 'danger' : ''}
        tooltip={() => {
          const state = useGameStore.getState();
          const country = state.game?.countries[data.playerTag];
          const contentNow = state.content;
          const estates = country
            ? Object.values(country.estates).map(estate => {
              const config = contentNow.countryEstates.get(country.tag)?.find(entry => entry.key === estate.key);
              return {
                key: estate.key,
                name: config?.name ?? contentNow.estateDefs.get(estate.key)?.name ?? estate.key,
                loyalty: estate.loyalty,
                influence: estate.influence,
                weight: Math.max(1, estate.influence),
              };
            }).sort((a, b) => b.loyalty * b.weight - a.loyalty * a.weight)
            : [];
          const weight = estates.reduce((sum, estate) => sum + estate.weight, 0);
          const target = weight > 0
            ? estates.reduce((sum, estate) => sum + estate.loyalty * estate.weight, 0) / weight
            : 0;
          return (
            <>
              <b>稳定 {Math.round(data.stability)} / 100</b>
              <span>天命 {Math.round(data.mandate)} · 皇权 {Math.round(data.authority)}</span>
              <span>战争疲劳 {Math.round(data.warExhaustion)}</span>
              <span>稳定目标 {target.toFixed(0)}（各阶级忠诚加权）</span>
              {estates.map(estate => (
                <span key={estate.key} className="estate-stability-line">
                  {estate.name} · 忠诚 {Math.round(estate.loyalty)} · 影响 {Math.round(estate.influence)} · 贡献 {(estate.loyalty * estate.weight / Math.max(1, weight)).toFixed(1)}
                </span>
              ))}
              <small>稳定主要由各阶级忠诚按影响力加权驱动；税法、分配、缺粮与战争都会改变忠诚，进而改变稳定。稳定影响天命、税收与民怨。</small>
            </>
          );
        }}
      />
      <Stat
        label="天命"
        value={number(data.mandate, 0)}
        tone={data.mandate < 30 ? 'warn' : ''}
        tooltip={() => (
          <>
            <b>天命 {Math.round(data.mandate)} / 100</b>
            <span>稳定 {Math.round(data.stability)} · 腐败 {Math.round(data.corruption)}</span>
            <small>天命随稳定缓慢变化；部分胜利条件要求高天命。</small>
          </>
        )}
      />
      <Stat
        label="债务"
        value={number(data.arrears)}
        tone={arrearsMonths > 3 ? 'danger' : ''}
        tooltip={() => (
          <>
            <b>债务 {number(data.arrears)} 两</b>
            {data.wageArrears > 0 && <span className="danger">其中欠饷 {number(data.wageArrears)} 两</span>}
            <span>每月军饷 {number(data.expenseArmy)} 两</span>
            <span>折合 {arrearsMonths.toFixed(1)} 个月军饷</span>
            <small>欠饷持续会重创军队战斗力并禁止募新兵；其他债务最多削弱 10% 战力。</small>
          </>
        )}
      />
      {data.pending > 0 && <span className="danger">待决事件 {data.pending}</span>}
    </>
  );
}

/** 全屏游玩：浏览器支持 Fullscreen API 时可用，失败时静默保持窗口模式。 */
function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    setSupported(Boolean(document.fullscreenEnabled));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };
  return (
    <button
      title={supported ? (fullscreen ? '退出全屏' : '全屏游玩') : '当前浏览器不支持全屏'}
      disabled={!supported}
      onClick={toggle}
    >
      {fullscreen ? '退出全屏' : '全屏'}
    </button>
  );
}

export const TopBar = memo(function TopBar() {
  const save = useGameStore(state => state.save);
  const load = useGameStore(state => state.load);
  const setMenuOpen = useGameStore(state => state.setMenuOpen);
  const [muted, setMuted] = useState(sound.isMuted);
  return (
    <header className="topbar">
      <DateLabel />
      <TopBarStats />
      <span className="spacer" />
      <MusicControl />
      <FullscreenButton />
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
      <button onClick={() => { if (window.confirm('读取手动存档会覆盖当前进度，继续？')) load('manual'); }}>读档</button>
      <button onClick={() => setMenuOpen(true)}>菜单</button>
    </header>
  );
});
