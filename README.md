# 明末 华夏震荡 · 明末大战略

> **游戏已可运行。** 先看 [`docs/how-to-play.md`](docs/how-to-play.md)：
> `pnpm install && pnpm dev`，浏览器打开 `http://127.0.0.1:5173`。
> 验证：`pnpm typecheck && pnpm test && pnpm validate && pnpm build`；
> 70 年无头模拟：`pnpm sim --years 70 --seed 42`。

一套分层、可直接交给 AI 编码代理（DSH / Claude Code / Codex / Cursor）使用的提示词，
用来从零构建一款「明末—清初」的省份级大战略游戏：国策树、事件链、科研、财政、军事、外交、势力 AI。


## 三步上手

1. **定参数。** 打开 [`prompts/00-master.md`](prompts/00-master.md) 第 4 节，确认 5 个默认设定
   （平台、地图粒度、时间跨度、剧本、可玩势力数）。不同意就直接改，改完再往下用。
2. **开新会话。** 粘贴 `00-master.md` 全文；上下文允许的话，把
   [`prompts/01-design-spec.md`](prompts/01-design-spec.md) 与
   [`prompts/02-content-spec.md`](prompts/02-content-spec.md) 一起附上。
3. **逐里程碑推进。** 每个阶段单独一轮，粘贴 [`prompts/03-phases.md`](prompts/03-phases.md)
   里对应的一节，并附上「当前仓库状态 + 上一阶段验收结果」。

## 文件地图

| 文件 | 作用 | 读者 |
|---|---|---|
| [`prompts/00-master.md`](prompts/00-master.md) | 主提示词，一次粘贴即可开工 | AI |
| [`prompts/01-design-spec.md`](prompts/01-design-spec.md) | 详细设计规格：史观、势力、系统、数值基线、UI | AI + 你 |
| [`prompts/02-content-spec.md`](prompts/02-content-spec.md) | 数据规范：schema、触发/效果 DSL、命名、校验 | AI |
| [`prompts/03-phases.md`](prompts/03-phases.md) | M0–M8 分阶段提示词与验收标准 | AI |
| [`examples/ming-focus.yaml`](examples/ming-focus.yaml) | 大明国策树节选，可直接当 fixture | AI |
| [`examples/jiashen-events.yaml`](examples/jiashen-events.yaml) | 1644 甲申事件链，含分支与 flag | AI |
| [`examples/tech-tree.yaml`](examples/tech-tree.yaml) | 科技树节选，含前置与解锁 | AI |
| [`examples/estates-tax.yaml`](examples/estates-tax.yaml) | 明/清两套阶级配置 + 25 条税法 + 10 项特权 | AI |
| [`examples/estates-10-factions.yaml`](examples/estates-10-factions.yaml) | 其余 10 势力的阶级配置 + 17 条专属税法 | AI |

## 默认设定（可改）

| 项 | 已定 | 备注 |
|---|---|---|
| 舞台 | 东亚：东经 70°–150°、北纬 15°–55° | 已锁定 |
| 地图粒度 | 480 省 / 160 府 / 30 地区 | 已锁定 |
| 可玩势力 | **12 方，v1 一次交付，不分期** | 已锁定；M7 的四批只是施工顺序 |
| 经济 | **8 阶级 + 税法体系** | 已锁定；各势力按需启用 4–8 类 |
| 时间 | 1616–1683，日 tick，四档速度 | 已锁定 |
| 剧本 | 1627 崇祯元年 / 1644 甲申 / 1650 永历 | 已锁定 |
| 平台 | 浏览器单机：TypeScript + Vite + React + PixiJS | 待定（Godot 亦可） |

## 为什么这样拆文件

- **00 是操作手册，01 是世界观，02 是语法，03 是施工图。** 混在一起，AI 会在长上下文里丢掉约束。
- **示例内容单独成文件。** AI 最可靠的迁移方式不是读描述，而是读一份能通过校验的真实数据。
- **每个文件都能独立增量更新。** 你改平衡只动 01 的表；加 DSL 只动 02；换里程碑只动 03。

## 已锁定 vs 仍待定

**已锁定，AI 不得再提替代方案**（详见 [`docs/decisions.md`](docs/decisions.md)）：

- **8 个阶级**：宗室、贵族、官僚、士绅、商人、农民、军人、宗教。各势力按史实启用其中 4–8 类（例如顺、西没有宗教，蒙古、西藏没有士绅）。
- **12 个势力，v1 一次性全量交付**。不做「先 4 方再补 8 方」的分期，M7 的四批只是开发顺序，不是发行节奏。
- 东亚舞台、480 省、日 tick、三剧本。

**仍待你拍板：**

1. **平台**：Web/TS（推荐，AI 迭代与自动化测试成本最低）还是 Godot？
2. **战斗抽象**：HOI4 式「战场宽度 + 逐日结算 + 组织度崩溃」（推荐）还是「一仗定胜负」的战役级？
3. **历史约束**：强史实锚点（大明不操作必在 20–40 年内崩）还是完全沙盒？
4. **美术**：程序化色块 + 水墨 UI（零素材依赖，推荐）还是预留 PNG 素材接口？
5. **语言**：仅中文，还是从第一天就上 i18n（中 / 英）？

> 这 5 个问题的答案会改变 01 与 03 的写法，但不改变 00 的结构——先用默认值开工，后面再换代价可控。

## 下一步

按 [`prompts/03-phases.md`](prompts/03-phases.md) 的 **M0** 开第一轮：
AI 应先给出文件树、五份 schema 草案（含 estate）、M0 的 ≤12 项任务分解，然后停下等你确认，而不是直接开始生成代码。

---

## 附：极简版（30 行，先出可玩原型）

不想一次上全套时，用这段先跑一个闭环，跑通后再换回完整提示词。

```
做一个单机网页大战略游戏原型，背景明末清初（1616–1683），玩法参考 HOI4。

范围（只做这些）：
- 一张 60 省的地图，点选、缩放、平移
- 日推进 + 四档速度
- 5 个阶级（士绅、商人、农民、军人、宗室），每阶级一个税法槽、3 条可选税法
- 税法会转嫁：向士绅加税，农民忠诚会掉
- 银/粮/人口/军饷，欠饷会掉军心
- 大明国策树 12 条，含 1 对互斥
- 事件 8 条，含 1644 甲申链 3 环，选项有可见代价
- 科技 6 项，含红夷大炮
- 存档 / 读档

架构：
- TypeScript strict + Vite + React + PixiJS
- engine 纯函数，不得 import react/pixi
- 所有内容在 YAML，zod 校验，构建期报错
- 种子随机，同种子同指令结果一致

规则：
- 每轮先给「文件清单 + 验收命令」，再写代码
- 单文件 ≤ 400 行，一轮 ≤ 5 个文件
- 不引入后端、UI 库、美术素材
- 不用 Math.random，不写 any

第一轮只输出：文件树 + 4 个 schema 草案 + M0 任务分解（≤12 项），然后停下等我确认。
```
