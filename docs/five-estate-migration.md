# 五阶级迁移与经济修复方案

> 状态：迁移设计稿。本文把已确认的设计决策落成可执行的迁移表。
> 迁移顺序：**先做五阶级机械迁移（Phase A），再修经济账目（Phase B），最后调平衡（Phase C）**。
> 不要在三件事之间来回改，否则所有平衡基线会反复作废。

---

## 0. 已确认的决策

| 议题 | 决定 |
|---|---|
| 阶级粒度 | 5 阶级：统治阶级、商人、地主、小生产者、农民 |
| 小生产者 | 新增，不推迟 |
| soldiers / clergy / custom:natives | **统一归并**（全国一套映射） |
| 每国阶级数 | 允许 **3–5 个**，不强制补齐 |
| 腐败 | 国家单一 `corruption`，月报按阶级**轻量归属**，不做每阶级独立值 |
| MING 腐败 90 | 保留历史陷阱，但必须有可改革自救的路径 |
| 债务优先级 | **军饷优先**；有盈余时**全额补发** |
| 民用粮食 | 不加入；民用消费已抽象进经济大盘 |
| 贸易效率 | 提高**货币化收入**，不凭空增加真实生产 |
| 囤银上限 | **可见软上限**：超限推高腐败/通胀，不直接烧银 |
| 分配调整成本 | 暂时保持免费；用“基层维稳 + 民怨”制造代价 |
| 未分配 | **自动归一化到 100%** |

---

## 1. 新阶级模型

### 1.1 规范键名

| key | 显示名 | 合并来源 | 贪腐归属 | 维稳对象 |
|---|---|---|---|---|
| `ruling` | 统治阶级 | dynasty + nobles + officials + soldiers | 是 | 否 |
| `merchants` | 商人 | merchants | 是 | 否 |
| `landlords` | 地主 | gentry + clergy | 是 | 否 |
| `artisans` | 小生产者 | 新增（匠户/行会/市肆） | 否 | 是 |
| `peasants` | 农民 | peasants + custom:natives | 否 | 是 |

不再使用的键：`dynasty`、`nobles`、`officials`、`gentry`、`soldiers`、`clergy`、`custom:natives`。
`custom:*` 可保留在 schema 里作为未来扩展，但当前内容不使用。

### 1.2 人口权重（用于分配公平感）

替换 [economy.ts](../src/engine/systems/economy.ts) 里的 `POPULATION_WEIGHTS`：

| ruling | landlords | merchants | artisans | peasants |
|---|---|---|---|---|
| 0.12 | 0.14 | 0.06 | 0.10 | 0.58 |

说明：农民仍占人口的绝对多数；统治阶级按“国家机器 + 军户”计，不再是旧版 4 个精英阶级各自计权。
`estatePopulationShare` 仍按该国实际拥有的阶级归一化，因此蒙古/西藏/女真不会因为缺少农民而失真。

### 1.3 贪腐归属（轻量）

只做月报归属，不新增状态字段：

```
corruptWeight(e) = taxByEstate[e] × (0.5 + influence[e] / 100)
corruptionShare(e) = corruptWeight(e) / Σ corruptWeight
corruptionByEstate[e] = corruptionLoss × corruptionShare(e)
```

只统计存在的 `ruling` / `merchants` / `landlords`。月报新增
`corruptionByEstate` 与 `corruptionShareByEstate`，UI 在“腐败侵蚀”旁显示“官僚 x / 地主 y / 商人 z”。

### 1.4 基层维稳

把当前“全阶级平均忠诚 × 0.42”改为“基层人口加权”：

```
bottomKeys = 存在的 peasants + artisans
bottomPopShare = Σ estatePopulationShare(bottomKeys)
bottomLoyalty = Σ loyalty[e] × popShare[e] / bottomPopShare
loyaltyCost = totalTax × bottomPopShare × (1 - bottomLoyalty / 100) × 0.55
```

