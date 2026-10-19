# 《明末 华夏震荡》Steam 1.0 执行计划（由 DSH 代理执行）

> 配套：[Steam 商业化优化总案](steam-master-plan.md) ｜ [任务清单](steam-backlog.md)
> 版本：1.0 ｜ 2026-10-19 ｜ 默认范围：**EA 6 势力 → 1.0 12 势力**
> 这份文件回答一个问题：**如果把项目交给我（AI 编码代理）来做，我会按什么顺序、怎么落地、每一步怎么验收、哪些必须由你来做。**
> ⚠️ **范围更新（2026-10-19）**：如果你只要「品质达到可上架水准」、不实际上架、不做桌面/手柄，请用 [quality-plan.md](quality-plan.md)；本文档的 Electron/Steamworks/Deck/商店章节仅作上架备选。

---

## 0. 默认假设（你不同意就改）

1. **范围按 B**：EA 先做 6 个深度势力（明、清、顺、南明、郑、蒙古），1.0 补西、朝、日、藏、荷、俄。
2. **平台按 Electron**：Windows x64 + Linux x64；首发目标 Deck Playable，售后冲 Verified。
3. **语言按中英双语**：英文首发，日/韩 1.0 后评估。
4. **美术按木刻/水墨**：先委托 12 领袖 + 地图风格 + UI kit，其余用模板/程序化补足。
5. **音频按原创 + 真人短语音**：移除 Edge TTS；音乐委托 8–10 首原创；语音 20–30 句。
6. **历史按软引导**：默认保留史实压力与事件，不做传送；可切「自由沙盒」。
7. **价格按 EA ¥58 / 1.0 ¥78**；发行先自发行，同时 pitch publisher。

如果这些默认里有任何一条不对，先改 `docs/decisions-log.md`，再动代码。

---

## 1. 我的工作方式

### 1.1 每个工作循环（1–2 天）

1. **读**：读相关文件、现有测试、内容 schema；不凭记忆改代码。
2. **证**：能写探针/测试的先写；不能的写最小复现脚本。
3. **改**：一个步骤只解决一个问题；不顺手重构无关代码。
4. **验**：`pnpm typecheck` + `pnpm audit:content` + 对应探针/测试；必要时请你跑 `pnpm test` / `pnpm build`。
5. **记**：更新 `docs/progress.md`（做了什么、证据、遗留、需要你）。
6. **提交**：`feat(scope): ...` / `fix(scope): ...`，一个步骤一个 commit，可回滚。

### 1.2 我的汇报格式

- **每日 3 行**：完成 / 下一步 / 阻塞。
- **每周**：可运行构建、changelog、指标（tick、审计、测试数）、需要你拍板的事项。
- **每个 Gate**：一页验收报告（目标、证据、未达标项、风险、是否进入下一阶段）。

### 1.3 我不会做的事

- 不在没有验证的情况下说「完成」。
- 不伪造 playtest、Deck、Steam 后台或法务结论。
- 不擅自改已锁定的设计（D1–D6）；范围变更必须写进决策记录。
- 不未经你同意购买素材/服务或发布到 Steam。
- 不把「内容数量」当「内容质量」；每条国策/事件必须能说清取舍。

### 1.4 当前环境的限制

| 能力 | 状态 | 应对 |
|---|---|---|
| 编辑代码/内容/文档 | 可用 | — |
| `pnpm typecheck`（tsc） | 可用 | 每个步骤必跑 |
| `tsc` 编译 + Node 跑无头探针 | 可用 | 用于模拟/平衡/场景矩阵 |
| `pnpm test`（vitest） | 沙箱内 `spawn EPERM` | 请你本地跑，或我申请一次性提权 |
| `pnpm build`（Vite/esbuild） | 沙箱内 `spawn EPERM` | 同上 |
| `pnpm add electron` / Electron 下载 | 可能需要网络/提权 | 我写配置，你批准安装或你本地装 |
| Steam 客户端 / App ID | 不可用 | 我写 mock + 适配器，你在真机验证 |
| Steam Deck / Windows 真机 | 不可用 | 你做硬件验收；我给检查清单 |
| 美术/音频/翻译/法务 | 不可用 | 我出规格/集成/验收；你找外包 |

> 每个 Gate 我会明确写「这条验证由谁跑」。需要提权时我一次性说明命令与原因，不会反复试探。

