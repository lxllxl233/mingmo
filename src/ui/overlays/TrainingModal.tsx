import type { ArmyTemplate } from '../../content/types';
import { FOREIGN_TRAINING_LIMIT, isForeignTemplate } from '../../engine/rules/armyTemplates';
import { useGameStore } from '../state/store';
import { ArmyIcon } from '../panels/ArmyIcon';

function costOf(template: ArmyTemplate): string {
  const total = template.composition.infantry + template.composition.firearm
    + template.composition.cavalry + template.composition.artillery + template.composition.naval;
  return `${total.toLocaleString()} 人/营 · 训练 50 日 · 银 ${Math.round(2 * 5000 * 0.6).toLocaleString()} / 粮 ${Math.round(2 * 600 * 0.6).toLocaleString()}`;
}

export function TrainingModal() {
  const picker = useGameStore(state => state.trainingPicker);
  const content = useGameStore(state => state.content);
  const game = useGameStore(state => state.game);
  const choose = useGameStore(state => state.chooseTrainingTemplate);
  const close = useGameStore(state => state.closeTrainingPicker);
  if (!picker || !game) return null;
  const templates = [...content.armyTemplates.values()].filter(template =>
    picker === 'navy' ? template.composition.naval > 0 : template.composition.naval === 0);
  const own = templates.filter(template => !isForeignTemplate(game.playerTag, template.id));
  const foreign = templates.filter(template => isForeignTemplate(game.playerTag, template.id));
  const foreignQueued = game.training.filter(entry =>
    entry.tag === game.playerTag && isForeignTemplate(game.playerTag, entry.templateId)).length;
  const foreignActive = Object.values(game.armies).filter(army =>
    army.tag === game.playerTag && isForeignTemplate(game.playerTag, army.templateId)).length;
  const foreignFull = foreignQueued + foreignActive >= FOREIGN_TRAINING_LIMIT;

  return (
    <div className="overlay" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="modal training-modal">
        <div className="training-modal-head">
          <div>
            <h2>{picker === 'navy' ? '训练水军' : '训练陆军'}</h2>
            <p className="muted">
              选择具体军团模板。选好后关闭弹窗，在地图上点击
              {picker === 'navy' ? '我方港口' : '我方省份'}部署。
              他国军种每次同时训练上限 {FOREIGN_TRAINING_LIMIT} 支。
            </p>
          </div>
          <button onClick={close}>关闭</button>
        </div>
        <h3>本国军种</h3>
        <div className="training-options">
          {own.map(template => (
            <button className="training-option" key={template.id} onClick={() => choose(template.id)}>
              <ArmyIcon template={template} />
              <div className="training-option-text">
                <b>{template.name}</b>
                <span>步 {template.composition.infantry} · 火 {template.composition.firearm} · 骑 {template.composition.cavalry} · 炮 {template.composition.artillery} · 水 {template.composition.naval}</span>
                <small>{costOf(template)}</small>
              </div>
            </button>
          ))}
          {own.length === 0 && <p className="muted">本国没有此类模板，可聘用他国军种。</p>}
        </div>
        {foreign.length > 0 && (
          <>
            <h3 className="training-foreign-head">
              他国军种
              <span className="muted">（现有 {foreignActive}，排队 {foreignQueued} / 上限 {FOREIGN_TRAINING_LIMIT}）</span>
            </h3>
            <div className="training-options">
              {foreign.map(template => (
                <button
                  className="training-option foreign"
                  key={template.id}
                  disabled={foreignFull}
                  onClick={() => !foreignFull && choose(template.id)}
                >
                  <ArmyIcon template={template} />
                  <div className="training-option-text">
                    <b>{template.name}</b>
                    <span>步 {template.composition.infantry} · 火 {template.composition.firearm} · 骑 {template.composition.cavalry} · 炮 {template.composition.artillery} · 水 {template.composition.naval}</span>
                    <small>{costOf(template)} · 他国军种</small>
                  </div>
                </button>
              ))}
            </div>
            {foreignFull && <p className="muted">他国军种训练名额已满，完成当前训练后可再招募。</p>}
          </>
        )}
      </div>
    </div>
  );
}