- 精英不满仍然通过“影响力加权忠诚 → 稳定度/天命”体现，不再额外收一笔维稳费。
- 基层忠诚 0 时，维稳成本约占税收 35%；基层忠诚 100 时为 0。
- 月报字段名保留 `loyaltyCost`，UI 文案改为“基层维稳”。

### 1.5 基层民怨

在 [politics.ts](../src/engine/systems/politics.ts) 的省份民怨增量中加入：

```
bottomNeglect = max(0, 30 - bottomLoyalty) × 0.02
```

基层忠诚 0 时每省每月 +0.6 民怨，与当前 `unrestDecay = 0.5` 同量级，能真正把省份推向起事阈值。

---

## 2. 各国迁移表

影响值已按“旧影响求和后归一化到 100”处理；忠诚按旧影响加权平均；
收入份额已把 artisans 的份额从农民/商人中切出，且每国合计精确为 1.000。
“默认税法”只是开局值，玩家仍可在该阶级的税法列表中切换。

### MING

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 46 | 49 | 0.086 | `tax_officials_thin_salary` |
| landlords | 30 | 55 | 0.225 | `tax_gentry_exemption` |
| merchants | 15 | 50 | 0.152 | `tax_merchants_inland_customs` |
| peasants | 4 | 30 | 0.477 | `tax_peasants_single_whip` |
| artisans | 5 | 45 | 0.060 | `tax_artisans_guild` |

特权：ruling 保留 `priv_clan_stipend`、`priv_clan_manor`、`priv_noble_manor`、`priv_official_meltage`、`priv_soldier_land`；landlords 保留 `priv_gentry_corvee_exempt`、`priv_gentry_hidden_land`、`priv_clergy_exempt`；merchants 保留 `priv_merchant_salt_license`；artisans 新增 `priv_artisan_guild`。

### QING

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 65 | 73 | 0.190 | `tax_qing_banner_land` |
| landlords | 18 | 48 | 0.220 | `tax_gentry_exemption` |
| merchants | 9 | 55 | 0.130 | `tax_merchants_inland_customs` |
| peasants | 3 | 35 | 0.400 | `tax_peasants_single_whip` |
| artisans | 5 | 55 | 0.060 | `tax_artisans_guild` |

### SHUN

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 49 | 68 | 0.370 | `tax_soldiers_mercenary` |
| landlords | 8 | 20 | 0.080 | `tax_shun_confiscation` |
| merchants | 7 | 35 | 0.070 | `tax_merchants_inland_customs` |
| peasants | 32 | 70 | 0.430 | `tax_peasants_light` |
| artisans | 4 | 45 | 0.050 | `tax_artisans_guild` |

### XI

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 61 | 65 | 0.470 | `tax_soldiers_mercenary` |
| landlords | 4 | 15 | 0.050 | `tax_gentry_exemption` |
| merchants | 4 | 30 | 0.060 | `tax_merchants_inland_customs` |
| peasants | 27 | 40 | 0.370 | `tax_xi_terror` |
| artisans | 4 | 40 | 0.050 | `tax_artisans_guild` |

### SMING

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 53 | 45 | 0.190 | `tax_officials_thin_salary` |
| landlords | 23 | 55 | 0.220 | `tax_gentry_exemption` |
| merchants | 13 | 60 | 0.130 | `tax_merchants_maritime` |
| peasants | 5 | 35 | 0.400 | `tax_peasants_single_whip` |
| artisans | 6 | 45 | 0.060 | `tax_artisans_guild` |

### ZHENG

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 35 | 73 | 0.270 | `tax_soldiers_mercenary` |
| landlords | 9 | 50 | 0.100 | `tax_gentry_exemption` |
| merchants | 39 | 75 | 0.410 | `tax_merchants_maritime` |
| peasants | 9 | 45 | 0.150 | `tax_peasants_single_whip` |
| artisans | 8 | 50 | 0.070 | `tax_artisans_guild` |

### MONGOL（3 阶级）

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 77 | 66 | 0.730 | `tax_mongol_herds` |
| landlords | 18 | 80 | 0.200 | `tax_clergy_exempt` |
| merchants | 5 | 55 | 0.070 | `tax_merchants_inland_customs` |

