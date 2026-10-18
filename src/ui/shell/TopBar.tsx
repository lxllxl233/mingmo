import { useState } from 'react';
import { formatDate } from '../../engine/core/clock';
import { sound } from '../../app/audio/sound';
import { useGameStore } from '../state/store';

function number(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toFixed(digits);
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
  const arrearsMonths = country && country.lastReport && country.lastReport.expenseArmy > 0
    ? country.arrears / country.lastReport.expenseArmy
    : 0;
  const pending = game.pendingEvents.filter(event => event.country === game.playerTag).length;

  return (
    <header className="topbar">
      <span className="date">{formatDate(game.day)}</span>
      <span className="stat" style={{ color: countryDef?.color }}>{countryDef?.name ?? game.playerTag}</span>
      <span className={`stat${(country?.treasury ?? 0) < 100000 ? ' warn' : ''}`}>银 <b>{number(country?.treasury ?? 0)}</b></span>
      <span className={`stat${(country?.food ?? 0) < 500000 ? ' warn' : ''}`}>粮 <b>{number(country?.food ?? 0)}</b></span>
      <span className="stat">兵源 <b>{number(country?.manpower ?? 0)}</b></span>
      <span className={`stat${(country?.stability ?? 0) < 30 ? ' danger' : ''}`}>稳定 <b>{number(country?.stability ?? 0, 0)}</b></span>
      <span className={`stat${(country?.mandate ?? 0) < 30 ? ' warn' : ''}`}>天命 <b>{number(country?.mandate ?? 0, 0)}</b></span>
      <span className={`stat${arrearsMonths > 3 ? ' danger' : ''}`}>欠饷 <b>{arrearsMonths.toFixed(1)}</b> 月</span>
      {pending > 0 && <span className="danger">待决事件 {pending}</span>}
      <span className="spacer" />
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
