import { useEffect, useRef } from 'react';
import { formatDate } from '../../engine/core/clock';
import { sound } from '../../app/audio/sound';
import { musicForFaction } from '../../app/audio/music';
import { useGameStore, type PanelKey } from '../state/store';
import { TopBar } from './TopBar';
import { MapViewport } from './MapViewport';
import { CountryFlag } from '../panels/CountryFlag';
import { LeaderPortrait } from '../panels/LeaderPortrait';
import { WarDock } from '../panels/WarDock';
import { ProvincePanel } from '../panels/ProvincePanel';
import { CountryPanel } from '../panels/CountryPanel';
import { ArmyPanel } from '../panels/ArmyPanel';
import { BattleModal } from '../panels/BattleModal';
import { PeaceModal } from '../panels/PeaceModal';
import { ArmyListPanel } from '../panels/ArmyListPanel';
import { EstatesPanel } from '../panels/EstatesPanel';
import { CorePanel } from '../panels/CorePanel';
import { FocusPanel } from '../panels/FocusPanel';
import { ResearchPanel } from '../panels/ResearchPanel';
import { MilitaryPanel } from '../panels/MilitaryPanel';
import { DiplomacyPanel } from '../panels/DiplomacyPanel';
import { DecisionPanel } from '../panels/DecisionPanel';
import { LogPanel } from '../panels/LogPanel';
import { EventModal } from '../overlays/EventModal';
import { WarAlertModal } from '../overlays/WarAlertModal';
import { EndModal } from '../overlays/EndModal';
import { TrainingModal } from '../overlays/TrainingModal';
import { SpectatorShell } from './SpectatorShell';
import { SidebarIcon } from './SidebarIcon';

const SIDEBAR: Array<{ key: PanelKey; label: string }> = [
  { key: 'focus', label: '国策' },
  { key: 'core', label: '核心' },
  { key: 'research', label: '科研' },
  { key: 'estates', label: '分配' },
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
    if (!game) return;
    sound.setMusicPlaylist(musicForFaction(game.playerTag, game.scenarioId));
  }, [game?.playerTag, game?.scenarioId]);

  useEffect(() => {
    const total = game?.stats.battles ?? 0;
    if (total > battleCount.current) sound.play('battle');
    battleCount.current = total;
  }, [game?.stats.battles]);

  useEffect(() => {
    if (!game || game.spectator || speed === 0) return;
    const interval = speed === 1 ? 3000 : speed === 2 ? 1500 : speed === 4 ? 750 : speed === 8 ? 375 : speed === 16 ? 188 : 94;
    const handle = window.setInterval(() => tick(), interval);
    return () => window.clearInterval(handle);
  }, [speed, tick, game?.spectator]);

  useEffect(() => {
    if (!game || game.spectator) return;
    const handle = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button')) return;
      event.preventDefault();
      setSpeed(speed === 0 ? 1 : 0);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [speed, setSpeed, game?.spectator]);

  useEffect(() => {
    if (!message) return;
    const handle = window.setTimeout(() => dismissMessage(), 3200);
    return () => window.clearTimeout(handle);
  }, [message, dismissMessage]);

  if (!game) return null;
  if (game.spectator) return <SpectatorShell />;
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
              <SidebarIcon kind={entry.key} />
              {entry.label}
            </button>
          ))}
        </nav>
        <MapViewport />
        <aside className="right-panel">
          <WarDock />
          {panel === 'province' && <ProvincePanel />}
          {panel === 'country' && <CountryPanel />}
          {panel === 'army' && <ArmyPanel />}
          {panel === 'armyList' && <ArmyListPanel />}
          {panel === 'estates' && <EstatesPanel />}
          {panel === 'core' && <CorePanel />}
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
          {([0, 1, 2, 4, 8, 16, 32] as const).map(value => (
            <button
              key={value}
              title={value === 0 ? '暂停（空格）' : value === 1 ? '8 小时 / 秒' : value === 2 ? '16 小时 / 秒' : value === 4 ? '32 小时 / 秒' : value === 8 ? '64 小时 / 秒' : value === 16 ? '128 小时 / 秒' : '256 小时 / 秒'}
              className={speed === value ? 'active' : ''}
              onClick={() => setSpeed(value)}
            >
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
      <WarAlertModal />
      <BattleModal />
      <PeaceModal />
      <TrainingModal />
      {game.ended && <EndModal />}
      {message && <div className="toast">{message}</div>}
    </div>
  );
}