喇嘛从“独立阶级”并入地主阶级，但 `factions['clergy']` 继续保留宗教政治影响。

### JOSEON

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 64 | 63 | 0.490 | `tax_nobles_manor` |
| landlords | 21 | 56 | 0.180 | `tax_gentry_exemption` |
| merchants | 6 | 50 | 0.060 | `tax_merchants_inland_customs` |
| peasants | 4 | 35 | 0.210 | `tax_peasants_single_whip` |
| artisans | 5 | 50 | 0.060 | `tax_artisans_guild` |

### JAPAN

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 68 | 66 | 0.530 | `tax_nobles_manor` |
| landlords | 11 | 57 | 0.120 | `tax_gentry_exemption` |
| merchants | 11 | 60 | 0.090 | `tax_merchants_maritime` |
| peasants | 3 | 30 | 0.190 | `tax_peasants_head_tax` |
| artisans | 7 | 45 | 0.070 | `tax_artisans_guild` |

### TIBET（3 阶级）

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 45 | 66 | 0.350 | `tax_nobles_manor` |
| landlords | 50 | 85 | 0.600 | `tax_tibet_monastery` |
| merchants | 5 | 55 | 0.050 | `tax_merchants_inland_customs` |

寺院领主归入地主，`tax_tibet_monastery` 保持 rate 0；要征税必须改革到 `tax_clergy_estate`。

### VOC

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 46 | 67 | 0.430 | `tax_officials_meltage` |
| merchants | 29 | 70 | 0.330 | `tax_voc_dividend` |
| peasants | 18 | 35 | 0.170 | `tax_natives_tribute` |
| artisans | 7 | 55 | 0.070 | `tax_artisans_guild` |

`custom:natives` 并入 peasants；`tax_natives_tribute/corvee/trade` 改为 `country: VOC` 的农民/商人税法。

### RUSSIA

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 55 | 66 | 0.530 | `tax_nobles_manor` |
| landlords | 10 | 65 | 0.100 | `tax_gentry_exemption` |
| merchants | 11 | 55 | 0.090 | `tax_merchants_inland_customs` |
| peasants | 17 | 30 | 0.210 | `tax_russia_fur` |
| artisans | 7 | 50 | 0.070 | `tax_artisans_guild` |

### NEU（3 阶级）

| 阶级 | 影响 | 忠诚 | 收入份额 | 默认税法 |
|---|---:|---:|---:|---|
| ruling | 62 | 59 | 0.400 | `tax_nobles_manor` |
| landlords | 15 | 65 | 0.100 | `tax_clergy_exempt` |
| peasants | 23 | 40 | 0.500 | `tax_peasants_single_whip` |

---

## 3. 内容迁移清单

### 3.1 阶级定义

- [estates/common.yaml](../src/content/data/estates/common.yaml)：8 个 `estate_defs` → 5 个；补 `name_by_country`；`sensitivity` 建议 ruling 1.2、landlords 1.5、merchants 1.2、artisans 1.6、peasants 2.0。
- `income_from` 在引擎里没有被使用。迁移时保留字段但不作为依据；Phase B 可删除该字段与 schema 项，避免死配置。

### 3.2 税法

只改 `estate` 字段，尽量保留 ID，减少事件/存档引用面：

| 旧 estate | 新 estate | 说明 |
|---|---|---|
| dynasty / nobles / officials | ruling | 宗禄、庄田、薄俸、养廉银、火耗归公 |
| soldiers | ruling | 募兵厚饷、家丁私兵 |
| soldiers（卫所屯田） | peasants | 军屯与卫所屯田合并为农民侧的军事化选项 |
| gentry / clergy | landlords | 优免、清丈、一体当差、寺产 |
| custom:natives | peasants（tribute/corvee）、merchants（trade） | 加 `country: VOC` |

删除 3 条完全重复的税法（内容合并，不是删文件）：

- `tax_nobles_full_stipend` → 合并进 `tax_dynasty_stipend`
- `tax_dynasty_reduced` → 合并进 `tax_nobles_reduced_stipend`
- `tax_dynasty_manor` → 合并进 `tax_nobles_manor`

