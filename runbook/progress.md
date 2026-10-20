# 执行进度（跨会话续跑点）

> 会话开始读本文件找「下一阶段入口」。每 Phase 结束追加：做了什么 / 证据 / 遗留 / 下一阶段入口。

---

## 当前状态摘要（2026-10-20 本会话 · 五阶级经济重构完成）

- **门禁**：五门禁全绿 — `typecheck` 0 错误、`test` 31 文件 **168 用例**、`validate` ok（estates=5 / taxLaws=42 / privileges=12 / events=230 / decisions=73 / focuses=504 / techs=84 / generals=86 / scenarios=3）、`audit:content` 0/0、`build` 成功（4.04s）。
- **Phase 6（本轮新增）**：按 `docs/five-estate-migration.md` 完成五阶级经济重构（schema / 数据 / 引擎 / UI / AI / 存档迁移），见下节。
- **Phase 2 收尾**：2.1 移除 `late.yaml` 门槛 ✅；2.2 1650 单极判定为结构性（BUG-011）✅；2.3 囤银第二轮（真实赈济/吏治支出）✅但极端海贸胜局未完全达标（BUG-010）；2.4 45 局矩阵固化 ✅。`dominantTag` hack 尝试移除后回归，**保留并如实注释**（BUG-009 deferred）。
- **Phase 3 收尾**：3.1 事件决策链 8/8 ✅；3.2 记仇 ✅、兵力集中尝试后回退 [~]、制海权列已知限制 ✅；3.3 内容重复审计 ✅（判定无需补内容）；3.4 ui/配音/配乐为真人主观项，移交。
- **Phase 4 收尾**：文档校准 ✅；空态/禁用/危险/代价代码级复核 ✅；首 5 分钟/tooltip 全量走查需真人（移交）。
- **剩余（需真人）**：真人外测「好不好玩/上手」、美术/音频主观评审、史实审读、发行决策（见 `docs/handoff.md` / 最终报告 §7）。

---

## Phase 6 — 五阶级经济重构（2026-10-20 完成）

> 依据：`docs/five-estate-migration.md`（用户已确认全部设计决策）。差距分析原文 `docs/economy-design-gap.md` 顶部已加「已落地」说明。

### 6.1 阶级与数据迁移（✅）

- 固定 5 个 key：`ruling` / `merchants` / `landlords` / `artisans` / `peasants`；每国 3–5 个，不强制补齐。
- 合并：`dynasty+nobles+officials+soldiers → ruling`；`gentry+clergy → landlords`；`custom:natives → peasants`；**新增 `artisans`（匠户/行会）**，收入份额从农民/商人切出，每国合计精确 1.000。
- 税法 42 条，每个存在的阶级 ≥3 条；特权 12 条（新增 `priv_artisan_guild`）。
- 删除死配置：`EstateDef.income_from`、`Balance.economy.foodPerPersonMonth`（schema / loader / YAML 同步）。
- 存档版本 7：`mergeEstateGroup` + `migrateEstatesV7` 把 v6 的 8 阶级存档并入 5 阶级（含影响力/忠诚/收入加权合并、税法回退），`tests/save.test.ts` 覆盖。

### 6.2 月度经济循环（✅）

- **分配**：`normalizedAllocation` 永远归一到 100%，`unallocated = 0`；调整仍免费。
- **货币化**：`clamp(max(1, government.trade) × (1 + trade_efficiency_pct/100), 0.5, 1.8)` 只乘银税；粮税按 `grainPrice` 折算，不受贸易效率影响；商馆（trade post）与锁国收入单独结算。
- **腐败**：全国仍一个 `corruption` 值；损耗按 `taxByEstate × (0.5 + influence/100)` 分摊到各阶级，月报 `corruptionByEstate` 各项之和 = `corruptionLoss`。
- **基层维稳**：农民+小生产者按人口权重（0.58 / 0.10）计算 `loyaltyCost = totalIncome × popShare × (1 − loyalty/100) × 0.55`；基层忠诚 <30 时推高民怨。
- **现金瀑布**：税收 → 腐败/基层维稳/维持成本 → **军饷（优先）** → 购粮 → 训练对账。维持成本允许超支；国库夹到 0，付不出的部分记入 `arrears`（事件债）；只有 `wageShortfall` 进 `wageArrears`。购粮不足不形成债务。
- **囤银软上限**：`350000 + 省数 × 3000`；超出只累 `hoardPressure`（腐败 +0.6、通胀 +0.35、momentum −0.05），**不直接烧银**（`expenseHoard = 0`）。
- **训练**：每日扣款，月报用日累计器对账（`expenseTraining` / `foodTraining`），不重复扣；缺银/缺粮只记 `trainingStalled*`，不形成债务。
- **AI 税法**：`expectedTaxNet` 按「名义税 × 效率 × (1−逃税) × 税制效率 × 腐败折损 × 货币化」再减忠诚冲击评分，允许降名义税率，要求显著超过当前分数才换。