---

## 2. 分工

| 角色 | 负责 | 不负责 |
|---|---|---|
| **我（DSH）** | 代码、测试、探针、内容草稿、审计、构建配置、Steamworks 代码、i18n 架构、性能、文档、商店文案草稿 | 最终美术/音乐、人工翻译定稿、法务签字、Deck 真机、Playtest 招募、Steam 后台发布 |
| **你** | 决策、Steamworks 账号/App ID、真机测试、史实审读、外包管理、预算、最终验收 | 不需要写代码（但可以随时改） |
| **外包** | 美术、作曲/音效/配音、英化审校、QA、律师/商标 | — |

---

## 3. 总里程碑

| 里程碑 | 周 | 目标 | Gate |
|---|---|---|---|
| M0 基线 | W1 | 决策、探针、审计、CI 骨架 | G0：基线报告 + 决策记录 |
| M1 桌面第一天 | W2–3 | 路径、Electron、文件存档、字体、日志 | G1：Windows/Deck 双击可玩 |
| M2 剧本真实 | W3–4 | 同剧本同世界；1644/1650 修好 | G2：场景矩阵一致 |
| M3 内容真实 | W4–7 | 修正注册表、323 处接线、13 科技、77 国策 | G3：审计 0 无效 |
| M4 经济/AI/历史 | W7–11 | 债务、sinks、AI 预算、战争疲劳、去传送 | G4：20 年模拟可信 |
| M5 核心系统 + 6 机制 | W10–17 | 外交/军事/经济/AI 2.0；6 势力独特机制 | G5：每个机制有「只有它能做」 |
| M6 UI/UX/性能 | W11–18 | 引导、暂停、设置、响应式、键鼠/手柄、脏渲染 | G6：1280×800 可读、Deck 30fps |
| M7 内容 + 英化 | W16–23 | 180–200 事件、252 国策、地图改名、EN | G7：EA 内容冻结、英文全流程 |
| M8 Steamworks/Deck/商店 | W20–27 | 成就/云/富状态、双平台构建、Deck、商店页 | G8：构建过审、商店 draft |
| M9 Playtest/EA | W24–31 | 200–500 人测试、Demo、Next Fest、EA 发售 | G9：EA 上线 |
| M10 1.0 | W31–56 | 6 势力、1650、+100 事件、Deck Verified、1.0 | G10：1.0 上线 |

> 周数是相对周，允许并行；关键路径是「M2/M3 → M4 → M5 → M7 → M8/M9」。  
> 若选 A（12 势力 1.0），M5/M10 扩展，总工期 +4–6 个月；若选 C（8 势力 1.0），跳过 M9 的 EA，M10 缩到 W31–48。

---

## 4. 分阶段详细步骤

### M0 基线（W1，3–5 天）

**目标**：把「现状」变成可复现的数字，避免后面拍脑袋。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 0.1 | 决策记录 | 把 §0 的 10 个默认写成 D-1…D-10；你确认/修改 | `docs/decisions-log.md` 新建 | 每条有结论/日期 | 0.5 |
| 0.2 | 进度板 | 建里程碑/当前步骤/阻塞 | `docs/progress.md` 新建 | 每日更新 | 0.5 |
| 0.3 | 内容审计 | 写审计脚本：无效 modifier/effect/trigger、死 flag、重复国策、不可达事件 | `scripts/audit-content.ts` 新建 | 输出 323/13/77 基线 | 1 |
| 0.4 | 场景矩阵探针 | 3 剧本 × 全 tag，输出省 owner/controller/wars 哈希 | `scripts/dev/scenario-matrix.ts` 新建 | 复现 1644/1650 不一致 | 1 |
| 0.5 | 平衡探针 | 20 年旁观，输出年度版图/国库/军队/战争 | `scripts/dev/balance-report.ts` 新建 | 复现 1644 传送/日本囤银 | 1 |
| 0.6 | 性能探针 | 内容加载、1/5/20 年 tick | `scripts/dev/perf.ts` 新建 | 复现 467ms/8–13.6ms/99s | 0.5 |
| 0.7 | CI 骨架 | typecheck/lint/test/validate/audit/build | `.github/workflows/ci.yml` 新建 | PR 必跑；失败阻断 | 0.5 |
| 0.8 | 分支/提交约定 | `steam-1.0` 分支；步骤 ID 进 commit | `CONTRIBUTING.md` 或 `docs/progress.md` | 后续 commit 可追溯 | 0.5 |