新增 3 条小生产者税法：

```yaml
- id: tax_artisans_guild
  estate: artisans
  name: 行会包税
  desc: 行会代收市税，匠户按行当摊派。征收省事，而中饱亦多。
  rate: 0.04
  efficiency: 0.7
  evasion_base: 0.2
  silver_share: 0.9
  loyalty_drift: 0
  influence_shift: 0
  effects: [{ add_modifier: { trade_efficiency_pct: 3 } }]
  ai_weight: 45

- id: tax_artisans_corvee
  estate: artisans
  name: 匠户轮班
  desc: 匠户轮班应役，以力代银。官营作坊得人，市肆渐衰。
  rate: 0.02
  efficiency: 0.6
  evasion_base: 0.25
  silver_share: 0.4
  loyalty_drift: -1.0
  influence_shift: 0
  effects: [{ add_modifier: { manpower_monthly: 200 } }]
  ai_weight: 25

- id: tax_artisans_market
  estate: artisans
  name: 市肆抽分
  desc: 市肆按营业额抽分，商贩裹足，而岁入稍增。
  rate: 0.06
  efficiency: 0.8
  evasion_base: 0.15
  silver_share: 1.0
  loyalty_drift: -0.8
  influence_shift: -3
  effects: [{ add_modifier: { trade_efficiency_pct: 6 } }]
  ai_weight: 55
```

`tax_officials_*`、`tax_nobles_manor`、`tax_soldiers_mercenary` 等 ID 不变，只把 `estate` 改成 `ruling`；
这样旧存档里的 `taxLaw` 字符串仍然有效。

### 3.3 特权

- 12 条特权的 `estate` 按上表改键；`revoke.effects` 里的 `add_estate_loyalty.estate` 同步改键。
- `priv_banner_land` 的 revoke 原本同时扣 nobles −30 与 soldiers −20，合并后会叠加成 ruling −50；
  合并为单条 `ruling −35`。
- 新增 `priv_artisan_guild`（行会垄断）：`tax_efficiency_pct: -4`；撤销花 50 政治点，artisans 忠诚 −15，税效 +4。

### 3.4 地图

- `map/provinces.yaml`：480 条 `dominant_estate` 按全局映射改；14 个 `terrain: urban` 省份改为 `artisans`。
- `map/regions.yaml`：30 条同样按全局映射改；区域层不强行安插 artisans。
- [MapRenderer.ts](../src/map/render/MapRenderer.ts) 的 `ESTATE_COLORS` 改成 5 个键，颜色建议：
  ruling 深红、merchants 橙、landlords 橄榄绿、artisans 青、peasants 土黄。

全局映射：

```
dynasty|nobles|officials|soldiers -> ruling
gentry|clergy -> landlords
merchants -> merchants
peasants -> peasants
custom:natives -> peasants
```

### 3.5 军队模板

`army_templates.yaml` 的 `source_estate`：

```
soldiers (12) -> ruling
nobles (4)    -> ruling
merchants (4) -> merchants
peasants (1)  -> peasants
```

`military.ts` 的 `recruit` 会扣 `sourceEstate` 忠诚；合并后募兵主要扣统治阶级忠诚，
这符合“军户/旗兵属于统治集团”的设定。

### 3.6 事件与聚焦

122 处 `estate:` 引用按全局映射替换。没有 `set_tax_law` 事件，因此不需要改税法 ID。
事件里 `estate_loyalty: { clergy: ... }` 这类触发器当前数据里没有；测试里有一个，迁移时一并改。

注意：VOC 没有 landlords，所有 `gentry/clergy` 事件在 VOC 会变成 no-op。
这与旧版“没有该阶级就跳过”的行为一致，不需要特殊处理。

### 3.7 代码里的硬编码

