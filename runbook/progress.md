# 执行进度（跨会话续跑点）

> 会话开始读本文件找「下一阶段入口」。每 Phase 结束追加：做了什么 / 证据 / 遗留 / 下一阶段入口。

---

## 当前状态摘要（2026-10-20 本会话）

- **门禁基线**：五门禁全绿 — `typecheck` 0 错误、`test` 31 文件 156 用例（+2 回归）、`validate` ok（214 事件/504 国策/84 科技/86 将领）、`audit:content` 0/0、`build` 成功。
- **Phase 0 完成**：以浏览器自动化「亲自玩」（文本转储 + 截图 + 决策记录）跑 MING/ZHENG/JAPAN，产出初始 bug 账本 + 过时文档清单。
- **Phase 1 基本完成**：修复 7 个 bug（BUG-001~007），补 2 个回归测试，8 势力 E2E 无 error/溢出；另实测 4 个「AI-only」势力可启动但缺独特面板（BUG-006）。
- **Phase 2 进行中**：已移除 `late.yaml` 的 `provinceCount<200` 门槛（BUG-008）；正在跑 1650 矩阵测单极/囤银基线。
- **下一步**：等 1650 矩阵结果 → 依证据做 1650 追赶路径（2.2）与囤银加强（2.3）→ 45 局矩阵固化（2.4）→ Phase 3。

---

## Phase 0 — 真实基线（已完成）

### 做了什么

1. 起 `pnpm dev`，用 Playwright + Chrome 以玩家身份走通 MING 完整路径。
2. 写了 `scripts/dev/play-dump.mjs`：把每个屏幕玩家真正读到的文字抓下来（剧本→势力→顶栏→8 面板→独特面板→事件），输出 `out/play-dump-*.txt` + `out/screenshots/play-*.png`。本环境无法直接查看 PNG，我用文本转储替代「看图」。
3. 三势力差异实录（开局顶栏）：
   - **明**：银 60.0万/粮 60.0万/人口 8440.0万/兵源 18.0万/稳定 36/天命 55/欠饷 0；14 军团；3 场战争。
   - **郑**：银 8.4万/粮 6.0万/人口 21.4万/稳定 60/天命 25；独特「海贸网络」（商埠 0/6）。
   - **日**：银 40.3万/粮 40.0万/人口 940.0万/稳定 65/天命 30；独特「锁国」。
4. 核对文档 vs 代码，产出过时文档清单（已全修，见 bug-ledger BUG-004/005/006）。

### 证据

- `out/play-dump-{MING,ZHENG,JAPAN}.txt`、`out/screenshots/play-*.png`
- 门禁实测输出

---

## Phase 1 — 真人视角 bug 猎杀（基本完成）

### 已修复（见 bug-ledger 详情）

- BUG-001 顶栏「粮」tooltip「控制省份」显示省数却除府数（310/160）。
- BUG-002 分配面板「温饱 600000 个月」（÷0）。
- BUG-003 分配面板首日经济数字全 0 无说明。
- BUG-004 文档 `how-to-play.md` 字面 `\n` ×2。
- BUG-005 文档 `how-to-play.md` 数字过时（事件/测试/将领）。
- BUG-007 战争首日「投降倾向 42%」（基值 42→10，纯 UI）。
- 新增回归测试：`tests/war.test.ts` +2（投降倾向低基线 / 失首都后升高）。

### 遗留

- BUG-006（范围口径：4 个「AI-only」势力可选但缺独特面板）——**需用户决策**，见下。

---

## Phase 2 — 平衡去 hack（进行中）

### 已完成

- **2.1 移除 `late.yaml` 内容门槛**（BUG-008）：去掉全部 11 条 `provinceCount: { lt: 200 }`，晚期事件对大国开放；`pnpm validate` ok。

### 进行中 / 待办