**G0 验收**：基线数字 + 审计报告 + 决策记录 + CI 文件；你确认范围。

**需要你**：确认 §0 默认；提供 Steamworks 账号/App ID（可以后补）；确认 Deck/Windows 测试机；确认是否允许我安装 Electron/跑构建（提权）。

---

### M1 桌面第一天（W2–3，8–10 天）

**目标**：让游戏在 Windows/Deck 上「双击就能玩、存档不丢、字体一致」；这是上架的地基。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 1.1 | 资源路径 | `assetUrl()`；Vite `base:'./'`；替换 `/audio`、`/assets` | `src/app/assets.ts` 新建、`vite.config.ts`、`music.ts`、`sound.ts` | `dist/index.html` 无绝对 `/assets`；`file://` 有声/有图 | 1 |
| 1.2 | Electron 壳 | main/preload；`contextIsolation:true`、`nodeIntegration:false`、CSP、单实例、无边框全屏 | `electron/main.ts`、`electron/preload.ts`、`electron-builder.yml`、`package.json` | `pnpm electron:dev` 打开游戏；无白屏 | 2 |
| 1.3 | 文件存档 | 主进程 IPC：list/read/write/delete/export；原子写 + 3 备份；首启迁移 localStorage | `electron/saveIpc.ts`、`src/app/save/fileSave.ts`、`save.ts` | 存档落 `userData`；旧档可读；断电不坏 | 2 |
| 1.4 | 字体 | 下载 Noto Serif SC（OFL）；子集脚本；`@font-face`；Pixi 统一 fontFamily | `scripts/fonts/*`、`src/ui/styles.css`、`index.html` | Windows/Deck 字形一致；无豆腐块 | 1.5 |
| 1.5 | 日志/崩溃/容错 | electron-log、crashReporter、日志导出、React ErrorBoundary、地图初始化失败提示 | `electron/logging.ts`、`src/ui/ErrorBoundary.tsx` | 崩溃有日志；地图失败有提示 | 1 |
| 1.6 | 首次构建交接 | 我给命令；你跑 `pnpm install`/`build`/`electron:build`；我修报错 | `README`/`docs/progress.md` | Windows 安装包能启动 | 1 |

**G1 验收**：Windows 双击即玩；Deck 能启动、能读手柄；存档在 `userData`；字体一致；无白屏/无声。

**需要你**：批准 Electron 安装/构建（或你本地跑）；Deck 真机 30 分钟验证。

---

### M2 剧本真实（W3–4，5–7 天）

**目标**：同一剧本、任何玩家 tag，开局世界一致；1644 选清仍有明/顺/战争；1650 郑氏完整。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 2.1 | 去掉初始化历史 | 删除 `createInitialState` 末尾的 `applyHistoricalTimeline`；剧本负责完整开局 | `src/engine/state/initial.ts` | 初始化不再改 owner/controller | 0.5 |
| 2.2 | 历史模式字段 | `GameRules.historyMode` 取 `soft` 或 `free`；存进 `GameState` 与存档 | `state/types.ts`、`initial.ts`、`save.ts` | 读档保留；默认 soft | 0.5 |
| 2.3 | 场景矩阵测试 | 全剧本 × 全 tag 比较省 owner/controller/wars 哈希 | `tests/scenario.test.ts` 新建 | 回归即失败 | 1 |
| 2.4 | 1644 修剧本 | 确保明/顺/清/西/南明/郑按设计存在；初始战争存在 | `scenarios/1644.yaml` | 选清时有明、有顺、顺→明/清→明 | 1 |
| 2.5 | 1650 修剧本 | 郑氏福建完整；清→郑战争存在；SMING 按设计 | `scenarios/1650.yaml` | 任意 tag 郑氏 30 省/战争一致 | 1 |
| 2.6 | 历史替换设计 | 写「事件 + AI 目标 + 压力修正」方案；列出要删的传送 | `docs/history-redesign.md` 新建 | 你/我做史实 review | 1 |

**G2 验收**：场景矩阵哈希一致；1644/1650 按设计；历史替换方案签字。