### 6.3 UI 对账（✅）

- `EstatesPanel`：收入拆分（税/商馆/锁国）、军饷实付/应付、购粮、训练、腐败归属、基层维稳、维持成本、囤银压力、净收支、基层忠诚/人口占比、训练停滞警告；投影与引擎瀑布一致。
- `TopBar` 银两 tooltip：同一套拆分 + 欠饷警告 + 结算顺序说明。
- `how-to-play.md` §3.2 已从「八阶级」改为五阶级，并写明结算顺序与贸易效率作用范围；`doc/economy-design-gap.md` 标注差距分析已被迁移取代。

### 6.4 验收证据

- **五门禁**：见顶部摘要。
- **MING 改革探针** `probe-ming-reform.ts`（1627 normal，观战，强制养廉银，条件满足即京察）：
  `90.0 → 88.6(1627) → 65.1(1628) → 57.6(1629) → 46.3(1630，1 次京察) → 44.2(1632) → 44–49 平台`。
  原目标「10 年内 <50」在第 3 年达成；不改革则长期维持 90 的国家陷阱仍在。
- **分配极端探针** `probe-allocation-extremes.ts`（12 年）：全压农民 → 腐败 100/稳定 1，但存活；全压商人 → 收入 120 万但基层忠诚 1–5、维稳费 ~46.8 万、民怨 87、欠债 100 万而亡；全压统治阶级 → 基层忠诚 0、民怨 95、国库 0/欠债 56.6 万。**三种不同失败模式，不存在全压单一阶级的稳定最优解。**
- **45 局矩阵**（3 剧本 × 3 难度 × 5 种子 × 20 年，`out/qa-matrix-20y-1792495976696.json`）：**0 僵尸 / 0 孤儿省 / 0 局提前结束**；顶级势力分布 SHUN 15、SMING 12、QING 8、ZHENG 5、XI 4、MONGOL 1（多胜者，无单极）。
- **67 年 soak**（3 剧本 × normal × seed42，`out/qa-matrix-67y-1792496374977.json`）：**0 僵尸 / 0 孤儿省 / 0 永久 0 国库无恢复**（新增 `stuck` 指标：活着、国库 ≤0、有债务、月净 ≤0）；存活势力 10 / 9 / 7；顶级势力 1627 SHUN:148、1644 SMING:141、1650 SMING:149。

### 6.5 偏差与已知限制（如实记录）

- **京察门槛 50 → 40**：MING 开局权威 40，权威月增约 0.05，门槛 50 会让该决议 15 年以上不可用（实际死内容）。降到 40 后有明确代价（-10 统治阶级忠诚）与 5 年冷却，仍非免费。
- **1650 清朝不再单极**：迁移后 20 年矩阵清只在 2/5 局居首；67 年长局清从 291 省跌到 31 省。探针显示**清财政正常**（国库 20–250 万、0 欠饷、收入随省份下降），败因是军事 AI：人力 90 万但 17 支军团总兵力长期卡在 ~3.8 万，不补员。属既有 BUG-009 军事 AI 问题，**不是经济崩坏**；是否恢复清的史实优势需单独再平衡，本轮未动。
- **AI 囤银与软上限的交互未解**：AI 的储备目标（8–12 倍毛支出，含非现金腐败）高于软上限，改革探针中国库仍会滚到 ~270 万并长期 `hoardPressure=1`。下调 AI 储备在早前实验中引发其他雪球回退，故保留现状，记入已知限制（BUG-010 同源）。
- **腐败只做轻量归属**：仍是一个全国值，阶级归属只影响月报展示与分摊，不改变每阶级独立腐败行为（按用户确认的方案）。
- **未加民用粮**：民用粮继续抽象进经济大盘（按用户确认的方案）。

---

## Phase 3.2 记仇 + 兵力集中 + 制海权（本会话完成）

### 记仇（✅ 落地）

- `state/types.ts` 新增 `CountryState.grudges: Record<string, number>`；`war.ts createWar` 被宣战方对侵略者 +60（盟友被拖入同样记仇）；`ai.ts` 新增 `grudgeWarTarget` 优先报复、逐月 -1 衰减；`save.ts` 加存档迁移；`tests/war.test.ts` +1。
- 矩阵验证：0 僵尸 / 0 孤儿全成立，平衡无回退（1650 hard/seed99 郑 170 胜与基线一致）。

### 兵力集中（[~] 尝试后回退）

- 实现了「最强 2 军团共享最高分目标 + 敌军驻军强度评分」，矩阵实测**助长雪球**：1650 hard 反清 1/3→0/3，1627/1644 变南明单极。改「霸主分散/弱者集中」亦无效（霸主分散反而更利于控场）。**回退为原「各占一省」**，未收敛，记入 BUG-009。

### 制海权（✅ 列已知限制）

