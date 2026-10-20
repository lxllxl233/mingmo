# 项目架构速查（AI 上下文）

> 本文件是给后续 AI 会话的「项目地图」，避免每次重新探索。由 2026-10-20 会话建立并验证。
> 配套：[master-plan.md](master-plan.md)（任务总纲）｜ [session-log.md](session-log.md)（会话日志）

## 1. 项目一句话

《明末 华夏震荡》——浏览器单机大战略游戏（玩法参考 HOI4）。1616–1683，日 tick，四档速度。
12 势力（8 可玩：明/清/顺/南明/郑/蒙古/朝鲜/日本 + 4 AI-only：西/西藏/荷兰/沙俄），3 剧本（1627/1644/1650）。
480 地区 / 160 府 / 30 大区。8 阶级 + 税法。国策树、事件链、科研、财政、军事、外交、势力 AI。
技术栈：TypeScript strict + Vite + React 18 + PixiJS 8 + Zustand 5 + zod + yaml + Vitest + Playwright。

## 2. 架构边界（不可违反）

- `src/engine/`：纯逻辑（规则/模拟/状态），**不得 import react/pixi**。有架构测试守卫（tests/architecture.test.ts）。
- `src/content/`：内容数据 + schema（YAML → zod 校验 → 类型化加载）。
- `src/ui/` + `src/map/` + `src/app/`：界面、地图渲染、装配。
- 所有内容效果必须经 `src/content/modifierRegistry.ts` 注册；`pnpm audit:content` 检查 0 无效 key/死 flag/重复国策/不可达引用。
- 引擎随机一律用 `src/engine/core/rng.ts`（种子化），**不用 Math.random、不写 any**。
- 新文件 ≤400 行（既有大文件除外）；一轮修改 ≤5 个文件（建议）。

## 3. 目录地图

| 路径 | 内容 |
|---|---|
| `src/engine/core/` | clock（日历）、rng（种子随机） |
| `src/engine/state/` | types、initial（开局）、hash（状态哈希） |
| `src/engine/rules/` | modifiers、triggers、effects、war、diplomacy、naval、vassals、access、geography、armyTemplates、generalTraits |
| `src/engine/systems/` | 21 个系统：ai、banners(八旗)、buildings、confiscation(追赃)、core、court(朝议)、crisis、economy、events、focus、league(反雪球联盟)、legitimacy(正统)、military、politics、research、sakoku(锁国)、southernMing、tax、trade、training、tribute(事大) |
| `src/engine/tick.ts` | 日推进调度（135 行，按日/月/季/年分发到各系统） |
| `src/engine/victory.ts` | 胜利判定 |
| `src/content/data/` | YAML：countries、scenarios(3)、events(3 个 timeline + 机制事件)、focus_packs、techs×2、tax_laws、estates、generals、leaders、army_templates、buildings、balance、map |
| `src/content/loader/` | node.ts（Node 加载）、parse、normalize、validate、focusPacks、geo |
| `src/ui/shell/` | App、GameShell、StartScreen、TopBar、OnboardingOverlay、PauseMenu、SettingsModal、HelpOverlay、MapViewport、SpectatorShell、MusicControl |
| `src/ui/panels/` | 30 个面板：国策/科研/军事/外交/阶级/贸易/朝贡/八旗/朝议/正统/追赃/锁国/战争坞/事件等 |
| `src/ui/overlays/` | EventModal、TrainingModal、EndModal、WarAlertModal、EventArt |
| `src/map/render/MapRenderer.ts` | Pixi 地图渲染（1958 行，Q3 只做了部分，脏渲染待做） |
| `src/app/save/` | 存档 v6+ 迁移 + 多槽（auto/manual/slot1..3）+ 校验和 |
| `src/app/audio/` | 音乐（2 首原创 WAV + CC BY 曲目）、音效，音乐/音效音量分离 |
| `tests/` | 26 个文件 / 87 用例（Vitest） |
| `scripts/` | sim（无头模拟）、validate、audit-content、gen-map、smoke-ui（Playwright）、soak-ui、dev/（qa-matrix、perf、balance-report、scenario-matrix、probe-*） |
| `docs/` | quality-bar（9 条验收标准，权威）、quality-plan、steam-master-plan、steam-backlog、execution-plan、progress、qa-checklist、decisions、how-to-play、art-direction |
| `out/` | 生成物（矩阵 JSON、screenshots、csv），**gitignored** |
| `prompts/` | 最初的分层构建提示词（历史产物，任务中只读不改） |

## 4. 命令矩阵（2026-10-20 实测全通，旧文档的沙箱 EPERM 已不存在）