**需要你**：史实审读（1644/1650 开局是否符合预期）；确认「软引导」默认。

---

### M3 内容真实（W4–7，15–20 天）

**目标**：内容里写的每个效果都真的生效；没有展示字段。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 3.1 | 修正注册表 | `MODIFIERS`：key/label/scope/kind/consumer；schema 只允许注册 key | `src/engine/rules/modifierRegistry.ts` 新建、`content/schema.ts`、`validate.ts` | 未知 key 直接报错 | 2 |
| 3.2 | 腐败改名 | `corruption_drift` → `corruption_monthly`（183 处）；经济消费 | 全 YAML、`economy.ts` | 国策/科技腐败效果可观测 | 1.5 |
| 3.3 | 战斗接线 | cavalry/artillery/naval/fort/siege 进入攻击/防御/围城 | `military.ts` | 13 项无效科技全部有效 | 3 |
| 3.4 | 经济接线 | unrest/manpower/pop/supply/political/morale 进入月结 | `economy.ts`、`politics.ts` | 对应内容可观测 | 3 |
| 3.5 | 展示字段 | armyLoyalty 哗变/战斗；inflation 价格；claims 议和；unlockedUnits/Decisions 面板；province.modifiers；supplyLimit；模板 upkeep/movement；hasAdvisor | 多文件 | 每个字段有消费者或删除 | 4 |
| 3.6 | 内容重写 | 13 科技、77 国策、死修正条目；每条独特效果 | `techs.yaml`、`focus_packs.yaml` | 审计 0；抽检 20 条有效 | 4 |
| 3.7 | 单测 | 每个 modifier 至少一个消费者测试；效果前后对比 | `tests/modifiers.test.ts` 新建 | 覆盖注册表 | 2 |
| 3.8 | CI 阻断 | `audit:content` 进 CI；阈值 0 | `.github/workflows/ci.yml` | 回归阻断 | 0.5 |

**G3 验收**：`audit:content` 0 错误；0 死字段；13 科技/77 国策有效；类型检查通过。

**需要你**：无（审阅即可）。

---

### M4 经济、AI、历史（W7–11，20–25 天）

**目标**：世界会花钱、会崩溃、会重新崛起；历史不再靠传送。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 4.1 | 债务危机 | `arrearsMonths`/`debtMonths`；6/12 月事件；借债/利息 | `crisis.ts`、`economy.ts` | 欠饷 12 月可复现崩溃链 | 3 |
| 4.2 | 支出 sinks | 建筑 6 种、军队质量、救灾、外交；AI 会用 | `systems/buildings.ts` 新建、YAML | 国库不再无限囤 | 5 |
| 4.3 | 软上限/通胀 | 6 个月支出以上腐败/通胀/阶级索取；AI 投资 | `economy.ts`、`ai.ts` | 主要势力 ≤24 个月支出 | 3 |
| 4.4 | AI 预算 | army/buildings/relief/diplomacy/reserve；低储备裁军/加税/求和 | `ai.ts` | 20 年无 0 国库僵尸 | 4 |
| 4.5 | 战争疲劳/和平 | 月+伤亡+失地；AI 看战果/首都；玩家拒和有代价 | `war.ts`、`ai.ts` | 战争 1–5 年结束 | 3 |
| 4.6 | 小国姿态 | 日/朝/藏/荷/俄年度动作 | `ai.ts` | 无 0 军队挂机 | 3 |
| 4.7 | 历史去传送 | 条件事件 + AI 目标 + 压力修正；删 `MILESTONES` 改地 | `history.ts`、events | 1644 前后靠战争/议和 | 4 |
| 4.8 | 20 年报告 | 3 剧本 × 3 难度 × 5 种子；不变量/带宽 | `scripts/dev/balance-report.ts` | 报告 + 调参 | 3 |

**G4 验收**：20 年模拟无长期 0 国库/0 军心；无传送；大国会投资；战争能结束；你玩 3 局认可「世界在动」。

**需要你**：2–3 次 1 小时试玩 + 反馈；史实审读。

---

### M5 核心系统 + 6 势力机制（W10–17，35–45 天）

