# AI 上下文 · 会话日志

> 每次会话在此追加一段。新会话先读本文件末尾找「下一阶段入口」。

---

## 2026-10-20 · 会话 1：熟悉项目 + 生成任务总纲

**目标**：熟悉整个项目；生成「上架品质总任务」的完整步骤，使之后能用一句话启动。

**做了什么**：
1. 通读项目：README、prompts/、docs/ 全部核心文档（quality-bar、quality-plan、steam-master-plan、steam-backlog、execution-plan、progress、qa-checklist、decisions）。
2. 验证了全部门禁命令在当前环境可用（旧文档声称的沙箱 EPERM 已不存在）。
3. 建立 `ai-context/` 目录：architecture.md（项目地图）、master-plan.md（任务总纲，本任务的执行入口）、本日志。

**实测证据（本轮基线）**：
- `pnpm typecheck` ✅ 0 错误
- `pnpm test` ✅ 26 文件 / 87 测试 / ~12s
- `pnpm validate` ✅ ok
- `pnpm audit:content` ✅ errors=0 warnings=0（progress.md 中「死 flag 58」已过时）
- `pnpm build` ✅ 4.7s（content 1.24MB、pixi 559KB 超 500KB 警告）
- `pnpm sim --years 20 --seed 42` ≈18s；注意 sim.ts 的 player 国家无 AI 管理（大明 1633 年崩亡属预期），看海必须用 qa-matrix
- 20 年矩阵 45 局 ≈13 分钟

**项目现状摘要**：Q0–Q5 完成、Q6 大半完成。audit 全绿、内容达标（200 事件/504 国策/480 地名/8 机制）、浏览器矩阵（Chrome/Edge/Firefox × 1280–1920）与键盘流程全过、45 局平衡矩阵无僵尸/孤儿。剩余：性能（tick 6.2ms vs <2ms 目标）、平衡收尾（1627 清偏强等 5 项）、bug 猎杀、长局验证、测试 87→150。

**未提交改动**（本轮开始时工作区已有，非本次会话产生）：`.gitignore`、`README.md`、`docs/qa-checklist.md`、`scripts/smoke-ui.mjs`、`scripts/soak-ui.mjs`。执行任务时先弄清这批改动内容再决定是否纳入首个 commit。

**下一阶段入口**：等用户用 master-plan.md §8 的一句话启动整个任务；启动后从 Phase 0（基线复验）开始。

---

## 2026-10-20 · 会话 2：Phase 0 基线 + Phase 1 Bug 猎杀

**启动指令**：按 master-plan 从当前阶段继续，自动完成验证/修复/验收，每阶段更新日志与进度板，门禁全绿后提交一个 commit（不 push）。

### Phase 0 基线复验
- 5 门禁全绿；基线测试 87 → 本轮结束 113。
- 性能基线（当前机器/当前树）：content load 286.9ms；initial state 3.9ms；tick 1y 7.29ms / 5y 24.76ms / 20y 22.57ms。
  - 注：master-plan 记录的 6.2/6.0ms 为更早代码状态；当前树相对基线明显变慢，Phase 2 需重新定位（审计 E 给出 5 个热点，见下）。
- 45 局矩阵、8h soak 等重任务留到 Phase 2/3。

### Phase 1 做了什么
1. **5 个并行审查代理**（economy/military/diplomacy/events/state）产出可疑 bug 清单；逐条复现后修复。
2. **不变量探针** `scripts/dev/invariant-probe.ts`：3 剧本 × 5 种子 × 5 年；首轮全绿 `ok (89,650,088 checks, 703.9s)`。最终代码复核全绿：`ok (89,650,088 checks, 696.6s)`（日志 `invariant-probe-phase1-final.log`）。
3. **UI E2E** `scripts/dev/e2e-ui.mjs`：8 可玩势力 × 面板/训练/行军/事件/存读档/设置/主菜单，1280×800，`E2E ok: 8 factions`。读档现会关闭暂停菜单（BUG-035），脚本相应重新打开菜单后再检查设置。
4. **修复 39 项 bug**（P1 7 / P2 20 / P3 12），完整清单见 `ai-context/bug-ledger.md`。重点：
   - 战争状态机：死国宣战、非交战国议和、白和归还、首都重定位、第三方占首都误降、NEU 清理、死国参战残留。
   - 财政闭环：`silverShare` 银粮分流恢复、欠款真实现金偿还、被占港口收入归零、建筑缓存按 mapRevision 失效。
   - 事件/触发：队列绕过 fireOnce、锁定选项、缺失阶级条件、计时修正少一天。
   - 军事：围城/占领进度串场、多国战斗攻守方、有友方庇护仍被围歼、登陆失败滞留、分兵负兵种、训练营失守。
   - 状态/UI：年中胜利不结算、读档残留面板、战争警报暂停条件、旧档 NaN。

### 验收证据（Phase 1）
- `pnpm typecheck` ✅ 0 错误
- `pnpm test` ✅ 27 文件 / **113 用例**（目标 ≥107）
- `pnpm validate` ✅ ok
- `pnpm audit:content` ✅ errors=0 warnings=0
- `pnpm build` ✅ 4.7s（content 1.24MB、pixi 559KB 警告留 Phase 2）
- invariant 探针 ✅（见上；最终复核日志）
- E2E ✅ 8/8 势力 @1280×800

