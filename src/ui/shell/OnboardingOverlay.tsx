import { useState } from 'react';
import { useGameStore } from '../state/store';

const STEPS: Array<{ title: string; body: string; tip: string }> = [
  {
    title: '你是这个势力的决策者',
    body: '右上角是国名、领袖与本局目标。先看目标，再看财政：你的第一场危机通常不是敌军，而是发不出军饷。',
    tip: '右栏会常驻“开局清单”，不知道点哪里时看它。',
  },
  {
    title: '先看顶栏：银、粮、兵源、稳定',
    body: '把鼠标停在顶栏数值上，会展开本月收支、粮价、欠饷月数与稳定来源。红色数字是危险，不是装饰。',
    tip: '欠饷超过 3 个月，军心开始掉；超过 6 个月可能哗变。',
  },
  {
    title: '打开“分配”，做第一次取舍',
    body: '阶级份额、税法、购粮比例都在这里。向士绅或商人加税能立刻增收，但会转嫁给农民；这就是本作的核心取舍。',
    tip: '国策、科研、决议都在左栏；先选一条能解决当前财政或边防的路线。',
  },
  {
    title: '开始推进，并学会暂停',
    body: '按“开始推进”或空格让时间流动；再按空格暂停。事件会暂停时间，选项会显示代价。失败不可怕，看不懂为什么失败才可怕。',
    tip: 'Esc 打开暂停菜单；F1 随时查看完整帮助。',
  },
];

export function OnboardingOverlay() {
  const settings = useGameStore(state => state.settings);
  const finish = useGameStore(state => state.finishTutorial);
  const setSpeed = useGameStore(state => state.setSpeed);
  const [step, setStep] = useState(0);
  if (settings.tutorialSeen) return null;
  const current = STEPS[step] ?? STEPS[0]!;
  const last = step >= STEPS.length - 1;
  return (
    <div className="overlay onboarding-overlay">
      <div className="menu-card onboarding-card" role="dialog" aria-modal="true" aria-label="新手引导">
        <p className="eyebrow">第一步 · {step + 1} / {STEPS.length}</p>
        <h2>{current.title}</h2>
        <p className="onboarding-body">{current.body}</p>
        <p className="onboarding-tip">{current.tip}</p>
        <div className="onboarding-dots">
          {STEPS.map((entry, index) => (
            <span key={entry.title} className={index === step ? 'active' : ''} />
          ))}
        </div>
        <div className="menu-actions">
          <button className="ghost" onClick={() => finish()}>跳过</button>
          {step > 0 && <button onClick={() => setStep(step - 1)}>上一步</button>}
          {!last && <button className="primary" onClick={() => setStep(step + 1)}>下一步</button>}
          {last && (
            <button
              className="primary"
              onClick={() => {
                finish();
                setSpeed(1);
              }}
            >
              开始推进（空格）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