| 文件 | 位置 | 改动 |
|---|---|---|
| `src/content/types.ts` | `EstateKey` | 改为 5 键 + `custom:${string}` 的联合类型 |
| `src/content/schema.ts` | `estateDefSchema.key` | 正则改为 5 键 + custom |
| `src/content/schema.ts` | `countryEstatesSchema.estates` | min 4→3，max 9→5 |
| `src/content/loader/validateContent.ts` | `FIXED_ESTATES`、min/max | 5 键、3–5 |
| `src/engine/systems/economy.ts` | `officials` | → `ruling` |
| `src/engine/systems/economy.ts` | `POPULATION_WEIGHTS` | 新 5 键权重 |
| `src/engine/systems/politics.ts` | `gentry` / `farmers` | → `landlords` / `peasants`（修复 SHUN 加成永不触发） |
| `src/engine/systems/confiscation.ts` | `gentry` / `farmers` / `military` | → `landlords` / `peasants` / `ruling`（修复无效键） |
| `src/ui/panels/ShunPanel.tsx` | `gentry` / `farmers` | 同上 |
| `src/ui/format.ts` | `ESTATE_LABELS` | 5 键 |
| `src/ui/panels/EstatesPanel.tsx` | 颜色数组、未分配行、文案 | 5 色；去掉未分配；改文案 |
| `src/content/loader/focusPacks.ts` | `addEstateLoyalty: 'gentry'` | → `landlords` |
| `src/map/render/MapRenderer.ts` | `ESTATE_COLORS` | 5 键 |

`factions` 里的 `nobles/officials/clergy/military/farmers` 是派系，不是阶级，**不要改**。
`court.ts`、`sakoku.ts`、`league.ts`、`tribute.ts`、`legitimacy.ts` 里的派系引用同理。

---

## 4. 经济账目修复（Phase B）

### 4.1 未分配自动归一化

`normalizedAllocation` 当前只在总和 >100 时缩放。改为始终缩放到 100：

```
scale = 100 / total
```

- 玩家把某个阶级拉低，剩余份额按现有比例分给其他阶级，不再有“未分配”黑洞。
- `report.unallocated` 恒为 0；EstatesPanel 删除“未分配”扇区与行。
- `initial.ts` 的初始分配已经合计 100，不受影响。

### 4.2 军饷优先 + 债务归属

当前顺序是“购粮 → 军饷”，且缺口一律记到 `wageArrears`，即使缺口是购粮造成的。
改为现金瀑布：

```
available = max(0, totalTax - corruptionLoss - loyaltyCost - pressureCost)
armyPaid = min(armyPay, available + treasury)
wageShortfall = armyPay - armyPaid
cashAfterArmy = max(0, available + treasury - armyPaid)
foodPurchaseSilver = min(targetFoodSilver, cashAfterArmy)
net = available - armyPaid - foodPurchaseSilver
```

- `wageShortfall` 才计入 `wageArrears` 与 `arrears`。
- 购粮是玩家设定的目标值；现金不足时少买，不形成债务。
- 事件造成的负国库仍走 `addTreasury`，属于事件债务，不计入欠饷。
- 有盈余时继续“全额补发欠饷优先，再还其他债务”。
- 月报新增 `expenseArmyPaid`、`wageShortfall`、`foodPurchaseTarget`，让“应付/实付/欠”可对账。
- UI 文案改成“先军饷、后购粮”，与实际顺序一致。

### 4.3 训练费进入月报

训练费目前每日直接扣国库/粮，月报看不到。Phase B 增加：

- `CountryState.trainingSpentSilverMonth` / `trainingSpentFoodMonth`，`advanceTraining` 每日累加；
- `runMonthlyEconomy` 读取后写入 `report.expenseTraining` / `foodTraining`，然后清零；
- 不在月度结算里重复扣款，只做**报告对账**。
- 训练因钱粮不足停滞时，月报显示“训练停滞：缺银/缺粮”，不形成欠饷（当前设计是停滞而非欠饷）。

### 4.4 贸易效率 → 货币化收入

不再只放大商人税，也不再让 `government.trade < 1` 惩罚所有银税。改为：

