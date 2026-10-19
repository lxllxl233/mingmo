import { useGameStore } from '../state/store';

export function PauseMenu() {
  const menuOpen = useGameStore(state => state.menuOpen);
  const setMenuOpen = useGameStore(state => state.setMenuOpen);
  const setSettingsOpen = useGameStore(state => state.setSettingsOpen);
  const setHelpOpen = useGameStore(state => state.setHelpOpen);
  const save = useGameStore(state => state.save);
  const load = useGameStore(state => state.load);
  const reset = useGameStore(state => state.reset);
  const game = useGameStore(state => state.game);
  if (!menuOpen || !game) return null;

  return (
    <div className="overlay pause-overlay">
      <div className="menu-card" role="dialog" aria-modal="true" aria-label="暂停菜单">
        <p className="eyebrow">PAUSED</p>
        <h2>暂停</h2>
        <p className="muted">时间已停止。你可以存档、调整设置，或回到主菜单。</p>
        <div className="menu-actions">
          <button className="primary" onClick={() => setMenuOpen(false)}>继续（Esc）</button>
          <button onClick={() => save('manual')}>存档</button>
          <button
            onClick={() => {
              if (window.confirm('读取手动存档会覆盖当前进度，继续？')) load('manual');
            }}
          >
            读档
          </button>
          <button onClick={() => setSettingsOpen(true)}>设置</button>
          <button onClick={() => setHelpOpen(true)}>帮助（F1）</button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm('返回主菜单会丢失未保存的进度，继续？')) reset();
            }}
          >
            返回主菜单
          </button>
        </div>
        <p className="muted menu-foot">空格：暂停 / 继续 · Esc：关闭菜单 · F1：帮助</p>
      </div>
    </div>
  );
}
