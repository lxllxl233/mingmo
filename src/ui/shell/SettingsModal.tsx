import { useGameStore } from '../state/store';

export function SettingsModal() {
  const open = useGameStore(state => state.settingsOpen);
  const settings = useGameStore(state => state.settings);
  const update = useGameStore(state => state.updateSettings);
  const setOpen = useGameStore(state => state.setSettingsOpen);
  if (!open) return null;
  return (
    <div className="overlay settings-overlay">
      <div className="menu-card settings-card" role="dialog" aria-modal="true" aria-label="设置">
        <h2>设置</h2>
        <p className="muted">设置保存在本机；不会上传。</p>
        <label className="setting-row">
          <span>音乐音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={event => update({ musicVolume: Number(event.target.value) })}
          />
          <b>{Math.round(settings.musicVolume * 100)}%</b>
        </label>
        <label className="setting-row">
          <span>静音</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={event => update({ muted: event.target.checked })}
          />
          <b>{settings.muted ? '开' : '关'}</b>
        </label>
        <label className="setting-row">
          <span>减少动效</span>
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={event => update({ reduceMotion: event.target.checked })}
          />
          <b>{settings.reduceMotion ? '开' : '关'}</b>
        </label>
        <div className="setting-row">
          <span>新手引导</span>
          <button onClick={() => update({ tutorialSeen: false })}>重新播放</button>
          <b>{settings.tutorialSeen ? '已看过' : '未看'}</b>
        </div>
        <div className="menu-actions">
          <button className="primary" onClick={() => setOpen(false)}>关闭</button>
        </div>
      </div>
    </div>
  );
}