```
monetization = clamp(max(1, government.trade) * (1 + trade_efficiency_pct / 100), 0.5, 1.8)
silverTax = tax * silverShare * monetization
foodTax = (tax - tax * silverShare) / grainPrice
```

- 真实税基不变；提高的是“同样一块产出换成银”的效率。
- 开海 +15%、海禁 −20%、商人共和国 1.28 都会真实影响银收入。
- 粮食税不受影响，`silverShare` 仍然决定银粮结构。
- 月报把 `tradePostMonthlyIncome`、`sakokuMonthlyIncome` 单独列出，不再混进 `totalTax`。

### 4.5 囤银软上限

删除 50% 直接烧银，改为：

```
hoardCap = 350000 + provinces * 3000
hoardPressure = clamp((treasury - hoardCap) / max(1, hoardCap), 0, 1)
```

- 腐败漂移：`+ hoardPressure * 0.6`（替代原来的 `+0.08`）
- 通胀漂移：`+ hoardPressure * 0.35`
- 经济动能：`- hoardPressure * 0.05`
- `expenseHoard = 0`；月报新增 `hoardPressure`。
- UI 把“库藏火耗”改为“囤银压力”，显示百分比与“超限会推高腐败/通胀”。
- 不再直接扣银，玩家可以用扩军、买粮、建筑、事件把银花出去。

### 4.6 腐败归属与基层维稳

按 1.3 / 1.4 / 1.5 实现，月报新增字段，UI 展示归属与基层维稳。

### 4.7 MING 腐败 90 的自救路径

保留 `tax_officials_honesty_silver`（养廉银）作为主杠杆，并补一个一次性政治行动：

- 决议“京察/考成”：政治点 100，腐败 −8，ruling 忠诚 −10，冷却 5 年；权威 ≥50 可用。
- 腐败 ≥70 时 TopBar/EstatesPanel 显示明确警告：“腐败正在吞掉 x% 的税，养廉银/京察可降。”
- 目标：MING 走“养廉银 + 京察”路线，10 年内把腐败从 90 降到 50 以下；不走改革则 20 年内财政崩溃。

---

## 5. 存档迁移（SAVE_VERSION 6 → 7）

在 [save.ts](../src/app/save/save.ts) 中：

1. 允许 version 6，校验 checksum 后迁移。
2. 每个国家重建 `estates`：
   - `ruling`：合并 dynasty/nobles/officials/soldiers；影响求和后归一化到 100；忠诚按影响加权；
     `taxLaw` 取影响最大的旧阶级（若该 ID 仍存在）；特权取并集；`customaryRate` 按影响加权；
     `reform` 取第一个非空；`cooldownDays` 取最大值。
   - `landlords`：合并 gentry/clergy，规则同上。
   - `merchants`：保留；若同时有 custom:natives，natives 并入 peasants。
   - `peasants`：保留并合并 custom:natives。
   - `artisans`：仅当该国新配置包含 artisans 时创建；默认影响 5、忠诚 45、
     `taxLaw: tax_artisans_guild`、`privileges: [priv_artisan_guild]`。
     为避免 `decodeSave` 依赖 content，可传入可选 `content`；没有 content 时用国家白名单。
3. `allocation`：合并旧键的分配值；新阶级给最低份额；让引擎下一次结算自动归一化。
4. `armies[].sourceEstate`：按全局映射改。
5. `lastReport` / `monthlyHistory`：清空。旧月报的键已经是 8 阶级，保留会污染 UI。
6. 重新计算 checksum 只在保存时发生；迁移函数本身不改 checksum 校验逻辑。
7. 新增测试：构造一个 v6 存档（8 阶级、含 natives、含旧 sourceEstate），断言迁移后 3–5 个阶级、
   影响合计 100、收入份额合计 1、allocation 无旧键、军队 sourceEstate 合法。

---

## 6. 实施顺序与验收

### Phase A：五阶级机械迁移

