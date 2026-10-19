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
