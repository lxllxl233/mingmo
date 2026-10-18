import { useEffect } from 'react';
import { formatDate } from '../../engine/core/clock';
import { useGameStore } from '../state/store';
import { MapViewport } from './MapViewport';
import { MusicControl } from './MusicControl';
import { CountryFlag } from '../panels/CountryFlag';
import { BattleModal } from '../panels/BattleModal';

export function SpectatorShell() {
  const game = useGameStore(state => state.game);
  const speed = useGameStore(state => state.speed);
  const setSpeed = useGameStore(state => state.setSpeed);
  const tick = useGameStore(state => state.tick);
  const reset = useGameStore(state => state.reset);
  const content = useGameStore(state => state.content);
  const message = useGameStore(state => state.message);

  useEffect(() => {
    if (speed === 0) return;
    const interval = speed === 1 ? 3000 : speed === 2 ? 1500 : 750;
    const handle = window.setInterval(() => tick(), interval);
    return () => window.clearInterval(handle);
  }, [speed, tick]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button')) return;
      event.preventDefault();
      setSpeed(speed === 0 ? 1 : 0);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [speed, setSpeed]);

  if (!game) return null;
  const alive = Object.values(game.countries).filter(country => country.alive);
  const recent = [...game.log].slice(-14).reverse();
  return (
    <div className="game spectator">
      <header className="spectator-top">
        <div>
          <b>明末 华夏震荡</b>
          <span className="spectator-badge">看海模式 · 全图视野</span>
        </div>
        <span>{formatDate(game.day)}</span>
        <span className="muted">{alive.length} 方存活 · {game.wars.length} 场战争</span>
        <span className="spacer" />
        <div className="spectator-flags">
          {alive.map(country => {
            const def = content.countries.get(country.tag);
            return def ? <CountryFlag key={country.tag} country={def} width={22} /> : null;
          })}
        </div>
        <MusicControl />
        <button onClick={reset}>退出</button>
      </header>
      <div className="spectator-main">
        <MapViewport />
        <aside className="spectator-log">
          <h3>世界观察</h3>
          {message && <p className="spectator-message">{message}</p>}
          {recent.map((entry, index) => (
            <div className="spectator-log-row" key={`${entry.day}-${index}`}>
              <small>{formatDate(entry.day)}</small>
              <span className={entry.severity === 'danger' ? 'danger' : entry.severity === 'warning' ? 'warn' : ''}>
                {entry.text}
              </span>
            </div>
          ))}
        </aside>
      </div>
      <footer className="spectator-bottom">
        <div className="speed">
          {([0, 1, 2, 4] as const).map(value => (
            <button
              key={value}
              title={value === 0 ? '暂停（空格）' : value === 1 ? '8 小时 / 秒' : value === 2 ? '16 小时 / 秒' : '32 小时 / 秒'}
              className={speed === value ? 'active' : ''}
              onClick={() => setSpeed(value)}
            >
              {value === 0 ? '暂停' : `${value}x`}
            </button>
          ))}
        </div>
        <span className="muted">不控制任何势力；所有国家由 AI 行动。</span>
        {game.ended && <span className="danger">推演结束：{game.victory?.reason ?? '结束'}</span>}
        <span className="spacer" />
        <span className="muted">日 {game.day}</span>
      </footer>
      <BattleModal />
    </div>
  );
}