**目标**：外交/军事/经济/AI 各 2–3 层决策；6 个势力各有「只有它能做」的操作。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 5.1 | 外交 2.0 | 关系动作、同盟/联军、军通、单独和平、战争目标、和平会议、coalition | `rules/diplomacy.ts` 新建、`war.ts`、UI | 玩家能组 2 国联军；AI 会背刺 | 8 |
| 5.2 | 军事 2.0 | 水战/封锁/登陆拦截、围城选项、补给、军队质量、AI 战区 | `military.ts`、`naval.ts` 新建、AI | 郑氏能封锁；围城 3 选择 | 10 |
| 5.3 | 经济 2.0 | 贸易节点、建筑、金融、特权、粮食/人口 | `economy.ts`、`trade.ts` 新建 | 不同势力有不同最优经济 | 8 |
| 5.4 | AI 2.0 | 战略/战役/预算/机制使用 | `ai.ts` | AI 会用独特机制 | 5 |
| 5.5 | 机制模板：明 | 朝议/党争：派系、政策票、皇权；UI + 事件 + AI | `systems/partyStrife.ts` 新建、panel | 只有明能开朝议；AI 会用 | 5 |
| 5.6 | 机制：清/顺/南明/郑/蒙古 | 八旗/追赃/正统/海贸/盟旗；各 4–6 人日 | 各 system + panel + events | 每个有 1 个独有操作 | 20 |

**G5 验收**：6 机制全部可玩；每个有 1 个「只有它能做」的操作；AI 至少每 2 年用一次；10 小时试玩无阻断。

**需要你**：每个机制 30 分钟设计 review；史实审读。

---

### M6 UI/UX + 性能（W11–18，25–35 天，可与 M5 并行）

**目标**：新玩家 3 分钟上手；1280×800 可读；Deck 手柄可玩；32x 不卡。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 6.1 | 首启/暂停/设置/帮助 | 4 步引导、目标卡、开始推进、暂停菜单、Esc 栈、F1、设置 | 新组件、`GameShell`、`store` | 5 名新人 ≥4 人 3 分钟上手 | 6 |
| 6.2 | 响应式/字号/颜色 | 断点、右栏可收起、顶栏 5+更多、≥14px、大明红≠危险红 | `styles.css` | 1280×800 无横滚；对比度 ≥4.5 | 5 |
| 6.3 | 键盘/手柄 | 全局热键、焦点陷阱、虚拟光标、省份光标、图标 | `input/` 新建 | 键鼠/手柄各完成前 15 分钟 | 8 |
| 6.4 | 地图脏渲染 | 引擎 revision、分层 dirty、标签池、BitmapFont、箭头缓存 | `MapRenderer.ts`、`MapViewport.tsx` | 占领单省 <16ms；纹理 <150MB | 7 |
| 6.5 | React 性能 | selector/useShallow/memo、派生缓存、滑杆解耦 | `store.ts`、`TopBar`、panels | 单 tick React <4ms | 4 |
| 6.6 | 调度/存档 | rAF 累加器、时间预算、AI 切片、异步存档、暂停停 ticker | `GameShell`、`save` | 32x 无 >50ms long task | 4 |

**G6 验收**：1280×800 可读；Deck 30fps；1080p 60fps；新玩家 3 分钟上手；键盘/手柄可玩。

**需要你**：视觉 review；Deck 真机。

---

### M7 内容 + 英化（W16–23，30–40 天）

**目标**：EA 内容冻结；英文全流程可玩；地图不再有「东/西」后缀。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 7.1 | 事件 | 180–200 条 + 16–18 链；每条 2–4 选项/史实注 | `events/*.yaml` | 审计 0 不可达/死 flag | 15 |
| 7.2 | 国策 | 252 条独特效果/描述；每势力 42 | `focus_packs.yaml` | 无重复 completionEffect | 10 |
| 7.3 | 决议/科技/税法/将领 | 60–72 决议、84 科技、42 税法、90 将领 | 各 YAML | 审计 0；有取舍 | 8 |
| 7.4 | 地图改名 | 480 真实地名 + 河流/关隘；去机械后缀 | `provinces.yaml`、`regions.yaml` | 抽检 50 个地名合理 | 8 |
| 7.5 | i18n 架构 | `t()`、内容 sidecar、日志 key、错误码、Intl | `src/i18n/*` 新建 | 无中文字面量；旧档可回退 | 5 |
| 7.6 | 英化 | 提取 2,500–3,500 key；翻译/审校；布局 QA | `locales/en/*` | 英文全流程无截断 | 12 |
| 7.7 | 美术/音频集成 | 12 领袖、UI kit、地图纹理、8 首 OST、20–30 句 VO | `public/` | 无占位；授权清晰 | 6 |