- **2.1 移除 late.yaml 门槛**：✅ 完成（BUG-008）。
- **2.2 1650 追赶路径**：1650 矩阵基线已测出（见下），待设计追赶路径。
- **2.3 囤银受控**：第一轮改善但未达标（BUG-010）：郑氏最高囤银 1040万→665万，多数局 360–520万；0 僵尸/孤儿仍成立。根因是海贸势力收入规模 + AI 支出不足，需下一轮（收入审计 + 强化 AI 消耗）。
- **2.4 45 局矩阵固化**：`pnpm exec tsx scripts/dev/qa-matrix.ts`。

### 1650 矩阵基线（3 难度 × 3 种子 × 33 年，改前）

| 难度/种子 | 版图 top | 最富（囤银） |
|---|---|---|
| easy/42 | QING:204 ZHENG:84 TIBET:80 | ZHENG:583万 |
| easy/7 | QING:239 JOSEON:76 ZHENG:54 | ZHENG:338万 |
| easy/99 | QING:189 TIBET:89 ZHENG:85 | ZHENG:793万 |
| normal/42 | QING:265 NEU:81 ZHENG:75 | ZHENG:491万 |
| normal/7 | QING:171 TIBET:87 VOC:81 | VOC:449万 |
| normal/99 | QING:184 ZHENG:133 NEU:114 | **ZHENG:1040万** |
| hard/42 | QING:146 TIBET:131 NEU:73 | VOC:228万 |
| hard/7 | **ZHENG:183** TIBET:139 QING:48 | ZHENG:963万 |
| hard/99 | **TIBET:159 ZHENG:138** QING:94 | ZHENG:943万 |

结论：**1650 单极在 easy/normal 仍成立（清 6/6 居首）**，hard 则清被围攻至崩溃（反雪球 hack 在起作用）；**囤银普遍失控**（郑/荷 500–1000 万）。0 僵尸 / 0 孤儿全 9 局成立。

---

## Phase 3 / 4 / 5 — 待执行（见 master-plan）

- Phase 3：事件 flag 长线后果（每势力 3–5 条关键事件链）+ AI 策略性（兵力集中/记仇/制海权）。
- Phase 4：首 5 分钟困惑点清零（Phase 0 清单）+ 文档校准（BUG-006 口径）+ 性能复核。
- Phase 5：诚实打分表 + 最终报告 + 移交清单 + 最终 commit。

---

## 需用户决策（阻塞项）

- **BUG-006**：4 个「AI-only」势力（大西/和硕特·西藏/荷兰东印度/沙俄）在势力选择屏可选，但**没有独特机制面板**（侧栏只有 8 个通用面板，`src/engine/systems/` 无 `terror`/`theocracy`/`company_dividend`/`cossack_host` 实现）。master-plan 锁定「8 可玩 + 4 AI-only」。
  - 选项 A：把这 4 方改为真 AI-only（从 `playable_tags` 移除、势力卡标「AI 势力」）。
  - 选项 B：保持可选，但去掉势力卡上的「恐怖统治/公司分红」等假机制标签。
  - 选项 C：补 4 个独特面板（超出「不新增内容量」范围）。
  - **默认不擅自删除可选势力**，等用户拍板。

---

## 未提交改动清单（会话耗尽续跑用）

- `src/ui/shell/TopBar.tsx`（BUG-001）
- `src/ui/panels/EstatesPanel.tsx`（BUG-002/003）
- `src/engine/rules/war.ts`（BUG-007）
- `tests/war.test.ts`（+2 回归测试）
- `src/content/data/events/late.yaml`（BUG-008）
- `src/engine/systems/economy.ts`（BUG-010 囤银 sink）
- `tests/economy.test.ts`（+1 囤银测试 + 修旧用例）
- `docs/how-to-play.md`（BUG-004/005）
- `scripts/dev/play-dump.mjs`、`scripts/dev/probe-extra.mjs`（新增工具）
- `runbook/bug-ledger.md`、`runbook/progress.md`（新增）

**尚未 commit**（按启动句「五门禁全绿后提交一个 commit」，留到 Phase 5 最终验收后一次提交）。