| 命令 | 结果 |
|---|---|
| `pnpm typecheck` | ✅ 0 错误（~秒级） |
| `pnpm test` | ✅ 26 文件 / 87 测试，约 12s |
| `pnpm validate` | ✅ ok |
| `pnpm audit:content` | ✅ errors=0 warnings=0（含死 flag/重复国策/hasAdvisor/未知引用） |
| `pnpm build` | ✅ 4.7s；JS 1.89MB；content 1.24MB / pixi 559KB 两个 chunk 超 500KB（警告） |
| `pnpm dev` / `pnpm preview` | 本地起服（127.0.0.1:5173） |
| `pnpm sim --years 20 --seed 42` | ≈18s；注意：**player 国家无人管理**（仅自动选事件），会自然崩亡（1627 大明无操作 1633 年亡，属预期）；看海/矩阵必须用 qa-matrix（player=NEU 之类，全部国家由 AI 管理） |
| `pnpm exec tsx scripts/dev/qa-matrix.ts --years 20 --scenarios 1627,1644,1650 --difficulties normal,hard,easy --seeds 42,7,99,123,2024` | 45 局矩阵，每局约 18s |
| `pnpm exec tsx scripts/dev/perf.ts` | tick/加载性能探针 |
| `pnpm smoke:ui` | Playwright UI smoke（Chrome，截图出 out/screenshots/） |
| `node scripts/soak-ui.mjs` | 浏览器 soak（默认 10 分钟，可加长做 8h） |

## 5. 关键机制速记

- **明末压力**：countries.yaml 给大明 `pressure`（月耗银/每省耗银/稳定/腐败/民怨月变化）——结构性失血，不是事件。
- **南明建立**：1644 北京失守后 AI 大明的南方由南明继承（systems/southernMing.ts）；崩溃分家按地区分给南明/清/顺/西。
- **反雪球联盟**：某国 ≥38% 省份时其他 AI 优先宣它（systems/league.ts）；日本/朝鲜不参与。
- **清入关**：`QING_e_entry_1` 事件窗口到 1644-02-28，1644 开局可触发。
- **围城四法**：围困/强攻(×2.4 速)/炮击(需炮兵)/招降(耗银)。
- **水战最小闭环**：登陆敌方港口、舰队封锁扣税（每港 4% 上限 35%）。
- **债务危机**：arrearsMonths>1 判定（不被月度回血重置），6/12 月欠饷加重惩罚，365 日崩溃。
- **AI**：月度预算（军队/建筑/赈济/外交/储备 8–12 月支出）；难度只改决策质量，不作弊。
- **存档**：v6 + 迁移 + decodeSave hash 校验；自动存档每年 `auto` 槽。
- **历史模式**：无传送（Q1 已删 applyHistoricalTimeline）；历史靠条件事件 + AI 目标权重。

## 6. 当前状态（2026-10-20 · 通过）

Q0–Q6 完成，Phase 1–5 通过：AI 可验证维度全部达标，8h soak 以 2.73h 部分证据经用户接受为例外。最终证据见 `docs/final-report.md`、`docs/qa-checklist.md`，真人移交见 `docs/handoff.md`。

- ✅ 系统可信：audit 0/0；不变量探针 8965 万次检查全绿
- ✅ 内容：214 事件 / 504 独特国策 / 480 真实地名 / 8 势力机制 / 3 剧本
- ✅ 平衡：45/45 无僵尸/孤儿；1627 最大 39.2%、1644 35.2%、1650 66.7%（剧本例外）；战争 0 场 >5 年
- ✅ UI：Chrome/Edge/Firefox 矩阵、8 势力 E2E、打磨清单清零
- ✅ 性能：tick 1.18–1.33ms/日、加载 297.9ms、地图 rAF 125fps；8h soak 2.73h 部分证据经用户接受为例外
- ✅ 测试：154（目标 150+）
- ⚠️ 移交真人：10 人外测、30h 试玩、史实审读、美术/音频评审、发行决策

**技术债/已知项**：1650 easy/normal 单极（剧本设计例外）；后期囤银最高 894 万两；逐战争伤亡归属（统计精度）；1644/1650 首月不跑月结；pixi 559KB chunk 例外。

## 7. 红线与工作约定

- **红线（必须问用户）**：删除文件/目录、改 .env/密钥/CI 配置、git push/rebase/reset --hard、公开发布。
- 不自动 commit（除非用户在启动句里明确授权）；commit message 简洁英文，带阶段 ID。
- 默认中文回复；结论先行。
- UI 截图统一落 `out/screenshots/`（gitignored），不写回仓库根。
- 平衡/矩阵结果落 `out/*.json`（gitignored）；结论写进 docs/qa-checklist.md。
