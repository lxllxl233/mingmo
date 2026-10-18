import type { ArmyTemplate } from '../../content/types';
import { useGameStore } from '../state/store';

function costOf(template: ArmyTemplate): string {
  const total = template.composition.infantry + template.composition.firearm
    + template.composition.cavalry + template.composition.artillery + template.composition.naval;
  return `${total.toLocaleString()} 人/营 · 训练 ${2 * 20 + 10} 日 · 银 ${Math.round(2 * 5000 * 0.6).toLocaleString()} / 粮 ${Math.round(2 * 600 * 0.6).toLocaleString()}`;
}

export function TrainingModal() {
  const picker = useGameStore(state => state.trainingPicker);
  const content = useGameStore(state => state.content);
  const choose = useGameStore(state => state.chooseTrainingTemplate);
  const close = useGameStore(state => state.closeTrainingPicker);
  if (!picker) return null;
  const templates = [...content.armyTemplates.values()].filter(template =>
    picker === 'navy' ? template.composition.naval > 0 : template.composition.naval === 0);

  return (
    <div className="overlay" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="modal training-modal">
        <div className="training-modal-head">
          <div>
            <h2>{picker === 'navy' ? '训练水军' : '训练陆军'}</h2>
            <p className="muted">
              选择具体军团模板。选好后关闭弹窗，在地图上点击
              {picker === 'navy' ? '我方港口' : '我方省份'}部署。
            </p>
          </div>
          <button onClick={close}>关闭</button>
        </div>
        <div className="training-options">
          {templates.map(template => (
            <button className="training-option" key={template.id} onClick={() => choose(template.id)}>
              <b>{template.name}</b>
              <span>步 {template.composition.infantry} · 火 {template.composition.firearm} · 骑 {template.composition.cavalry} · 炮 {template.composition.artillery} · 水 {template.composition.naval}</span>
              <small>{costOf(template)}</small>
            </button>
          ))}
        </div>
        {templates.length === 0 && <p className="muted">当前没有可训练模板。</p>}
      </div>
    </div>
  );
}