**G7 验收**：EA 内容冻结；英文全流程；审计 0；地图/头像/音乐无占位。

**需要你**：翻译审校；美术/音频外包管理；史实审读。

---

### M8 Steamworks / Deck / 商店（W20–27，15–20 天）

**目标**：能上架、能云存档、能解锁成就、Deck 可玩、商店页过审。

| # | 步骤 | 动作 | 文件 | 验收 | 人日 |
|---|---|---|---|---|---|
| 8.1 | Steamworks 适配器 | init/mock/离线队列；成就/统计/云/富状态 | `src/platform/steam.ts`、`electron/steam.ts` | 无 Steam 可开发；离线不阻塞 | 5 |
| 8.2 | 构建/depot | electron-builder Win/Linux；steamcmd vdf；分支 internal/beta/default | `electron-builder.yml`、`steam/` | 双平台构建可上传 | 3 |
| 8.3 | Deck | 全屏、挂起恢复、手柄、1280×800、Playable 清单 | `electron/main.ts`、UI | Deck 不触屏 15 分钟 | 4 |
| 8.4 | 商店/合规 | 文案/截图/预告/胶囊规格、定价、IARC、AI 披露、权利链 | `docs/store/*` | 商店 draft 过审 | 4 |
| 8.5 | 崩溃/日志 | crashReporter/Sentry（可选）、诊断包 | `electron/logging.ts` | 崩溃可诊断 | 2 |

**G8 验收**：Win/Linux 构建；云同步；成就；Deck Playable；商店 draft；合规清单全绿。

**需要你**：App ID/后台配置；美术素材；法务审阅；Deck 测试。

---

### M9 Playtest / EA（W24–31，10–15 天）

| # | 步骤 | 动作 | 验收 | 人日 |
|---|---|---|---|---|
| 9.1 | Playtest 构建 | Steam Playtest 分支；200–500 人；问卷/遥测 | 崩溃/卡点/退款意向有数据 | 3 |
| 9.2 | 修 bug/平衡 | 按严重度 triage；每周热修 | 阻断 = 0；评价 ≥75% | 8 |
| 9.3 | Demo/Next Fest | 1627 明 3 年 / 1644 清 1 年；独立 App | Demo 过审；Next Fest 参加 | 3 |
| 9.4 | EA 发售 | 商店页/定价/首发折扣/公告 | EA 上线；退款 <10% | 2 |

**需要你**：招募 testers；社媒/主播；最终发售确认。

---

### M10 1.0（W31–56，60–80 天）

| # | 步骤 | 动作 | 验收 | 人日 |
|---|---|---|---|---|
| 10.1 | 6 势力 | 西/朝/日/藏/荷/俄 + 独特机制 | 12 势力可玩；各有独有操作 | 30 |
| 10.2 | 1650 剧本 | 可玩；与 1627/1644 共用内容 | 三剧本完整 | 4 |
| 10.3 | 内容扩展 | +100 事件、+250 国策、+40 决议 | 1.0 内容量 | 20 |
| 10.4 | 表现补全 | 地图/插图/VO/日韩（可选） | 无占位；本地化 QA | 10 |
| 10.5 | Deck Verified | 手柄 UI/图标/OSK/性能 | Verified 通过 | 6 |
| 10.6 | 1.0 营销/发售 | 愿望单/媒体/主播/发售 | 评价 ≥80%；崩溃 <0.5% | 6 |

**需要你**：外包扩容；市场投入；最终 QA。

---

## 5. 前 10 个工作日（逐日）

