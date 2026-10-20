import { useGameStore } from '../state/store';

const SECTIONS: Array<{ title: string; lines: string[] }> = [
  {
    title: '目标',
    lines: [
      '你控制一个势力；目标是活到 1683 年，并尽可能完成势力目标。',
      '胜利条件：一统天下、承天受命、割据一隅、海上霸权；也可按评分结算。',
      '失败不只有亡国：债务、民变、失京师、正统丧失都会留下结局。',
    ],
  },
  {
    title: '资源',
    lines: [
      '银：国库；每月按阶级分配与税法征收，再扣腐败、维稳、军饷与购粮。',
      '粮：军队口粮；粮价随通胀上升，缺粮会掉稳定与军心。',
      '兵源：按人口与稳定恢复；训练、补充、征募都消耗兵源。',
      '稳定 / 天命 / 皇权 / 腐败：互相传导；低稳定会降低税收并引发民变。',
      '债务：拖欠军饷超过 3 个月军心下降，超过 6 个月可能哗变。',
    ],
  },
  {
    title: '分配与税法',
    lines: [
      '打开“分配”：调整各阶级份额、税法与购粮比例。',
      '向士绅/商人加税会转嫁给农民；短期增收，长期民变。',
      '税法改革需要 90 日与 50 政治点；改革期间税收打折。',
      '影响力决定最低分配份额；忠诚决定抗税与民变风险。',
    ],
  },
  {
    title: '国策 / 科研 / 决议',
    lines: [
      '国策：一次推进一条；前置、互斥、耗时；完成给效果并解锁决议。',
      '科研：有限槽位；经费不足会减速；科技解锁单位/建筑/决议。',
      '决议：一次性全国施策；消耗银/粮/政治点，有冷却。',
    ],
  },
  {
    title: '军事',
    lines: [
      '左键选择军团；右键目标地区行军；Ctrl+右键追加路线。',
      '右键拖框可批量选择本国军团；选中后右键目标可统一行军。',
      '围城需要时间；有炮兵更快；被包围超过 7 日会减员。',
      '水师可海运陆军：在港口登船，驶向本国港口。',
    ],
  },
  {
    title: '快捷键',
    lines: [
      '空格：暂停 / 继续',
      'Esc：关闭菜单 / 面板，或打开暂停菜单',
      'F1：打开 / 关闭帮助',
      '1–7：暂停、1x、2x、4x、8x、16x、32x',
    ],
  },
];

export function HelpOverlay() {
  const open = useGameStore(state => state.helpOpen);
  const setOpen = useGameStore(state => state.setHelpOpen);
  if (!open) return null;
  return (
    <div className="overlay help-overlay">
      <div className="menu-card help-card" role="dialog" aria-modal="true" aria-label="帮助">
        <div className="help-head">
          <div>
            <p className="eyebrow">FIELD MANUAL</p>
            <h2>怎么玩</h2>
          </div>
          <button onClick={() => setOpen(false)}>关闭（F1）</button>
        </div>
        <div className="help-scroll">
          {SECTIONS.map(section => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              {section.lines.map(line => <p key={line}>{line}</p>)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