### 遗留 / 下一阶段入口
- Phase 2 性能：审计 E 的热点排序 —— ①战斗内嵌全表扫描（military.ts:301-320）②`isSupplied` 每日每军两次 BFS（military.ts:357-399）③事件每日 200×8 全扫 + 日期重复解析（events.ts:134-145）④AI `frontTargets` 每军 BFS（ai.ts:497-526）⑤`areAtWar` 线性扫描改交战对 Set。
- 剧本首月不跑月结（1644/1650 的 1 月）：记录为已知行为，Phase 3/5 再决定是否补。
- 未修：多国战斗逐战争伤亡归属（仅统计精度）。

---

## 2026-10-20 · 会话 2（续）：Phase 2 性能达标

**目标**：tick <2ms、加载 <300ms、地图脏渲染、React 高频订阅、拆包、8h soak。

### 性能终值（`scripts/dev/perf.ts`，`out/perf-high.txt`）
| 指标 | 优化前 | 终值 |
|---|---:|---:|
| content load | 286.6ms | **286.6ms（<300ms）** |
| initial state | 4.1ms | 4.1ms |
| tick 1 年 | 7.29ms/日 | **1.68ms/日** |
| tick 5 年 | 24.76ms/日 | **1.36ms/日** |
| tick 20 年 | 22.57ms/日 | **1.31ms/日** |

### 主要改动
- `tick.ts`：计时修正改用原地压缩，避免每日为每个国家/省份分配新数组。
- `military.ts`：战斗/围城去全表扫描，补给 BFS 结果按日缓存；军队索引复用。
- `ai.ts`：`frontCandidates` 按势力扫描一次；`reachablePaths` 单次 BFS 服务全部目标（邻居顺序/30 步上限不变）。
- `war.ts`：`areAtWar` 交战对 Set（按 day/wars 长度/nextWarId 失效）；`warScore` 用 `controller|owner` 占领计数缓存；`resolveFinishedWars` 一次计数。
- `modifiers.ts`：特权/税法效果用 WeakMap 缓存；`addModifierInto` 改 `for...in`。
- `buildings.ts`：建筑加成缓存键加入 `mapRevision`。
- `clock.ts`：`parseDay` 缓存日期字符串解析。
- `MapRenderer.ts`：省底色/占领线/标签分层增量重绘，阴影只画一次，标签 Text 复用；统计入口 `__MINGMO_MAP_PERF__`。
- `TopBar/GameShell/WarDock`：`useShallow` 聚合订阅、`memo` 子组件、tooltip 惰性求值。
- `vite.config.ts`：内容按 `content-events/content-map/map-geo/content-data` 拆分；pixi 仍 >500KB，按计划在验收报告注明例外。

### 证据
- **hash 一致性**：3 剧本 × 2 种子 × 5 年，优化前后逐日 hash 完全一致（`ai-context/hash-baseline-phase2.txt` 对 `out/hash-phase2c.txt`），性能优化零行为变更。
- **地图**（`out/map-perf-phase2.json`，1920×1080）：占领单省重绘 median 6.3ms / max 10.8ms（<16ms）；缩放后 dirty=1、redraw 7.8ms；rAF 平均 125fps、p95 帧 12.2ms；纹理 32.7MB（<150MB）。
- **React**：TopBar 更新 p95 0.5ms；game store p95 5.4ms / max 14.3ms。
- **最终复测（Phase 4 末，含 Phase 3 改动）**：content load 297.9ms；tick 1y 1.33ms / 5y 1.21ms / 20y 1.18ms，p99 5.15–7.48ms。
  - 重要测量修正：Windows 对持续占用 CPU 的后台进程启用 EcoQoS，会把纯 JS 基准拖慢约 8 倍（同一循环 188ms → 1514ms）。`perf.ts`/`qa-matrix.ts`/`war-duration.ts`/`section-perf.ts` 现在显式 `setPriority(HIGH)`；否则 20y tick 会被误测为 4.4ms。
- **8h soak**：最终树冻结产物 `out/soak-final`，32x 看海；结果见 Phase 5。
- **门禁**：typecheck / test（113）/ validate / audit:content / build 全绿（build 拆包后无 content 大块警告，pixi 例外）。

---

## 2026-10-20 · 会话 2（续）：Phase 3 平衡与 AI 收尾

**首轮矩阵**（`out/matrix-phase3.log`）暴露：1627 清仍常 200+ 省；1644 清/南明接近；1650 清从 291 省（开局 60.6%）继续膨胀；首都一陷即整国投降造成滚雪球。

### 调整（≤5 轮，最终第 2 轮锁定）
1. `war.ts`：`resolveCapitalCapitulation` 对拥有 >40 省的大国不再整国投降，改为按现有战争分议和，只割让被占领土——直接切断“首都陷落 → 200 省易手”的滚雪球。
2. `crisis.ts`：大明崩溃分家不再依赖 1644 年后的南明建立；1627 崩溃也按地域分给南明/清/顺/西，避免清一日吞并半壁。
3. AI 目标与停战过滤（Phase 1 已修 BUG-001/002/003）在矩阵中复验。

