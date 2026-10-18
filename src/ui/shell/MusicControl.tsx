import { useEffect, useState } from 'react';
import { sound, type MusicState } from '../../app/audio/sound';

export function MusicControl() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<MusicState>(() => sound.getMusicState());

  useEffect(() => {
    const timer = window.setInterval(() => setState(sound.getMusicState()), 1200);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = () => setState(sound.getMusicState());

  return (
    <div className="music-control">
      <button title="音乐播放列表" onClick={() => { setOpen(value => !value); refresh(); }}>♫</button>
      {open && (
        <div className="music-popover">
          <div className="music-head">
            <b>音乐</b>
            <span>{state.playing ? '播放中' : '已停止'}</span>
          </div>
          <div className="music-tracks">
            {state.tracks.map((track, index) => (
              <button
                key={track.id}
                className={index === state.index ? 'active' : ''}
                onClick={() => { sound.selectMusic(index); refresh(); }}
              >
                {index + 1}. {track.name}
              </button>
            ))}
            {state.tracks.length === 0 && <span className="muted">暂无播放列表</span>}
          </div>
          <div className="music-modes">
            <button className={state.loop === 'list' ? 'active' : ''} onClick={() => { sound.setMusicLoop('list'); refresh(); }}>列表循环</button>
            <button className={state.loop === 'single' ? 'active' : ''} onClick={() => { sound.setMusicLoop('single'); refresh(); }}>单曲循环</button>
            <button className={state.loop === 'off' ? 'active' : ''} onClick={() => { sound.setMusicLoop('off'); refresh(); }}>关闭音乐</button>
          </div>
          <label className="music-volume">
            <span>音量</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.volume}
              onChange={event => { sound.setMusicVolume(Number(event.target.value)); refresh(); }}
            />
            <b>{Math.round(state.volume * 100)}%</b>
          </label>
        </div>
      )}
    </div>
  );
}
