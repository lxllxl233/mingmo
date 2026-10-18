import { useEffect, useRef } from 'react';
import { formatDate } from '../../engine/core/clock';
import { sound } from '../../app/audio/sound';
import { useGameStore, type PanelKey } from '../state/store';
import { TopBar } from './TopBar';
import { MapViewport } from './MapViewport';
import { CountryFlag } from '../panels/CountryFlag';
import { LeaderPortrait } from '../panels/LeaderPortrait';
import { ProvincePanel } from '../panels/ProvincePanel';
import { CountryPanel } from '../panels/CountryPanel';
import { ArmyPanel } from '../panels/ArmyPanel';
import { EstatesPanel } from '../panels/EstatesPanel';
import { BudgetPanel } from '../panels/BudgetPanel';
import { FocusPanel } from '../panels/FocusPanel';
import { ResearchPanel } from '../panels/ResearchPanel';
import { MilitaryPanel } from '../panels/MilitaryPanel';
import { DiplomacyPanel } from '../panels/DiplomacyPanel';
import { DecisionPanel } from '../panels/DecisionPanel';
import { LogPanel } from '../panels/LogPanel';
import { EventModal } from '../overlays/EventModal';
import { EndModal } from '../overlays/EndModal';
import { TrainingModal } from '../overlays/TrainingModal';

const SIDEBAR: Array<{ key: PanelKey; label: string }> = [
  { key: 'focus', label: '国策' },
  { key: 'research', label: '科研' },
  { key: 'estates', label: '阶级' },
  { key: 'budget', label: '财政' },
  { key: 'military', label: '军事' },
  { key: 'diplomacy', label: '外交' },
  { key: 'decisions', label: '决议' },
  { key: 'log', label: '日志' },
];

export function GameShell() {
  const game = useGameStore(state => state.game);
  const speed = useGameStore(state => state.speed);
  const setSpeed = useGameStore(state => state.setSpeed);
  const panel = useGameStore(state => state.panel);
  const openPanel = useGameStore(state => state.openPanel);
  const closePanel = useGameStore(state => state.closePanel);
  const openCountry = useGameStore(state => state.openCountry);
  const tick = useGameStore(state => state.tick);
  const message = useGameStore(state => state.message);
  const dismissMessage = useGameStore(state => state.dismissMessage);
  const selectedProvince = useGameStore(state => state.selectedProvince);
  const content = useGameStore(state => state.content);
  const battleCount = useRef(0);

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const total = game?.stats.battles ?? 0;
    if (total > battleCount.current) sound.play('battle');
    battleCount.current = total;
  }, [game?.stats.battles]);

  useEffect(() => {
    if (speed === 0) return;
    const interval = speed === 1 ? 250 : speed === 2 ? 125 : 63;
    const handle = window.setInterval(() => tick(), interval);
    return () => window.clearInterval(handle);
  }, [speed, tick]);

  useEffect(() => {
    if (!message) return;
    const handle = window.setTimeout(() => dismissMessage(), 3200);
    return () => window.clearTimeout(handle);
  }, [message, dismissMessage]);

  if (!game) return null;
  const country = game.countries[game.playerTag];
  const activeFocus = country?.focus ? content.focuses.get(country.focus.id) : null;
  const playerDef = content.countries.get(game.playerTag);
  const playerLeader = playerDef?.leadersByScenario?.[game.scenarioId] ?? playerDef?.leader;
  const pending = game.pendingEvents.filter(event => event.country === game.playerTag);

  return (
    <div
      className="game"
      onPointerDown={event => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button')) sound.play('click');
      }}
    >
      <TopBar />
      <div className="game-main">
        <nav className="sidebar">
          {playerDef && (
            <button className="sidebar-country" onClick={() => openCountry(game.playerTag)} title="查看本国详情">
              <CountryFlag country={playerDef} width={44} />
              <span className="sidebar-country-name">{playerDef.name}</span>
              {playerLeader && <span className="sidebar-leader"><LeaderPortrait leader={playerLeader} size={34} /></span>}
            </button>
          )}
          {SIDEBAR.map(entry => (
            <button
              key={entry.key}
              className={panel === entry.key ? 'active' : ''}
              onClick={() => (panel === entry.key ? closePanel() : openPanel(entry.key))}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <MapViewport />
        <aside className="right-panel">
          {panel === 'province' && <ProvincePanel />}
          {panel === 'country' && <CountryPanel />}
          {panel === 'army' && <ArmyPanel />}
          {panel === 'estates' && <EstatesPanel />}
          {panel === 'budget' && <BudgetPanel />}
          {panel === 'military' && <MilitaryPanel />}
          {panel === 'diplomacy' && <DiplomacyPanel />}
          {panel === 'decisions' && <DecisionPanel />}
          {panel === 'log' && <LogPanel />}
          {panel === null && (
            <div className="panel">
              <h2>{country ? content.countries.get(country.tag)?.name : '—'}</h2>
              <p className="muted">
                点击地区查看详情。左侧打开国策、科研、阶级、财政、军事、外交与决议。
              </p>
              <div className="row"><span>国库</span><b>{Math.round(country?.treasury ?? 0).toLocaleString()} 两</b></div>
              <div className="row"><span>粮储</span><b>{Math.round(country?.food ?? 0).toLocaleString()} 石</b></div>
              <div className="row"><span>稳定 / 天命</span><b>{Math.round(country?.stability ?? 0)} / {Math.round(country?.mandate ?? 0)}</b></div>
              <div className="row"><span>腐败 / 皇权</span><b>{Math.round(country?.corruption ?? 0)} / {Math.round(country?.authority ?? 0)}</b></div>
              <div className="row"><span>军心</span><b>{Math.round(country?.armyLoyalty ?? 0)}</b></div>
              <div className="row"><span>欠饷</span><b>{Math.round(country?.arrears ?? 0).toLocaleString()} 两</b></div>
            </div>
          )}
        </aside>
      </div>
      <footer className="bottombar">
        <div className="speed">
          {([0, 1, 2, 4] as const).map(value => (
            <button key={value} className={speed === value ? 'active' : ''} onClick={() => setSpeed(value)}>
              {value === 0 ? '暂停' : `${value}x`}
            </button>
          ))}
        </div>
        <span>{formatDate(game.day)}</span>
        {activeFocus && (
          <span className="muted">
            国策：{activeFocus.name} {Math.floor(country?.focus?.progress ?? 0)}/{activeFocus.costDays} 日
          </span>
        )}
        {selectedProvince && <span className="muted">已选：{content.provinces.get(selectedProvince)?.name}</span>}
        <span className="spacer" />
        {message && <span className="message">{message}</span>}
        <span className="muted">事件 {pending.length} · 军队 {Object.values(game.armies).filter(army => army.tag === game.playerTag).length}</span>
      </footer>
      {(panel === 'focus' || panel === 'research') && (
        <div className="focus-overlay">
          <div className="focus-head">
            <b>{panel === 'focus' ? '国策树' : '科技树'}</b>
            <span className="muted">{country ? content.countries.get(country.tag)?.name : ''}</span>
            <span className="spacer" />
            <button onClick={closePanel}>关闭</button>
          </div>
          <div className="focus-scroll">
            {panel === 'focus' ? <FocusPanel /> : <ResearchPanel />}
          </div>
        </div>
      )}
      {pending.length > 0 && <EventModal />}
      <TrainingModal />
      {game.ended && <EndModal />}
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

