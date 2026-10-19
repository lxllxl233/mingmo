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
import { CourtPanel } from '../panels/CourtPanel';
import { BannerPanel } from '../panels/BannerPanel';
import { ShunPanel } from '../panels/ShunPanel';
import { LegitimacyPanel } from '../panels/LegitimacyPanel';
import { TradePanel } from '../panels/TradePanel';
import { LogPanel } from '../panels/LogPanel';
import { EventModal } from '../overlays/EventModal';
import { WarAlertModal } from '../overlays/WarAlertModal';
import { EndModal } from '../overlays/EndModal';
import { TrainingModal } from '../overlays/TrainingModal';
import { SpectatorShell } from './SpectatorShell';
import { SidebarIcon } from './SidebarIcon';
import { PauseMenu } from './PauseMenu';
import { SettingsModal } from './SettingsModal';
import { HelpOverlay } from './HelpOverlay';
import { OnboardingOverlay } from './OnboardingOverlay';

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
  const settings = useGameStore(state => state.settings);
  const menuOpen = useGameStore(state => state.menuOpen);
  const settingsOpen = useGameStore(state => state.settingsOpen);
  const helpOpen = useGameStore(state => state.helpOpen);
  const setMenuOpen = useGameStore(state => state.setMenuOpen);
  const setHelpOpen = useGameStore(state => state.setHelpOpen);
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
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const state = useGameStore.getState();
      const overlayOpen = state.menuOpen || state.settingsOpen || state.helpOpen;
      if (!state.settings.tutorialSeen) return;
      if (overlayOpen && event.code !== 'Escape' && event.code !== 'F1') return;
      if (event.code === 'Escape') {
        if (state.settingsOpen) state.setSettingsOpen(false);
        else if (state.helpOpen) state.setHelpOpen(false);
        else if (state.menuOpen) state.setMenuOpen(false);
        else if (state.panel) state.closePanel();
        else state.setMenuOpen(true);
        return;
      }
      if (event.code === 'F1') {
        event.preventDefault();
        state.setHelpOpen(!state.helpOpen);
        return;
      }
      const speedKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'];
      const speedIndex = speedKeys.indexOf(event.code);
      if (speedIndex >= 0) {
        event.preventDefault();
        const speeds = [0, 1, 2, 4, 8, 16, 32] as const;
        state.setSpeed(speeds[speedIndex] ?? 1);
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        state.setSpeed(state.speed === 0 ? (state.speedBeforeEvent || 1) : 0);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [game, game?.spectator]);

  useEffect(() => {
    if (!game || game.spectator) return;
    const onVisibility = () => {
      if (document.hidden) {
        const state = useGameStore.getState();
        if (state.speed !== 0) state.setMenuOpen(true);
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = useGameStore.getState().game;
      if (current && !current.ended) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [game?.ended, game?.spectator]);

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
  const sidebar = [
    ...SIDEBAR,
    ...(game.playerTag === 'MING' ? [{ key: 'court' as PanelKey, label: '朝议' }] : []),
    ...(game.playerTag === 'QING' ? [{ key: 'banner' as PanelKey, label: '八旗' }] : []),
    ...(game.playerTag === 'SHUN' ? [{ key: 'confiscation' as PanelKey, label: '追赃' }] : []),
    ...(game.playerTag === 'SMING' ? [{ key: 'legitimacy' as PanelKey, label: '正统' }] : []),
    ...(game.playerTag === 'ZHENG' ? [{ key: 'trade' as PanelKey, label: '海贸' }] : []),
  ];

  return (
    <div
      className="game"
      onPointerDown={event => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button')) sound.play('click');
        if (event.button === 0 && !target?.closest('.right-panel, .overlay, .menu-card')) {
          useGameStore.getState().clearArmySelection();
        }
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
          {sidebar.map(entry => (
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
          {panel === 'court' && <CourtPanel />}
          {panel === 'banner' && <BannerPanel />}
          {panel === 'confiscation' && <ShunPanel />}
          {panel === 'legitimacy' && <LegitimacyPanel />}
          {panel === 'trade' && <TradePanel />}
          {panel === 'log' && <LogPanel />}
          {panel === null && (
            <div className="panel objective-panel">
              <p className="eyebrow">开局清单</p>
              <h2>{country ? content.countries.get(country.tag)?.name : '—'}</h2>
              <p className="objective-goal">{playerDef?.goal ?? '先活下来，再谈天下。'}</p>
              <div className="objective-stats">
                <span>银 <b>{Math.round(country?.treasury ?? 0).toLocaleString()}</b></span>
                <span>粮 <b>{Math.round(country?.food ?? 0).toLocaleString()}</b></span>
                <span>欠饷 <b>{Math.round(country?.arrears ?? 0).toLocaleString()}</b></span>
                <span>稳定 <b>{Math.round(country?.stability ?? 0)}</b></span>
              </div>
              <ol className="objective-list">
                <li>
                  <button onClick={() => openPanel('estates')}>检查分配与税法</button>
                  <span>先看钱从哪里来、向谁开刀。</span>
                </li>
                <li>
                  <button onClick={() => openPanel('focus')}>选择第一条国策</button>
                  <span>优先解决财政、边防或民变。</span>
                </li>
                <li>
                  <button onClick={() => openPanel('military')}>检视军团与战争</button>
                  <span>确认前线、欠饷与补给。</span>
                </li>
              </ol>
              <button className="primary objective-start" onClick={() => setSpeed(1)}>开始推进（空格）</button>
              <button className="ghost objective-help" onClick={() => setHelpOpen(true)}>打开帮助（F1）</button>
              <p className="muted">事件会暂停时间；选项会显示代价。Esc 打开暂停菜单。</p>
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
        <button className="ghost" onClick={() => setMenuOpen(true)}>菜单（Esc）</button>
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
      {pending.length === 0 && <WarAlertModal />}
      {pending.length === 0 && <BattleModal />}
      {pending.length === 0 && <PeaceModal />}
      {pending.length === 0 && <TrainingModal />}
      {game.ended && <EndModal />}
      {message && <div className="toast">{message}</div>}
      {menuOpen && <PauseMenu />}
      {settingsOpen && <SettingsModal />}
      {helpOpen && <HelpOverlay />}
      {!settings.tutorialSeen && pending.length === 0 && !game.ended && !menuOpen && !settingsOpen && !helpOpen && (
        <OnboardingOverlay />
      )}
    </div>
  );
}





