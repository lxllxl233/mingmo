# Steam 上架任务清单（Backlog）

> 配套文档：[steam-master-plan.md](steam-master-plan.md) ｜ 版本 1.0 ｜ 2026-10-19
> 口径：人日按「1 名主程 + AI 代理」估算；S ≤2 人日、M 3–7、L 8–15、XL >15。
> 状态：`待办 / 进行中 / 验收中 / 完成`。建议直接导入 GitHub Issues / Linear / 飞书多维表格。

---

## Sprint 0：决策与止血（W1–2）

| ID | 任务 | 证据/落点 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|---|
| S0-01 | 拍板范围/EA/美术/英文/语音/音乐/Deck/发行/价格/历史轨道 | [steam-master-plan.md](steam-master-plan.md) §14 | 10 个决策有书面结论 | 1 | — |
| S0-02 | 注册 Steamworks、App ID、税/银行、$100 | Steamworks 后台 | 能登录后台、拿到 App ID | 1 | S0-01 |
| S0-03 | Deck 真机 spike：最小 Electron + 游戏 | `electron/` 新目录 | 启动/手柄/Overlay/挂起/1280×800 全过或明确 fallback | 3 | S0-02 |
| S0-04 | Vite `base:'./'` + `assetUrl()`；修 `/assets`、`/audio` | [vite.config.ts](../vite.config.ts)、[music.ts](../src/app/audio/music.ts)、[sound.ts](../src/app/audio/sound.ts) | `dist/index.html` 无绝对 `/assets`；Electron `file://` 有声/有图 | 1 | — |
| S0-05 | 文件存档最小实现 + localStorage 迁移 | [save.ts](../src/app/save/save.ts) | 存档落 `userData`；旧档可读；原子写 | 2 | S0-03 |
| S0-06 | 字体子集 + `document.fonts.ready` | `public/fonts/`、[index.html](../index.html#L24) | Windows/Deck 字形一致；无豆腐块 | 2 | — |
| S0-07 | 内容审计脚本基线 | `scripts/audit-content.ts` 新建 | 输出无效 modifier/effect/trigger/死 flag/重复国策 | 2 | — |
| S0-08 | 当前指标快照（tick/加载/模拟/测试） | 主案 §1.1 / §1.4 | 有基线表，便于回归 | 1 | — |
| S0-09 | CI 骨架（typecheck/lint/test/validate/build） | `.github/workflows/ci.yml` 新建 | PR 必跑；失败阻断 | 1 | — |
| S0-10 | 权利链清单（音频/字体/图像/音乐） | `docs/rights-chain.md` 新建 | 每项有来源/许可证/署名/动作 | 2 | S0-01 |

**Sprint 0 退出**：Deck 能启动游戏；Windows 双击不白屏；存档在 userData；字体一致；CI 跑通；权利链无未知项。

---

## P0：阻断项（W3–8）

### A. 剧本与历史

| ID | 任务 | 证据/落点 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|---|
| P0-01 | 删除初始化时的 `applyHistoricalTimeline`；剧本负责完整开局 | [initial.ts](../src/engine/state/initial.ts#L341) | 3 剧本 × 全 tag 初始版图一致 | 2 | — |
| P0-02 | 历史里程碑改为条件事件 + AI 目标 + 短期压力修正 | [history.ts](../src/engine/systems/history.ts#L163-L216)、[war.ts](../src/engine/rules/war.ts)、[ai.ts](../src/engine/systems/ai.ts) | 20 年模拟无「一天换 187 省」；1644 前后有可解释战争 | 5 | P0-01 |
| P0-03 | 黄金测试：同剧本不同玩家的初始状态哈希一致 | `tests/scenario.test.ts` 新建 | CI 阻断回归 | 2 | P0-01 |
| P0-04 | 历史轨道开关（软引导/自由） | `GameState.rules` 或 scenario 字段 | UI 可选；自由模式无里程碑 | 2 | P0-02 |
| P0-05 | 1644/1650 剧本重写：确保明/郑/南明按设计存在 | [1644.yaml](../src/content/data/scenarios/1644.yaml)、[1650.yaml](../src/content/data/scenarios/1650.yaml) | 选任意势力，初始剧本符合设定；战争存在 | 3 | P0-01 |

### B. 修正注册表与展示字段

| ID | 任务 | 证据/落点 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|---|
| P0-06 | 建 `MODIFIERS` 注册表 + 类型 + 校验 | `src/engine/rules/modifierRegistry.ts` 新建、[schema.ts](../src/content/schema.ts) | 内容只允许注册 key；CI 检查消费者 | 3 | — |
| P0-07 | `corruption_drift` → `corruption_monthly` 批量替换（183 处） | 全 YAML | 0 处旧 key；国策/科技腐败效果生效 | 2 | P0-06 |
| P0-08 | 战斗接线：cavalry/artillery/naval/fort/siege | [military.ts](../src/engine/systems/military.ts#L45-L85) | 13 项无效科技全部有效；单测 | 4 | P0-06 |
| P0-09 | 经济接线：unrest/manpower/pop/supply/political/morale | [economy.ts](../src/engine/systems/economy.ts)、[politics.ts](../src/engine/systems/politics.ts) | 对应内容效果可观测；单测 | 4 | P0-06 |
| P0-10 | 一次性修正：authority/devastation/inflation 实现或删 | [effects.ts](../src/engine/rules/effects.ts#L78-L235) | 内容中无死 key | 2 | P0-06 |
| P0-11 | `armyLoyalty` 接入战斗/哗变/撤退 | [military.ts](../src/engine/systems/military.ts)、[economy.ts](../src/engine/systems/economy.ts#L319-L333) | 欠饷 6 月 + 军心 <30 → 哗变可复现 | 3 | P0-09 |
| P0-12 | `inflation` 接入价格/军饷/税收（或删字段/UI） | [economy.ts](../src/engine/systems/economy.ts) | 通胀可观测；面板解释 | 2 | P0-09 |
| P0-13 | `claims` 接入议和/割让（或删） | [war.ts](../src/engine/rules/war.ts#L85-L205) | 宣称降低索取成本；UI 显示 | 2 | P0-06 |
| P0-14 | `unlockedUnits` / `unlockedDecisions` 接入面板 | [TrainingModal.tsx](../src/ui/overlays/TrainingModal.tsx)、[DecisionPanel.tsx](../src/ui/panels/DecisionPanel.tsx) | 未解锁不可训练/不可见；科技解锁可用 | 2 | P0-06 |
| P0-15 | `province.modifiers` / `supplyLimit` / 模板 `upkeep`/`movement` 接线或删 | [military.ts](../src/engine/systems/military.ts)、[economy.ts](../src/engine/systems/economy.ts) | 字段不再空转；单测 | 3 | P0-06 |
| P0-16 | `hasAdvisor`：实现顾问或从 DSL/内容删 | [triggers.ts](../src/engine/rules/triggers.ts#L72) | 0 内容引用死触发器 | 1 | — |
| P0-17 | 13 项无效科技重写；77 条死国策重写/删除 | [techs.yaml](../src/content/data/techs.yaml)、[focus_packs.yaml](../src/content/data/focus_packs.yaml) | 审计 0 无效；抽检 20 条有实际效果 | 6 | P0-06..15 |
| P0-18 | `audit:content` CI 阻断 + 单测 | `scripts/audit-content.ts` | 无效 key/死 flag/重复国策 = 0 | 2 | P0-17 |

### C. 经济、AI、危机

| ID | 任务 | 证据/落点 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|---|
| P0-19 | 支出 sinks：建筑/发展（先 6 个） | `src/engine/systems/buildings.ts` 新建、YAML | 玩家/AI 能投资；国库不再无限囤 | 6 | P0-09 |
| P0-20 | 债务/欠饷危机：按 arrearsMonths 判定；借债/利息 | [crisis.ts](../src/engine/systems/crisis.ts#L28-L104) | 欠饷 6/12 月有事件/哗变/崩溃；可借债 | 4 | P0-11 |
| P0-21 | 国库软上限/通胀/阶级索取 | [economy.ts](../src/engine/systems/economy.ts) | 24 个月支出以上不再线性囤积 | 3 | P0-19 |
| P0-22 | AI 预算：army/buildings/relief/diplomacy/reserve | [ai.ts](../src/engine/systems/ai.ts) | AI 会投资/救灾/裁军/求和 | 5 | P0-19 |
| P0-23 | 战争疲劳/和平逻辑重做（月+伤亡+失地） | [war.ts](../src/engine/rules/war.ts#L211-L238)、[ai.ts](../src/engine/systems/ai.ts#L287-L350) | 战争 1–5 年可结束；玩家拒绝和平有代价 | 4 | P0-22 |
| P0-24 | 小国姿态：日/朝/藏/荷/俄年度动作 | [ai.ts](../src/engine/systems/ai.ts) | 0 军队挂机消失；每国每年至少 1 动作 | 5 | P0-22 |
| P0-25 | 20 年黄金模拟 + 平衡带宽测试 | `tests/simulation.test.ts` 扩展 | 无长期 0 国库/0 军心；主要势力兴衰可解释 | 4 | P0-19..24 |

### D. 首 5 分钟与 UI 止血

| ID | 任务 | 证据/落点 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|---|
| P0-26 | 右栏目标卡 + 3 条推荐动作 + 「开始推进」 | [GameShell.tsx](../src/ui/shell/GameShell.tsx#L154-L167) | 新玩家 10 秒能开始时间 | 2 | — |
| P0-27 | 4 步引导 + F1 帮助 + 教程可重看 | 新建 `OnboardingOverlay.tsx`、`HelpOverlay.tsx` | 5 名新人 ≥4 人 3 分钟说出目标 | 4 | P0-26 |
| P0-28 | 暂停菜单 / Esc 栈 / 空格全局 / 失焦暂停 / 退出确认 | [GameShell.tsx](../src/ui/shell/GameShell.tsx#L82-L93) | 按钮聚焦后空格仍暂停；Esc 逐层；切窗暂停 | 3 | — |
| P0-29 | 响应式：右栏可收起、顶栏 5+更多、字号 ≥14px | [styles.css](../src/ui/styles.css#L111-L125) | 1280×800 无横向滚动；正文可读 | 6 | — |
| P0-30 | 颜色语义拆分 + 对比度（大明红 ≠ 危险红） | [styles.css](../src/ui/styles.css#L6)、[countries.yaml](../src/content/data/countries.yaml#L4) | 所有文本 ≥4.5:1；大清/南明名可读 | 2 | — |
| P0-31 | 危险操作确认 + 事件 delta + 禁用原因 | [TopBar.tsx](../src/ui/shell/TopBar.tsx#L235-L237)、[EventModal.tsx](../src/ui/overlays/EventModal.tsx) | 不可逆操作 100% 确认；事件 ≥3 项变化 | 3 | — |
| P0-32 | 单槽 → 3 手动 + 3 自动 + 退出自动存 | [save.ts](../src/app/save/save.ts)、[store.ts](../src/ui/state/store.ts#L213-L219) | 槽位可见时间/势力/日期；退出有存档 | 3 | S0-05 |
| P0-33 | 修复 18 个具体 UI 缺陷（`\n`、英文 stance、白和、默认宣战自己等） | 见主案 §6.3 / UI 审计 §5.5 | 逐项回归 | 3 | — |

**P0 退出**：3 剧本初始一致；0 无效修正；20 年模拟无死亡螺旋/挂机；新玩家 3 分钟上手；1280×800 可读；存档不丢。

---

## P1：核心深度（W9–18）

### E. 外交 2.0

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P1-01 | 关系动作：送礼/联姻/结盟/军通/保证/断交 | 6 个动作可用，AI 会用 | 5 | P0-23 |
| P1-02 | 同盟/联军/共同参战/单独和平 | 玩家能组织 2 国联军；AI 会背刺 | 6 | P1-01 |
| P1-03 | 战争目标与和平会议（割地/赔款/附庸/白和） | 目标决定可索取范围；AI 讨价还价 | 5 | P1-02 |
| P1-04 | 反雪球 coalition | 大国扩张触发 coalition；AI 参战 | 4 | P1-02 |
| P1-05 | 藩属/上供/独立战争 | 朝鲜/中南半岛可用；拒贡开战 | 3 | P1-01 |

### F. 军事 2.0

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P1-06 | 水战/封锁/海运拦截/登陆战 | 郑氏能封锁福建；荷兰/日本有意义 | 8 | P0-08 |
| P1-07 | 围城选项：强攻/围困/炮击/招降 | 3 种可读选择；城防/炮兵联动 | 4 | P0-08 |
| P1-08 | 补给上限/道路/仓库/焦土 + 可视化 | 断粮/断援可读；AI 会断补给 | 5 | P0-15 |
| P1-09 | 军队质量：训练/装备升级 + 补充兵员 | 老兵/新兵差异；AI 会升级 | 4 | P0-19 |
| P1-10 | 战斗结果分解（为什么输） | 气泡/面板显示地形/兵种/将领/组织 | 3 | — |
| P1-11 | AI 战区/方面军/撤退/围城 | 不再单军团乱走；多线能力 | 6 | P1-06..10 |

### G. 经济 2.0

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P1-12 | 建筑 8–12 种 + 省份槽位 + UI | 玩家/AI 会建；占领可毁 | 6 | P0-19 |
| P1-13 | 贸易节点/港口/白银流入 | 郑/荷/日靠海贸；白银影响通胀 | 6 | P1-12 |
| P1-14 | 金融：借债/利息/印钞/火耗 | 死亡螺旋可玩；AI 会借债 | 4 | P0-20 |
| P1-15 | 阶级特权扩展 3–5/势力 + 授予/撤销 | 特权有代价；AI 会用 | 4 | — |
| P1-16 | 粮食/人口/灾荒/流亡 | 江南粮 vs 北方边镇；灾荒可救 | 5 | P1-12 |
| P1-17 | 腐败制度/稽查/事件 | 腐败可治理；影响税收/军饷/科研 | 3 | — |

### H. 六势力独特机制（EA）

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P1-18 | 大明·朝议/党争 | 派系面板/政策票；AI 会用 | 6 | P1-01 |
| P1-19 | 大清·八旗编制 | 旗份/满汉平衡；AI 会用 | 6 | P1-09 |
| P1-20 | 大顺·追赃助饷 | 抄没目标/民望；AI 会用 | 4 | P1-12 |
| P1-21 | 南明·正统竞争 | 正统树/藩镇；AI 会用 | 5 | P1-01 |
| P1-22 | 郑氏·海贸网络 | 海图/商路/船队；AI 会用 | 5 | P1-13 |
| P1-23 | 蒙古·盟旗会盟 | 部落网格/会盟；AI 会用 | 4 | P1-01 |

### I. AI 2.0

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P1-24 | 战略层目标/预算/外交/独特机制 | AI 会投资/结盟/求和/用机制 | 6 | P1-18..23 |
| P1-25 | 战役层战区/方面军/目标优先级 | 多线进攻/防守/撤退 | 5 | P1-11 |
| P1-26 | 难度只改决策质量，不作弊 | 三档可感知差异 | 2 | P1-24 |

### J. UI/性能 P0

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P1-27 | 键盘全流程 + 焦点陷阱 + 卡片按钮化 | 仅键盘完成前 10 分钟 | 4 | P0-28 |
| P1-28 | 手柄虚拟光标 + 省份光标 + 图标 | Deck 不触屏 15 分钟 | 8 | P1-27 |
| P1-29 | 地图脏检查/分层/标签池化 | 占领单省 <16ms；32x P95 <4ms | 6 | — |
| P1-30 | React selector/派生缓存/滑杆解耦 | 单 tick React <4ms；拖动 60fps | 4 | — |
| P1-31 | BitmapFont/LOD/分辨率上限 | 纹理 <150MB；draw call <150 | 5 | P1-29 |
| P1-32 | 设置菜单（显示/音频/语言/键位/辅助） | 全设置持久化；即时生效 | 4 | P0-29 |

**P1 退出**：6 势力各有独特操作；外交/军事/经济各有 2–3 层决策；Deck 手柄可玩；1080p 60fps / Deck 30fps；5 名外部玩家 10 小时无阻断。

---

## P2：内容、表现、本地化（W19–28）

### K. 内容

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P2-01 | 事件 180–200（含 16–18 链） | 全部可达；有史实注；无死 flag | 20 | P1-24 |
| P2-02 | 国策 252 条独特效果/描述 | 同层同类型不重复；AI 权重 | 15 | P1-18..23 |
| P2-03 | 决议 60–72 条 | 有触发/成本/后果 | 6 | P2-02 |
| P2-04 | 科技 84 条全有效 | 审计 0 无效；少数值多解锁 | 5 | P0-18 |
| P2-05 | 税法 42 条平衡 + 特权 3–5/势力 | 每条有取舍；AI 会用 | 6 | P1-15 |
| P2-06 | 将领 90 + 特质 | 史实/随机；AI 分配 | 4 | — |
| P2-07 | 地图 480 真实地名 + 河流/关隘 | 无「东/西」后缀；关键地点对 | 10 | — |
| P2-08 | 建筑 8–12 + 事件插图 20 | 内容完整；无占位 | 10 | P1-12 |

### L. 表现

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P2-09 | 美术风格/色板/UI kit | art bible；UI 统一 | 10 | S0-01 |
| P2-10 | 12 领袖木刻/水墨头像 | 不再 Q 版；风格统一 | 10 | P2-09 |
| P2-11 | 30 将领/兵种/资源/地形图标 | 统一线性图标 | 6 | P2-09 |
| P2-12 | 地图纹理/纸张/边界/地形排线 | 截图可达商店级 | 8 | P2-07 |
| P2-13 | 8–10 首原创音乐 | 按势力/剧本/战斗分轨 | 10 | S0-01 |
| P2-14 | 音效 + 20–30 句配音（或移除 TTS） | 四档音量；字幕；授权清晰 | 6 | S0-10 |
| P2-15 | 胶囊/Logo/关键艺术/预告 | 过审；231×87 可读 | 8 | P2-09 |

### M. 本地化

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P2-16 | i18n 架构（UI/内容/日志/错误/Intl） | `t()` + 类型 key；无中文字面量 | 6 | — |
| P2-17 | 英化全量（15–20k 词）+ 术语表 | 全流程可玩；无截断 | 15 | P2-16 |
| P2-18 | 字体子集 + Pixi BitmapFont | <3MB；1709 字全覆盖 | 3 | S0-06 |
| P2-19 | 英文布局回归（1280/1920） | 顶栏/国策/卡片不溢出 | 4 | P2-17 |
| P2-20 | 旧存档切换语言/回退 | 日志按 key 重译；缺失回退 | 2 | P2-16 |

### N. Steamworks / 桌面

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P2-21 | Electron 壳 + electron-builder + 安全配置 | Win/Linux 双击可玩；CSP/preload | 6 | S0-03 |
| P2-22 | steamworks.js 适配器 + mock/离线 | 无 Steam 可开发；离线不阻塞 | 4 | P2-21 |
| P2-23 | 成就 30–40 + 统计 12–20 | 解锁幂等；Steam 后台配置 | 5 | P2-22 |
| P2-24 | Steam Cloud + 冲突/备份 | 换机/Deck 同步；冲突提示 | 3 | P0-32 |
| P2-25 | Rich Presence + Overlay 测试 | 状态正确；Overlay 可用/可降级 | 2 | P2-22 |
| P2-26 | 崩溃上报/日志导出/挂起恢复 | 崩溃可诊断；Deck 恢复正确 | 3 | P2-21 |
| P2-27 | 商店页/截图/预告/双语文案 | 过审；愿望单开始增长 | 5 | P2-15 |

**P2 退出**：EA 内容冻结；英文全流程可玩；Steamworks 可用；商店页 draft；Demo/Playtest 构建。

---

## P3：EA / 1.0（W29–52）

| ID | 任务 | 验收 | 人日 | 依赖 |
|---|---|---|---|---|
| P3-01 | Playtest 200–500 人 + 问卷/遥测 | 崩溃/卡点/退款意向有数据 | 5 | P2-27 |
| P3-02 | Demo（1627 明 3 年 / 1644 清 1 年） | 独立 App；过审；Next Fest | 5 | P3-01 |
| P3-03 | EA 发售（6 势力） | 评价 ≥75%；退款 <10% | 3 | P3-01 |
| P3-04 | 补 6 势力（西/朝/日/藏/荷/俄）+ 机制 | 12 势力可玩；各有独特操作 | 30 | P1-18..23 |
| P3-05 | 1650 剧本 | 可玩；与 1627/1644 共用内容 | 4 | P3-04 |
| P3-06 | +100 事件 / +250 国策 / +40 决议 | 1.0 内容量达标 | 25 | P3-04 |
| P3-07 | 地图/插图/配音补全 | 1.0 表现达标 | 15 | P2-12/14 |
| P3-08 | Deck Verified 冲刺 | 手柄 UI/图标/OSK/性能 | 8 | P1-28 |
| P3-09 | 日/韩本地化（可选） | 若销量支持 | 10 | P2-17 |
| P3-10 | 创意工坊/本地 mod 目录评估 | 1.0 后 | 6 | P2-16 |
| P3-11 | 1.0 营销：愿望单/媒体/主播/发售 | 愿望单 ≥15k；首月 100+ 评价 | 8 | P3-06 |
| P3-12 | 1.0 发售 + 热修流程 | 评价 ≥80%；崩溃 <0.5% | 5 | P3-11 |

---

## 后置 / 运营（1.0 后）

| ID | 任务 | 说明 |
|---|---|---|
| O-01 | 剧本 DLC（三藩/准噶尔） | ¥18–28；复用框架 |
| O-02 | 创意工坊 + Mod API | 外部 YAML/JSON；审核/版本 |
| O-03 | 排行榜/好友榜 | 需可信存档/铁人 |
| O-04 | 社区翻译 | 日/韩/繁中 |
| O-05 | Deck Verified 复审 | 若首发 Playable |
| O-06 | 平衡补丁/事件包 | 每 4–8 周 |
| O-07 | 主机/移动端评估 | 不建议 1.0 前 |
| O-08 | 续作/新剧本 | 视销量 |

---

## 验收命令（每个 PR 必跑）

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm validate
pnpm audit:content
pnpm build
pnpm sim --years 20 --seed 42 --scenario 1627 --player MING
```

> 当前沙箱环境 vitest/build 因 esbuild `spawn EPERM` 无法运行；以上命令必须在正常开发/CI 环境执行。

---

## 建议的 90 天冲刺（Sprint 0–3）

| 周 | 目标 | 交付 |
|---|---|---|
| 1–2 | 决策 + Deck spike + 路径/存档/字体 | 可双击、可存档、可手柄；决策记录 |
| 3–4 | 剧本初始化 + 黄金测试 | 3 剧本一致；1644 选清仍有明/顺/战争 |
| 5–6 | 修正注册表 + 战斗/经济接线 | 323 处归零；13 科技有效 |
| 7–8 | 经济/AI/危机第一版 + CI | 20 年模拟无挂机；`audit` 全绿 |
| 9–10 | 外交 2.0 骨架 + UI P0 | 同盟/和平会议；新玩家 3 分钟上手 |
| 11–12 | 军事 2.0 骨架 + 手柄 | 水战/围城；Deck 15 分钟可玩 |
| 13 | 第一次外部 playtest + 复盘 | 5 名玩家 10 小时报告；修复清单 |

**第 13 周 gate**：若 P0 未全绿或外部 playtest 阻断 >5 个，暂停内容扩张，先修可信度；不要进入 Phase 2。