| 日 | 我做什么 | 交付/验证 | 需要你 |
|---|---|---|---|
| D1 | 读 `initial.ts`/`history.ts`/`focusPacks.ts`/`economy.ts`；写 `docs/decisions-log.md`、`progress.md`；确认 §0 默认 | 决策记录 + 进度板 | 确认 B/A/C 与 10 个默认 |
| D2 | 写 `scripts/audit-content.ts`；跑 tsc+node；记录 323/13/77；写场景矩阵探针 | 审计基线 + 场景矩阵输出 | 无 |
| D3 | 写平衡/性能探针；跑 20 年/1/5 年；记录 99s/8–13.6ms | 基线报告 | 无 |
| D4 | `assetUrl()` + `base:'./'`；替换 `/audio`；grep 验证 | 无绝对路径 | 允许改 `vite.config.ts` |
| D5 | Electron 壳（main/preload/security）；`electron:dev` 跑通 | 窗口打开游戏 | 批准安装 Electron 或你本地装 |
| D6 | 文件存档 IPC + 迁移；`userData` 验证 | 存档/读档/旧档 | 你跑一次构建（或我提权） |
| D7 | 字体子集 + `@font-face` + Pixi 统一；日志/ErrorBoundary | 字体一致；崩溃有日志 | 确认字体授权（OFL） |
| D8 | 删除初始化 `applyHistoricalTimeline`；写 `tests/scenario.test.ts`；修 1644 | 1644 选清有明/顺/战争 | 史实确认 |
| D9 | 修 1650（郑氏 30 省/战争）；历史替换设计文档 | 场景矩阵一致 | 史实确认 |
| D10 | 修正注册表 + `corruption_drift` 批量改名；CI 接入 audit；周报 | 注册表/CI/周报 | 审阅，决定是否进 M3 |

> 如果 D5/D6 的 Electron 安装/构建被沙箱阻断，我会在第 4 天一次性申请提权；若仍不行，就由你本地跑 `pnpm electron:build`，我根据报错修。

---

## 6. 每个步骤的完成定义（DoD）

一个步骤只有同时满足以下 5 条才算「完成」：

1. **代码/内容**：改动集中在目标文件；无 `any`、无 `Math.random`（引擎）、无硬编码中文进入引擎逻辑。
2. **类型**：`pnpm typecheck` 0 错误（或 tsc 等价命令）。
3. **审计/测试**：`pnpm audit:content` 通过；对应探针/单测有前后对比数据。
4. **可玩**：`pnpm dev`（或 Electron）能启动；目标功能可手动验证；无新增阻断。
5. **记录**：`docs/progress.md` 更新（改了什么/证据/遗留/需要你）；commit 信息带步骤 ID。

> 任何一条不满足，我会标「未完成」并说明原因，不混进下一个步骤。

---

## 7. 质量门（Gate）

| Gate | 时间 | 必须全部满足 | 不满足怎么办 |
|---|---|---|---|
| G0 | W1 | 基线/审计/决策/CI | 不进入 M1 |
| G1 | W3 | Windows/Deck 可启动；存档/字体/日志 | 先修桌面化，不扩内容 |
| G2 | W4 | 场景矩阵一致；1644/1650 修好 | 不进入 M3 |
| G3 | W7 | 审计 0 无效；13 科技/77 国策有效 | 不进入 M4 |
| G4 | W11 | 20 年模拟可信；无传送/僵尸 | 不进入 M5 扩张 |
| G5 | W17 | 6 机制可玩；10h 试玩无阻断 | 砍范围（先 EA 4 势力） |
| G6 | W18 | 1280×800/Deck/键鼠手柄/60fps | 不冻结内容 |
| G7 | W23 | EA 内容冻结；英文全流程 | 推迟 EA，不做 1.0 |
| G8 | W27 | 构建/云/成就/Deck/商店 draft | 推迟发售 |
| G9 | W31 | EA 上线；崩溃/退款达标 | 热修后再宣发 |
| G10 | W56 | 12 势力/评价/Deck Verified | 延后 1.0，不硬发 |

---

## 8. 验证矩阵

| 层 | 我跑 | 你跑/CI 跑 | 频率 |
|---|---|---|---|
| 类型 | `pnpm typecheck` / tsc | CI | 每步 |
| 内容 | `pnpm audit:content` | CI | 每步 |
| 场景矩阵 | `tsc` + Node 探针 | CI | 每步 |
| 平衡 | 20 年探针 | CI 夜间 | 每周 |
| 单测 | 写用例 | `pnpm test` | 每 PR |
| 构建 | 写配置 | `pnpm build` / electron-builder | 每 Gate |
| E2E | 写 Playwright | CI | 每 Gate |
| Deck | 清单/脚本 | 你 | 每 Gate |
| Steam | mock/适配器 | 你 | G8/G9 |
| 本地化 | 伪本地化/截图 | 你/翻译 | G7 |
| Playtest | 分析数据 | 你招募 | M9 |

