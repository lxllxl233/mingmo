# runbook/ — 本任务的执行入口（我的版本）

> 这是**我（当前 AI）重新制定**的"把《明末 华夏震荡》做到可上架游玩"的执行目录，
> 与上一任的 `ai-context/`、`docs/` 并存，但**不受其"已达标"结论约束**。

## 目录

| 文件 | 内容 |
|---|---|
| [`assessment.md`](assessment.md) | 我的独立评估：核实过的事实 + 上一任没说/说错的 + 真实差距 |
| [`master-plan.md`](master-plan.md) | 分阶段执行计划（Phase 0–5），含验收门 |
| [`progress.md`](progress.md) | 执行期进度（跨会话续跑点）——执行时创建 |
| [`bug-ledger.md`](bug-ledger.md) | 执行期 bug/UX 账本——执行时创建 |

## 一句话启动整个任务

> **按 runbook/master-plan.md 从 Phase 0 开始全程自动执行：以浏览器自动化亲自游玩的方式验证与修复，完成 bug 猎杀、平衡去 hack、核心循环趣味性与 UX 打磨，每阶段结束更新 runbook/progress.md 与 bug-ledger.md，并在五门禁全绿后提交一个 commit（不 push），直到输出诚实的最终验收报告与移交清单。**

（若不希望 AI 自动 commit，删去"并在五门禁全绿后提交一个 commit"分句即可。）

## 续跑协议

- 每次会话开始：读 `runbook/progress.md` 找"下一阶段入口"，从该处继续，不重跑已完成阶段。
- 后台长任务（45 局矩阵、soak）用 `run_in_background`。
- 会话耗尽：在 `progress.md` 写清"已完成到哪 / 下一步 / 未提交改动"，下次从这里续。

## 与上一任的根本区别（避免被带偏）

| 上一任 | 本计划 |
|---|---|
| headless 看海验证"不崩、不死锁" | **浏览器自动化亲自玩**，验证"能上手、不困惑、好玩" |
| "AI 可验证维度全部达标"（自指） | 诚实区分"AI 已实测" vs "只能真人判断" |
| 平衡用 `provinceCount<200`、联盟 hack 掩盖 | 去 hack，用真机制让 45 局多胜者自然成立 |
| 事件是 ±数字微调 | 关键事件加 flag→后续→长线后果 |
| 1650 单极/囤银"接受为设计例外" | 判定为真实缺陷并修 |

## 门禁命令（每阶段结束必跑）

```bash
pnpm typecheck && pnpm test && pnpm validate && pnpm audit:content && pnpm build
```
