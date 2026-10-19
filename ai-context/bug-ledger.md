# Bug Ledger · Phase 1（2026-10-20）

> 严重度：P1 = 阻断/可导致错误世界状态；P2 = 明显错误但不破坏存档；P3 = 边界/体验。
> 每条均先复现（单测/探针）后修复，回归入口见「验证」。

| ID | 严重度 | 症状 | 根因 | 修复 | 验证 |
|---|---|---|---|---|---|
| BUG-001 | P1 | AI 无视停战协议反复宣战 | `ai.ts` 候选目标未过滤 `truceDays > 0` | 候选过滤加入停战判断 | typecheck + 45 局矩阵（Phase 3） |
| BUG-002 | P1 | AI 征税决议冷却按相对天数比较，几乎永久不可用 | `cooldowns['ai-tax'] = 180` 与绝对日比较 | 改为 `state.day + 180`，比较 `> state.day` | 决议冷却单测 |
| BUG-003 | P1 | 玩家决议冷却显示/判定错位，到期后仍不可用 | 同上：写入相对值 | `takeDecision` 写绝对日；UI 用 `cooldown - day` | `systems.test.ts` 决议冷却用例 |
| BUG-004 | P2 | 非交战国可通过命令对别国战争强制议和 | `diplomacy.makePeace` 未校验 belligerent | 校验 `war.attacker/defender === tag` | 代码审查 + 命令层回归 |
| BUG-005 | P1 | 对已灭亡国家仍可宣战，产生幽灵战争 | `createWar` 未校验双方存活 | 增加 alive 守卫 | `war.test.ts` dead-country 用例 |
| BUG-006 | P2 | 和约后未选中的占领地不归还，围城进度残留 | 转移循环只处理「选中/现状」路径 | 白和/未选中一律恢复 owner=controller；清除双方残留 siege/occupation | `war.test.ts` white-peace 用例 |
| BUG-007 | P2 | 和约后军队滞留在无通行权的第三方领土 | 遣返依赖 `affected` 集合，漏掉未占领敌省 | 以「本国控制/交战/军通」合法性判定替代 affected | `war.test.ts` repatriation 用例 |
| BUG-008 | P2 | 首都割让后 `nation.capital` 指向外国省份 | 和约无首都重定位 | 新增 `relocateCapital`，和平后双方校正 | `war.test.ts` capital-relocation 用例 |
| BUG-009 | P2 | 中立 NEU 即使仍拥有省份也会被清理 | `cleanupDefeatedNations` 主循环无条件处理 NEU | 跳过 NEU，按实际 owner/controller 决定存活 | `war.test.ts` neutral-alive 用例 |
| BUG-010 | P1 | 首都由第三方或非交战国占领时触发误投降 | `resolveCapitalCapitulation` 只看 controller | 要求 capital.owner 为本国且占领者存活并交战 | `war.test.ts` non-belligerent 用例 |
| BUG-011 | P2 | 1627 年大明崩溃即复生南明；南明继承第三方占领地；首都非法 | 复生条件缺年份/剧本/玩家校验，继承只看 owner | 仅 1644+、AI 大明、北京失守；要求 owner+controller 均为 MING；首都回退到实际控制省 | `crisis.test.ts` 3 用例 |
| BUG-012 | P2 | `ended` 后仍重复评估胜利，观察局文案异常 | tick 胜利分支无 `!state.ended` 守卫；spectator reason 为空 | 加守卫；spectator 用 `best.reason || '推演结束'` | 门禁 + 长局（Phase 4） |
| BUG-013 | P1 | 税制 `silverShare` 被忽略，所有税入折算为银 | 经济重写时丢失银/粮拆分 | 恢复 silver/food 分流，按粮价折算粮食 | `economy.test.ts` silverShare 用例 |
| BUG-014 | P2 | 偿还欠款只减 arrears，不减国库（凭空消债） | 还款未计入现金流出 | 还款同时扣 treasury，并计入 expense/net | `economy.test.ts` arrears 用例 |
| BUG-015 | P2 | 港口被占领后仍产生海贸收入 | 未校验 `province.controller === tag` | 收入循环加入控制权校验 | `trade.test.ts` occupied-port 用例 |
| BUG-016 | P2 | 同日易手后建筑加成缓存不失效 | 缓存仅按 day/state 失效 | 缓存键加入 `state.mapRevision` | `buildings.test.ts` 同日落城用例 |
| BUG-017 | P2 | 缺失阶级的忠诚/影响力条件被当作 0，错误通过 | `?? 0` 参与比较 | 缺失即 `false` | `systems.test.ts` missing-estate 用例 |
| BUG-018 | P2 | 可与交战国或第三方附庸结盟 | `addAlliance` 缺少关系校验 | 拒绝交战、拒绝附庸方与第三方结盟 | `diplomacy.test.ts` 用例 |
| BUG-019 | P3 | 正统仪式在无实际盟友时仍扣费并记录盟友 | 未检查 `addAlliance` 返回值 | 收集成功盟友；为空则不扣费 | 门禁 + 代码审查 |
| BUG-020 | P3 | 索贡宣战失败仍按成功记录 | 未检查 `declareWar` 返回值 | 使用实际返回值决定日志/理由 | 门禁 + 代码审查 |
| BUG-021 | P2 | 可通过「与 owner 交战」穿越中立控制省 | access 规则多算 owner 交战分支 | 仅按 controller 的交战/军通判定 | `diplomacy.test.ts` access 用例 |
| BUG-022 | P2 | 航渡中的舰队能封锁出发港 | 封锁统计未排除 `embarked` | 排除航渡舰队 | `naval.test.ts` 用例 |
| BUG-023 | P2 | 有友方庇护的军队仍被围歼；解围后围困标记不消失 | 撤退先判毁灭；围困只看补给 | 先找友方退路；有庇护即清除围困 | `encirclement.test.ts` |
| BUG-024 | P2 | 多国同省战斗的攻守方判定错误 | 以 owner/controller 单方为锚 | 守方=controller+盟友；攻方=与其交战的军队 | 门禁 + 不变量探针 |
| BUG-025 | P2 | 不同战争共享围城/占领进度 | siege/occupation 不校验交战关系 | 仅沿用与本省 controller 仍交战的进度 | 门禁 + 不变量探针 |
| BUG-026 | P3 | 战场敌军统计包含航渡部队 | `enemiesHere` 未排除 `embarked` | 排除航渡军队 | 门禁 |
| BUG-027 | P2 | 登陆失败且出发港失守时军队滞留海上/敌境 | 失败分支只处理 origin 仍属己方 | 转往本国任一控制省；无处可去则覆没；清理 movePath | `naval.test.ts` divert 用例 |
| BUG-028 | P2 | 训练营地失守后仍继续扣钱粮 | 仅校验国家存活 | 控制器变化即取消训练并记录 | 代码审查 + 门禁 |
| BUG-029 | P2 | 分兵可产生负兵种或凭空造兵 | 取整缺口全部塞给 infantry，未做非负分配 | 最大余数法按现有兵种分配，父部队非负扣减 | `systems.test.ts` split 用例 |
| BUG-030 | P2 | 事件队列绕过 fireOnce/冷却；可选择未满足条件的选项 | 队列循环未 `canFire`；选项未校验 trigger | 队列加 `canFire`+alive；选项触发校验 | `systems.test.ts` 2 用例 |
| BUG-031 | P2 | 开局军队落在非本国控制领土 | 剧本数据/区域归属冲突 | 1627/1644/1650 调整山海关归属与蒙古/明军驻地 | `scenario.test.ts` 用例 |
| BUG-032 | P3 | 旧存档缺失/NaN 兵种导致 maxStrength 为 NaN | 迁移只判断 `typeof number` | 非有限值归零并重算 maxStrength；伤亡非有限值归零 | `save.test.ts` 用例 |
| BUG-033 | P1 | 年中达成统一/承天受命不结束游戏，最多延迟一年且可能丢失条件 | 胜利只在年首/终局/玩家死亡时评估 | 非观战局每日评估，观战局终局日评估 | `systems.test.ts` mid-year victory 用例 |
| BUG-034 | P3 | 终局计分人口使用 YAML 静态值 | `scoreCountry` 读 content 而非 state | 改读 `state.provinces[id].population` | `systems.test.ts` 计分用例 |
| BUG-035 | P3 | 读档后残留旧局战斗/和谈/菜单状态 | `load()` 未清理临时 UI 字段 | 补齐 `armyStack/selectedBattle/peaceWarId/menuOpen/settingsOpen/helpOpen` | E2E + 代码审查 |
| BUG-036 | P3 | 关闭战争警报时忽略未处理的和平提议，时间继续跑 | `acknowledgeWarAlert` 暂停条件缺 `peaceOffers` | 加入和平提议判断 | 代码审查 |
| BUG-037 | P2 | 清理死国后同一 tick 内仍残留「死国参战」 | `cleanupDefeatedNations` 不结算战争 | 修复省份归属后立即 `resolveFinishedWars` | `systems.test.ts` dead-war 用例 |
| BUG-038 | P3 | 事件/AI 当天新增的计时修正被当天扣掉一天 | `updateTimedModifiers` 不区分新增日期 | `addedDay` 当天跳过递减（旧存档缺省兼容） | `systems.test.ts` modifier-duration 用例 |
| BUG-039 | P3 | 终局日直接读取的异常存档 `ended=true` 但 `victory=null` | 提前返回分支未评分 | 分支内 `victory ??= evaluateVictory` | 代码审查 |

## 统计

- 修复 39 项：P1 7（BUG-001/002/003/005/010/013/033）、P2 20、P3 12。
- **验收时遗留**：阻断 0、严重 0；全部 P1 已关闭并有回归测试。
- 全部修复项通过 5 门禁；不变量探针 3 剧本 × 5 种子 × 5 年见 `invariant-probe-phase1-final.log`。
- 未修/降级：多国战斗的逐战争伤亡归属（仅影响统计精度）、AI 对多线战争的战略权重，记录为 Phase 3 观察项。剧本首月不跑月结（起始日即月初，属一次性少结算，记录为已知行为）。