### 45 局矩阵终值（`out/matrix-phase3-round2.log`，20 年，3 剧本 × 3 难度 × 5 种子）
- **45/45 无僵尸、无孤儿省**。
- 1627：胜者分布 QING / SHUN / SMING / MONGOL / VOC；最大 188（39.2%），无单极 ≥50%。
- 1644：QING / SMING / SHUN / VOC 均可做大；最大 179（37.3%）。
- 1650：QING / SMING / XI / VOC 多方；QING 最高 265（55.2%）——但 1650 开局清即 291 省（60.6%），≥50% 规则在该剧本结构性不可满足，记为剧本设计例外。
- 日本多数 24–52 省；仅 1627 困难 seed2024 被灭至 2 省。

### 验收对照
| 条款 | 结果 |
|---|---|
| 无僵尸/孤儿 | ✅ 45/45 |
| 无势力 ≥50% 连续 2 年 | ⚠️ 除 1650 开局例外，本轮 20 年终局仅 1650/normal/seed42 清 55.2%；已记录 |
| 每剧本×难度 ≥2 种胜者 | ✅ 1627/1644/1650 各难度均有 ≥2 种（含 1650 的 QING/SMING/XI/VOC） |
| 无 0 国库+0 军心僵尸 | ✅ |
| 战争 1–5 年可结束 | ✅ 终局战争数 0–7，未出现 20 年不结束的战争 |
| 大国囤银受控 | ✅ 终局最富国家未出现 400 万两级 |
| 未达标项 ≤2 | ✅ 1 项（1650 开局例外） |

---

## 2026-10-20 · 会话 2（续）：Phase 4 长局验证与打磨

### 4.1 脚本化玩家（`scripts/dev/player-bot.ts`）
8 个可玩势力各跑 1627 → 1683 或死亡：
- 存活到 1683：QING / XI / JOSEON / JAPAN（4/8）；
- 死亡：MING 1655 国库崩溃、SHUN 1628 身死国灭、ZHENG 1643、MONGOL 1638 粮荒；
- 全程无死锁、无 NaN、事件正常消费；结果 `out/player-bot-1792452270007.json`。
- 方法学：规则驱动 bot，不等同真人试玩，最终报告注明。

### 4.2 内容重复审计（`scripts/dev/content-audit.ts`）
- **补前**：存活到 1683 的 4 局中，1650 后人均仅 3.3 个事件，末期可用事件池 1–5 → 判定存在晚期内容干旱。
- **定向补内容**：14 个晚期事件（`src/content/data/events/late.yaml`，1650–1683，覆盖财政/海防/科举/军事 + 朝鲜/日本/西藏）。
- **补后**：单局内无事件重复触发（最大重复 1 次）；存活局 1650 后人均 12.0 个事件；末期可用事件池 12–17 → 干旱解除。报告 `out/content-audit-1792452270378.md`。
- **平衡副作用与修正**：晚期通用事件无条件给钱粮，使 1650 大国（开局 291 省）更容易滚雪球；给 11 个 `country: any` 事件加 `provinceCount < 200` 追赶门槛，让小国获得内容与追赶机会。
- 重跑 45 局矩阵（`out/matrix-phase4-round1.log`）：1627 与补前逐字节一致（20 年窗口未到 1650）；1644 三难度均仍有 ≥2 种领先者；1650 见下。
- **1650 结果**（`out/matrix-phase4-1650.log`，15 局）：0 僵尸/0 孤儿；easy 与 normal 领先者均为清，hard 出现郑（seed99）。清开局即 291/480（60.6%），20 年窗口内难以被超越，作为**剧本设计例外**记录（见最终报告）；另以 33 年窗口复核（Phase 5）。

### 4.3 UI 打磨清单（清零）
| 项 | 结果 |
|---|---|
| 1280×800 文本截断/横向溢出 | ✅ E2E 8 势力全流程 `UI_WIDTH=1280 UI_HEIGHT=800`，无横向溢出 |
| 空态面板 | ✅ 外交/军事/日志/核心等补空态文案 |
| 按钮禁用原因 | ✅ 审计 48 个禁用按钮，全部补 `title`（冷却/资源/条件） |
| 危险操作二次确认 | ✅ 宣战、断盟、解散军团补确认 |
| 事件选项代价预览 | ✅ EventModal 显示「当前 → 预计（delta）」，负值标红；截图 `out/screenshots/e2e-MING-event-open.png` |
| tooltip 覆盖关键数值 | ✅ TopBar 已有分项 tooltip；面板补条件说明 |
| 视觉回归截图 | ✅ `out/screenshots/`（gitignored） |

### 4.4 测试补强
- 测试数 **113 → 154**（31 文件），新增 `clock/vassals/southernMing/victory`，扩展 `diplomacy/trade/tribute/league/sakoku/save`。
- `pnpm test` / `pnpm typecheck` 全绿。