---

## 9. 可能的阻塞与应对

| 阻塞 | 概率 | 我怎么做 | 需要你 |
|---|---|---|---|
| 沙箱禁止 vitest/build | 高 | 用 tsc + 探针；Gate 前申请一次性提权；或你本地跑 | 批准/本地执行 |
| Electron 下载/安装失败 | 中 | 写配置；你本地 `pnpm add -D electron`；我修 | 网络/安装批准 |
| Steam App ID 未就绪 | 中 | mock 适配器；`steam_appid.txt` 480 | 注册/提供 ID |
| Deck 真机不可用 | 中 | 先 Windows/Playwright 模拟；清单给你 | Deck 测试 |
| 美术/音频延期 | 高 | 先用占位；接口/尺寸/风格先定；不阻塞代码 | 外包管理/预算 |
| 英化延期 | 中 | 先 pseudolocale/机翻草稿；人工审校后替换 | 翻译预算 |
| 史实争议 | 中 | 参考书目/免责声明/中性命名；可关闭史实注 | 审读/法律意见 |
| 范围膨胀 | 高 | Gate 砍范围；先 EA 6；不追 12 到最后 | 拍板 |
| 单人疲劳 | 高 | 每周 Demo/进度可见；外包分担；不连续熬夜 | 节奏/预算 |

---

## 10. 如果选 A 或 C，计划怎么变

### A. 12 势力一次交付 1.0

- M5 扩到 12 机制：+6 势力 × 5–8 人日 = +30–48 人日；M7 内容 ×2；M10 取消。
- 总工期 +4–6 个月；需要第二内容设计/QA；首发口碑风险高。
- 建议至少「4 深 + 8 轻」：明/清/顺/郑深，其余 8 个各 1 个轻机制。

### C. 1.0 直接 8 势力（不做 EA）

- 跳过 M9 EA；M10 缩到 8 势力；总工期 W31–48。
- 没有 EA 收入/反馈；首发热度风险更高；需要更强的 Demo/Next Fest。
- 适合：不想维护两个分支、对内容完成度有把握。

### 选 B（默认）

- 按本文件执行；EA 6 势力，1.0 12；两次发行、两次曝光；用 EA 反馈修 M4/M5。

---

## 11. 我现在需要你提供的 6 件事

1. **范围拍板**：B（EA 6→12，推荐）/ A（12 全量）/ C（8 势力 1.0）。
2. **权限**：允许我安装 Electron/依赖、跑构建/测试（或你本地跑并在 Gate 提供结果）。
3. **Steamworks**：注册合作伙伴账号/App ID（可后补；先给我 App ID 做 mock）。
4. **硬件**：一台 Windows + 一台 Deck（或至少 Deck）在 G1/G6/G8 做验收。
5. **外包预算**：美术/音频/翻译的最低预算与决策人；没有就先做占位。
6. **史实审读**：每周 2–4 小时，审 1644/1650 开局、20–30 条关键事件、12 势力机制。

---

## 12. 第一周交付物（我承诺）

- `docs/decisions-log.md`：10 个决策 + 你的确认。
- `docs/progress.md`：基线数字、每日进度、阻塞。
- `scripts/audit-content.ts`：可复现 323/13/77 的审计。
- `scripts/dev/scenario-matrix.ts`：可复现 1644/1650 不一致。
- `scripts/dev/balance-report.ts`：20 年模拟报告。
- `scripts/dev/perf.ts`：内容加载/tick 基线。
- `.github/workflows/ci.yml`：typecheck/lint/test/validate/audit/build。
- `vite.config.ts` + `src/app/assets.ts`：资源路径修复（若 D4 前完成）。
- 第一份周报：完成了什么、证据、下周计划、需要你什么。

---

## 13. 一句话

**我会把「先证明、再改、每步可回滚」作为默认工作方式：先用探针把 1644/1650、323 处空转、经济/AI 僵局钉死，再按 M1→M10 一步步修；每个 Gate 由你验收，不合格不进入下一阶段。**

如果你同意按 B 走，我下一步就做 D1–D2：写决策记录、内容审计脚本、场景矩阵探针，先把「哪里坏了」变成可复现的数字。你只需要回一句「按 B 开始」或指出要改的默认项。
