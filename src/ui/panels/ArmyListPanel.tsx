import { useGameStore } from '../state/store';
import { ArmyTypeIcon } from './ArmyTypeIcon';
import { formatNumber } from '../format';

export function ArmyListPanel() {
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
  const firstProvince = content.provinces.get(armies[0]?.province ?? '');
  const sameProvince = armies.every(army => army.province === armies[0]?.province);
  return (
    <div className="panel army-list-panel">
      <header className="panel-head">
        <div>
          <h2>{sameProvince ? firstProvince?.name ?? '此处' : '框选军团'}</h2>
          <p className="muted">{armies.length} 支军团 · 点击选择单支军队</p>
        </div>
        <button onClick={close}>关闭</button>
      </header>
      <div className="army-list">
        {armies.map(army => {
          const strength = army.composition.infantry + army.composition.firearm
            + army.composition.cavalry + army.composition.artillery + army.composition.naval;
          const general = army.general ? content.generals.get(army.general)?.name : null;
          const province = content.provinces.get(army.province)?.name ?? army.province;
          return (
            <button
              key={army.id}
              className="army-stack-row"
              onClick={() => selectArmy(army.id)}
            >
              <ArmyTypeIcon composition={army.composition} size={30} />
              <span className="army-stack-name">
                <b>{army.name}</b>
                <small>{sameProvince ? '' : `${province} · `}{general ?? '无将领'} · {formatNumber(strength)} 人 · 组织 {army.organization.toFixed(0)}</small>
              </span>
              <span className="army-stack-stance">{army.stance === 'move' ? '行军' : army.stance === 'battle' ? '交战' : army.stance === 'siege' ? '围城' : '驻扎'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