- 现有 `naval.ts` 只有 `blockadedPorts`/`blockadePenalty`（被动封锁惩罚），无 AI 制海权目标选择。按 master-plan「成本过高则列已知限制」处理，不假装。

---

## Phase 2.3 囤银第二轮 + BUG-009 移除尝试（本会话完成）

### 囤银第二轮（BUG-010，[~]）

- `ai.ts manageInvestments`：通用消耗从打水漂 +0.15 稳定 → **真实赈济/吏治**（`spend = excess*0.3`，每 5 万两/月换稳定 +0.25、吏治 -0.25，封顶 magnitude 3）。
- 诊断 `scripts/dev/probe-hoard.ts`（1650/seed42/20 年）：郑国库 198 万、月入 105 万、月支 107 万（硬 sink 70 万）。典型局已压到数月支出，但极端海贸胜局（郑 170 省）仍囤数百万——结构性收入规模问题，列已知限制。

### BUG-009 dominantTag hack 移除尝试（[~] deferred）

- 用「门控合纵」（关系阈值 + 合纵兵力门槛）替换 `dominantTag≥0.38` 硬塞，矩阵回归：1650 清统一蔓延 hard（清 356/352/366）、1627/1644 南明单极。诊断确认合纵确实发动（俄/蒙/藏宣清）但清仍赢——**1650 清的结构性优势只有无门槛集体围攻能压制**。
- **保留 hack**（`historicalWarTarget` 加注释如实标注），不再宣称「已去 hack」。详见 bug-ledger BUG-009。

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
- **2.2 1650 追赶路径**：第一轮已做「三藩之乱 → 三藩平定」flag 链（BUG-011），但矩阵实测对单极**几乎无效**——QING 仍 8/9 居首。结论：1650 单极是**结构性**的（清开局 60.6%、且 1650–1683 本就是清统一的历史进程），事件级 ±数字改不动；硬性要求「每难度 ≥2 胜者」会走向非历史 buff/nerf。诚实处理：保留三藩之乱作史实风味 + 反雪球 + flag 链示范，但不再硬凑「多胜者」目标；反清的可玩体验由 hard 难度提供（反清 2/3 胜）。详见 BUG-011。
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

## Phase 3 — 核心循环趣味性（进行中）

### 已完成（3.1 事件决策链）

- 建立了「关键事件 → set_flag → 后续条件事件 → 长线后果」的决策链模式，已覆盖 3 个势力：
  - **清**：三藩之乱 → 三藩平定（`late.yaml`）
  - **明**：孙传庭出关（催战→潼关失守 / 固守→潼关稳固）（`timeline.yaml`）
  - **顺**：山海关（决战→弃京西走 / 退守→保存实力）（`timeline2.yaml`）
- 所有链 `pnpm validate` + `audit:content` 0 死 flag。事件总量 214 → **221**。

### 已完成（3.1 事件决策链）✅ 8/8 势力

清/明/顺/郑/南明/蒙古/朝鲜/日本 各 1 条决策链（选择 → set_flag → 后续 → 长线后果），事件 214 → 230，validate/audit 全绿。

### 待办（3.2 AI 策略性，未改，为最大「好玩」杠杆）

`ai.ts` 现状：行军 = `frontCandidates`/`frontTargets`（每个军团 BFS 到「最近的高 support 边境省」，`assigned` 集合强制**各自占不同省**，无兵力集中）；宣战 = `HISTORICAL_TARGETS` 硬编码表 + `dominantTag≥0.38` hack；无记仇、无制海权。

- **兵力集中**（`ai.ts:599-615` `manageMovement`）：改为「最强的 2 支军团共享最高分目标（会合打赢敌军），其余再分散」，而非每支各占一省。需改 `frontTargets` 的 target 去重逻辑 + 用敌方驻军强度做评分（当前评分只有 `support/pathLength/development`，不看来敌）。改完重跑 45 局矩阵对比。
- **记仇**：新增持久化 grudge 状态（背盟/被宣战的 tag），让 `historicalWarTarget` 优先报复背刺者，而非只看当前关系阈值。需改 `state/types.ts`（加字段）+ `rules/diplomacy.ts`（背盟时记录）+ `ai.ts`（用 grudge）。
- **制海权**（可选项）：郑/清/荷/日按港口价值选目标；成本高则明确写「已知限制」，不假装。

### 待办（3.3 内容重复审计）

## Phase 4 — UX 打磨 + 文档校准（进行中）

- 首 5 分钟困惑点：Phase 0 清单中的 4 项（顶栏/分配两处/投降倾向）已修，待全量走查。
- 文档校准：`how-to-play.md` 数字与 `\n` 已修；`quality-bar.md` §5 已改写为诚实口径；BUG-006 口径待用户拍板。

## Phase 5 — 诚实验收 + 移交（未开始）

- 全量回归（45 局矩阵 + 67 年长局 + invariant-probe）+ 最终报告 + 移交清单 + 最终 commit。

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
