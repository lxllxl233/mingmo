import { useGameStore } from '../state/store';
import { ArmyTypeIcon } from '../panels/ArmyTypeIcon';
import { formatNumber } from '../format';

export function ArmyStackPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const stack = useGameStore(state => state.armyStack);
  const selectArmy = useGameStore(state => state.selectArmy);
  const close = useGameStore(state => state.closeArmyStack);
  if (!game || !stack || stack.length === 0) return null;
  const armies = stack
    .map(id => game.armies[id])
    .filter((army): army is NonNullable<typeof army> => army !== undefined);
  if (armies.length === 0) return null;
  const province = content.provinces.get(armies[0]?.province ?? '');
  return (
    <div className="army-stack-overlay" onClick={close}>
      <div className="army-stack-popover" onClick={event => event.stopPropagation()}>
        <div className="army-stack-head">
          <b>{province?.name ?? '此处'} · {armies.length} 支军队</b>
          <button onClick={close}>关闭</button>
        </div>
        <p className="muted">点击一支军队进入详情；地图上同地多军不再循环切换。</p>
        {armies.map(army => {
          const strength = army.composition.infantry + army.composition.firearm
            + army.composition.cavalry + army.composition.artillery + army.composition.naval;
          const general = army.general ? content.generals.get(army.general)?.name : null;
          return (
            <button
              key={army.id}
              className="army-stack-row"
              onClick={() => { selectArmy(army.id); close(); }}
            >
              <ArmyTypeIcon composition={army.composition} size={30} />
              <span className="army-stack-name">
                <b>{army.name}</b>
                <small>{general ?? '无将领'} · {formatNumber(strength)} 人 · 组织 {army.organization.toFixed(0)}</small>
              </span>
              <span className="army-stack-stance">{army.stance === 'move' ? '行军' : army.stance === 'battle' ? '交战' : army.stance === 'siege' ? '围城' : '驻扎'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