1. schema / types / validateContent 改 5 键、3–5 国、每固定阶级 ≥3 税法。
2. 新增 3 条小生产者税法 + `priv_artisan_guild`。
3. 改税法/特权 `estate` 字段与 revoke 效果。
4. 重写 `estates/common.yaml` 与 `estates/countries.yaml`（按第 2 节表）。
5. 改 provinces / regions / army_templates / events / focusPacks。
6. 改引擎与 UI 硬编码；修 `farmers`/`military` 无效键。
7. 跑 `pnpm validate`、`pnpm typecheck`、`pnpm test`；跑 12 个月 MING soak，确认无 unknown estate。

**Phase A 不做平衡调参。** 迁移后基线变化是预期的，先记录，Phase C 再调。

### Phase B：经济账目

按 4.1 → 4.7 的顺序，每项单独验证：

- 账目恒等式：`income - corruptionLoss - loyaltyCost - pressureCost - armyPaid - foodPurchaseSilver - trainingSpent ≈ net`
- `wageArrears` 只在军饷实付不足时增加；购粮不足不产生欠饷。
- `unallocated` 恒为 0。
- 超上限不直接烧银；腐败/通胀上升。
- 开海提高银税、海禁降低银税；粮食税不变。
- `Σ corruptionByEstate = corruptionLoss`。
- 基层忠诚下降 → `loyaltyCost` 上升、省份民怨上升；精英忠诚只影响稳定/天命。
- 训练月报金额 = 当月实际每日扣款之和。

### Phase C：平衡与 AI

- 20 年 MING：薄俸基线仍是陷阱（欠饷/腐败），养廉银 + 京察可在 10 年内把腐败压到 50 以下。
- 分配极端测试：全压农民、全压商人、全压统治阶级，各自在 10 年内出现不同的失败模式，
  不能有“全压某一阶级”长期最优。
- 45 局矩阵 + 67 年 soak：0 zombie/orphan，多胜者，无永久 0 国库无恢复。
- AI 税法评分改为“净收入”而不是名义税率：
  `expected = rate × efficiency × (1 - evasion) × (1 - corruption/135) - loyaltyCost`
  避免 AI 永远选最高名义税率。

---

## 7. 风险与已知取舍

1. **平衡基线全部作废**：这是最大成本。5 阶级迁移必须独立成阶段，不能和平衡调参混做。
2. **统治阶级合并后权力过大**：MING ruling 影响 46，是最大 bloc；这符合“国家机器”主题，
   但需要通过“精英内部派系”（court/factions）保留制衡。派系系统已经存在，不另建。
3. **soldiers/clergy 失去独立忠诚**：军心由 `armyLoyalty` 承载，宗教影响由 `factions['clergy']` 承载；
   事件里针对 clergy 的忠诚效果改为地主，MONGOL/TIBET 合理，MING 会略失真。
4. **VOC 没有地主**：所有 gentry/clergy 事件在 VOC no-op；这与旧版缺失阶级行为一致。
5. **TIBET 地主（寺院）占 60% 收入且默认免税**：这是历史陷阱；玩家必须改革寺产才能收税。
6. **合并特权不减少总修正**：MING ruling 仍有 5 条特权，总税效惩罚与旧版相同；
   只是撤销时集中扣一个忠诚池，`priv_banner_land` 已从 −50 调到 −35。
7. **artisans 的省份代表性弱**：只有 14 个 urban 省份在地图上显示为小生产者；
   经济份额 5–7% 仍通过国家分配体现。后续可把高发展非 urban 省份也标为 artisans。
8. **`income_from` 与 `food_per_person_month` 是死配置**：前者引擎未用，后者因“不加入民用粮”永远为 0。
   建议 Phase B 删除，避免后来者误以为已实现。

---

## 8. 待确认的调参项（不阻塞 Phase A）

这些是数值，不影响迁移结构；Phase C 可以按实测调：

- 基层维稳系数 `0.55` 与基层民怨系数 `0.02`
- 囤银压力系数：腐败 `0.6` / 通胀 `0.35` / 动能 `0.05`
- 贸易货币化上限 `1.8`
- artisans 人口权重 `0.10` 与各国收入份额 5–7%
- 京察决议的腐败 −8 / 忠诚 −10 / 5 年冷却
