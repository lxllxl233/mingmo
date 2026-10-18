# 内容规范 · 甲申

> 这是 `00-master.md` 第 6.4 节「数据驱动」的展开。
> 目标：**任何内容改动都不需要碰 TypeScript**，且错误在构建期就炸出来。

---

## 1. 文件组织

```
src/content/data/
  countries/
    MING.yaml          势力定义 + 开局
    QING.yaml
    ...
  focuses/
    MING.yaml          一个势力一个文件
    QING.yaml
  events/
    MING_1627_1635.yaml    按「势力 + 年代」切片，单文件 ≤ 400 行
    MING_1636_1643.yaml
    MING_1644.yaml
    RANDOM_famine.yaml
  decisions/
    MING.yaml
  tech/
    military.yaml
    agriculture.yaml
    administration.yaml
    fiscal.yaml
    thought.yaml
  estates/
    _common.yaml       8 个通用阶级定义（key、通用名、默认敏感度）
    MING.yaml          阶级配置：启用哪些、初始影响力/忠诚、特权
    QING.yaml
    ...
  tax_laws/
    peasants.yaml      按阶级分文件，通用税法
    gentry.yaml
    merchants.yaml
    nobles.yaml
    soldiers.yaml
    officials.yaml
    clergy.yaml
    country_specific.yaml  势力专属税法
  map/
    provinces.yaml     480 省
    prefectures.yaml   160 府
    regions.yaml       30 地区
  scenarios/
    1627.yaml
    1644.yaml
    1650.yaml
  balance.yaml         所有数值常量
```

规则：
- 一个文件只放一类内容；单文件 ≤ 400 行，超了就按年代/分支再切。
- 文件内按 `id` 字典序或逻辑顺序排列，不要求严格排序，但**新增内容追加到末尾**，减少 diff 噪音。

---

## 2. 命名规范

| 对象 | 规则 | 示例 |
|---|---|---|
| 势力 tag | 大写，3–6 字母 | `MING`, `QING`, `SHUN`, `SMING`, `ZHENG`, `VOC` |
| 省份 | 小写拼音/英文，全局唯一 | `beijing`, `shanhaiguan`, `ningyuan` |
| 府 | `pref_` + 拼音 | `pref_daming` |
| 地区 | `reg_` + 拼音 | `reg_beizhili` |
| 国策 | `<tag小写>_<分支>_<slug>` | `ming_fiscal_open_sea` |
| 事件 | `<TAG>_e_<年>_<两位序号>` | `MING_e_1644_02` |
| 随机事件 | `rand_<池>_<两位序号>` | `rand_famine_03` |
| 事件链 | `<TAG>_chain_<slug>` | `MING_chain_jiashen` |
| 决议 | `<tag小写>_dec_<slug>` | `ming_dec_edict_of_sin` |
| 科技 | `<类>_<slug>` | `mil_red_barbarian_cannon` |
| 阶级 | `<estate>`（8 个固定 key） | `gentry`、`peasants`、`soldiers` |
| 税法 | `tax_<阶级>_<slug>` | `tax_gentry_exemption`、`tax_peasants_surtax` |
| 特权 | `priv_<阶级>_<slug>` | `priv_gentry_corvee_exempt` |
| 修正 | 白名单键名 | `stability_add` |
| flag | 小写 snake_case，动词+名词 | `capital_fallen`, `wu_sangui_defected` |
| 变量 | 小写 snake_case | `arrears_months` |
| 本地化键 | 省略，v1 内联文本 | — |

**ID 一旦发布不得改名**（存档兼容）。需要改语义就新建 ID，旧的标 `deprecated: true`。

---

## 3. 通用数据结构

### 3.1 数值修正 Modifier

所有修正必须来自白名单，值为数字（加法）或百分比（`_pct` 后缀）。

| 键 | 作用域 | 含义 |
|---|---|---|
| `stability_add` | country | 稳定度一次性变化 |
| `stability_monthly` | country | 每月稳定度漂移 |
| `mandate_add` | country | 天命一次性变化 |
| `corruption_add` | country | 腐败一次性变化 |
| `corruption_drift` | country | 每月腐败漂移 |
| `unrest_monthly` | country | 每月全国叛乱度漂移 |
| `famine_resistance` | country | 灾荒抗性（0–1，直接相加后夹取） |
| `authority_add` | country | 皇权变化 |
| `political_power_monthly` | country | 每月政治点 |
| `tax_efficiency_pct` | country | 税收效率百分比 |
| `trade_efficiency_pct` | country | 贸易效率 |
| `food_output_pct` | country / prefecture | 粮产 |
| `pop_growth_pct` | country / prefecture | 人口增长 |
| `manpower_add` | country | 可用兵源 |
| `army_attack_pct` | country | 陆军攻击 |
| `army_defense_pct` | country | 陆军防御 |
| `cavalry_attack_pct` | country | 骑兵攻击 |
| `artillery_attack_pct` | country | 炮兵攻击 |
| `siege_speed_pct` | country | 攻城速度 |
| `fort_defense_pct` | country | 城防 |
| `morale_add` | country | 组织度上限 |
| `discipline_pct` | country | 纪律（伤害与溃退） |
| `research_speed_pct` | country | 科研速度 |
| `focus_speed_pct` | country | 国策速度 |
| `unrest_add` | province | 叛乱度 |
| `devastation_add` | province | 破坏度 |
| `supply_limit_add` | province | 补给上限 |
| `naval_attack_pct` | country | 水师攻击 |
| `army_upkeep_pct` | country | 军饷开支 |
| `inflation_add` | country | 通胀 |

不在表里的键 → 校验失败。新增键必须同时更新 `src/engine/rules/modifiers.ts` 与本文档。

**三种修正载体，别混用：**

| 写法 | 含义 | 用途 |
|---|---|---|
| `add_modifier: { ... }` | 永久（随国策/科技存在） | 国策、科技的核心产出 |
| `add_country_modifier: { modifier, days }` | 具名临时修正 | 战争疲劳、临时国策效果 |
| `add_province_modifier: { province, modifier, days }` | 省级临时修正 | 战区破坏、地方叛乱 |

**命名约定：** YAML 一律 `snake_case`；TypeScript 接口用 `camelCase`，加载器负责映射
（`cost_days → costDays`、`completion_effect → completionEffect`）。新增字段两边都要改，并在
`schema.test.ts` 里加一条往返测试。

### 3.2 触发条件 Trigger

```yaml
# 叶子条件
date: { after: 1644-01-01, before: 1645-06-01 }
owns: beijing                    # 拥有（core 或控制）
controls: shanhaiguan            # 控制
at_war_with: QING
has_flag: capital_fallen
not_has_flag: southern_ming_founded
treasury: { lt: 0 }              # lt / lte / gt / gte / eq
stability: { lt: 30 }
mandate: { gte: 60 }
army_size: { gte: 50000 }
province_count: { gte: 20 }
faction_influence: { donglin: { gte: 40 } }
relation: { target: QING, lt: -50 }
year: { gte: 1640 }
has_tech: mil_red_barbarian_cannon
has_advisor: xu_guangqi
controls_capital: true
is_at_war: true
estate_loyalty: { peasants: { lt: 30 } }
estate_influence: { merchants: { gte: 40 } }
tax_law: { estate: peasants, is: tax_peasants_surtax }
has_privilege: priv_gentry_corvee_exempt

# 组合器
all: [ ... ]
any: [ ... ]
not: { ... }
```

规则：
- `all` / `any` / `not` 可任意嵌套，深度 ≤ 5。
- 未定义的 flag 视为 false（不报错），但拼写错误的 flag 会在校验期被「未使用 flag 检查」提示。
- 日期格式 `YYYY-MM-DD`，游戏开始前/结束后的日期允许（用于永假条件）。

### 3.3 效果 Effect

效果是一个**有序列表**，逐条执行。

```yaml
effect:
  - add_stability: -5
  - add_treasury: -500000
  - add_faction_influence: { donglin: 10, eunuch: -30 }
  - add_estate_loyalty: { estate: gentry, value: -10 }
  - add_estate_influence: { estate: merchants, value: 8 }
  - set_tax_law: { estate: peasants, law: tax_peasants_surtax }
  - grant_privilege: { estate: gentry, privilege: priv_gentry_corvee_exempt }
  - revoke_privilege: { estate: gentry, privilege: priv_gentry_corvee_exempt }
  - set_flag: capital_fallen
  - clear_flag: capital_safe
  - add_modifier: { tax_efficiency_pct: 8, stability_monthly: 0.1 }
  - add_province_modifier: { province: beijing, modifier: war_damage, days: 365 }
  - add_country_modifier: { modifier: war_exhaustion, days: 730 }
  - change_capital: nanjing
  - unlock_unit: artillery_battery
  - unlock_decision: ming_dec_edict_of_sin
  - add_tech: mil_red_barbarian_cannon
  - add_core: liaodong
  - add_claim: beijing
  - add_relation: { target: QING, value: -20 }
  - declare_war: { target: QING, cb: restore_liaodong }
  - spawn_army: { province: beijing, template: ming_guard, size: 3 }
  - change_owner: { province: beijing, to: SHUN }
  - trigger_event: { id: MING_e_1644_03, delay_days: 7 }
  - add_manpower: 20000

# 条件分支
  - if:
      trigger: { has_flag: wu_sangui_defected }
      then:
        - add_stability: -10
      else:
        - add_stability: 5

# 加权随机
  - random_list:
      - weight: 60
        effect:
          - add_stability: -3
      - weight: 40
        effect:
          - trigger_event: { id: MING_e_1644_05 }
```

规则：
- 效果键必须在白名单内，参数类型必须匹配。
- `trigger_event` 的 `delay_days` 默认 0；跨链延迟 ≤ 720 日。
- 不允许在效果里写 C 类逻辑（无 `while`、无脚本表达式）。

---

## 4. 国策 Focus

### 4.1 类型

```ts
interface Focus {
  id: string;
  country: string;              // tag
  name: string;
  desc: string;
  branch: string;               // 分支名，用于 UI 分组
  icon?: string;                // v1 可省略
  x: number;                    // 树坐标（格）
  y: number;
  costDays: number;             // 60–150
  prerequisites: string[];      // 全部满足
  prerequisitesAny?: string[];  // 满足其一
  mutuallyExclusive: string[];  // 成对声明，校验期检查对称
  available?: Trigger;          // 额外可用条件
  byzantine?: boolean;          // 预留：拜占庭式复杂前置
  completionEffect: Effect[];
  aiWillDo: AiWeight;
  historicalContext?: string;   // 史实说明，UI 展示
  repeatable?: boolean;
}

interface AiWeight {
  base: number;                 // 0–100
  modifier?: Array<{ factor: number; if: Trigger }>;
}
```

### 4.2 示例

```yaml
- id: ming_fiscal_open_sea
  country: MING
  branch: 财政
  name: 开海通商
  desc: 闽粤海商久困于禁，若开月港、许贩东西洋，关税可补辽饷之缺。然士绅恐失田赋之利。
  x: 2
  y: 3
  cost_days: 90
  prerequisites: [ming_fiscal_salt_reform]
  mutually_exclusive: [ming_fiscal_haijin]
  available:
    any:
      - controls: yuegang
      - has_flag: coastal_trade_lobby
  completion_effect:
    - add_treasury: 300000
    - add_modifier: { trade_efficiency_pct: 15 }
    - add_faction_influence: { merchant: 15, gentry: -10 }
    - unlock_decision: ming_dec_open_port
    - set_flag: sea_trade_open
  ai_will_do:
    base: 40
    modifier:
      - factor: 2.0
        if: { treasury: { lt: 0 } }
      - factor: 0.3
        if: { at_war_with: QING }
  historical_context: 隆庆开海后月港合法化，天启崇祯间海禁反复，关税始终是明朝财政的灰色地带。
```

### 4.3 设计校验

- 树必须无环。
- 每个国策必须能从某个无前置的根节点到达。
- 互斥必须对称（A 列 B ⇒ B 列 A）。
- 同一势力至少 1 条分支有 ≥ 3 个终点。
- `x/y` 不能重叠（UI 重叠检测）。

---

## 5. 事件 Event

### 5.1 类型

```ts
interface Event {
  id: string;
  title: string;
  desc: string;
  historicalContext?: string;
  picture?: string;             // v1 省略
  scope: 'country' | 'province';
  country?: string;             // 触发国（scope=country），或 'any'
  trigger: Trigger;
  mtth?: number;                // 平均触发天数；与 trigger 二选一或并用
  fireOnce?: boolean;           // 默认 true
  chain?: string;               // 事件链 id
  options: EventOption[];
  aiChoice?: string;            // 默认 AI 选项
  weight?: number;              // 随机池权重
}

interface EventOption {
  id: string;
  name: string;
  tooltip?: string;             // 未填则自动生成效果摘要
  trigger?: Trigger;            // 选项可见条件
  aiChance?: number;            // 0–100
  effect: Effect[];
}
```

### 5.2 示例

```yaml
- id: MING_e_1644_02
  title: 北京告急
  scope: country
  country: MING
  chain: MING_chain_jiashen
  historical_context: 崇祯十七年正月，李自成在西安称帝，随即东渡黄河，兵锋直指京师。
  trigger:
    all:
      - date: { after: 1644-02-01, before: 1644-04-30 }
      - not_has_flag: capital_fallen
      - any:
          - controls: taiyuan
          - has_flag: shun_eastward
  options:
    - id: summon_wu
      name: 调吴三桂入卫
      tooltip: 放弃关外，勤王京师。山海关防务空虚。
      ai_chance: 40
      effect:
        - add_stability: 5
        - add_treasury: -200000
        - set_flag: wu_sangui_summoned
        - spawn_army: { province: beijing, template: guanning_army, size: 4 }
        - trigger_event: { id: MING_e_1644_03, delay_days: 10 }
    - id: move_south
      name: 南迁
      tooltip: 弃京师，退保南京。天命与民心大损，但社稷可续。
      trigger: { controls: nanjing }
      ai_chance: 20
      effect:
        - add_stability: -15
        - add_mandate: -20
        - set_flag: capital_moved
        - change_capital: nanjing
        - trigger_event: { id: MING_e_1644_04s, delay_days: 30 }
    - id: hold
      name: 死守京师
      tooltip: 天子守国门。城破则社稷倾覆。
      ai_chance: 40
      effect:
        - add_stability: 10
        - add_mandate: 5
        - set_flag: beijing_last_stand
```

### 5.3 事件链

```yaml
- id: MING_chain_jiashen
  name: 甲申
  stages:
    - MING_e_1644_01
    - MING_e_1644_02
    - MING_e_1644_03
    - MING_e_1644_04
  on_complete:
    - set_flag: jiashen_resolved
```

规则：
- 链内每个事件都必须有 `chain` 字段指向链 id。
- 链内事件必须至少有一条路径能到达下一环；校验期做可达性检查。
- 链长度 ≤ 6。

---

## 6. 决议 Decision

```yaml
- id: ming_dec_edict_of_sin
  country: MING
  name: 罪己诏
  desc: 下诏自责，以收人心。
  visible: { stability: { lt: 40 } }
  available:
    all:
      - has_flag: natural_disaster_recent
      - not_has_flag: edict_this_year
  cost: { treasury: 50000, political_power: 50 }
  cooldown_days: 365
  effect:
    - add_stability: 8
    - add_mandate: 5
    - add_faction_influence: { gentry: 5, eunuch: -5 }
    - set_flag: edict_this_year
```

决议与事件的区别：**决议是玩家主动点的**，必须有可见成本、冷却、可用条件。

---

## 7. 科技 Tech

### 7.1 类型

```ts
interface Tech {
  id: string;
  name: string;
  desc: string;
  category: 'military' | 'agriculture' | 'administration' | 'fiscal' | 'thought';
  era: number;                  // 1620 / 1640 / 1660，仅用于 UI 分组
  costDays: number;             // 90–360
  prerequisites: string[];
  requiresAny?: Trigger;        // 非科技前置（人才、缴获、传教士）
  effects: Effect[];
  unlocks?: { units?: string[]; buildings?: string[]; decisions?: string[] };
  aiWeight: number;             // 0–100
}
```

### 7.2 示例

```yaml
- id: mil_red_barbarian_cannon
  name: 红夷大炮
  desc: 仿制佛郎机长管炮，重逾三千斤。攻城破壁，守城亦利。
  category: military
  era: 1620
  cost_days: 240
  prerequisites: [mil_franciscan_breech]
  requires_any:
    any:
      - has_advisor: jesuit_missionary
      - has_flag: captured_portuguese_guns
      - has_flag: ningyuan_victory
  effects:
    - add_modifier: { siege_speed_pct: 25, fort_defense_pct: 15, artillery_attack_pct: 20 }
  unlocks:
    units: [artillery_battery]
  ai_weight: 70
```

### 7.3 科技树规则

- 每类 10–16 项，深度 ≤ 5 层。
- 每类至少有 1 项「条件解锁」而非纯前置（体现历史偶然性）。
- 有得有失：火器科技提升火力但增加补给消耗；集权科技提升税收但降低士绅满意度。

---

## 8. 阶级与税法

> 这是本作与 HOI4/EU4 差异最大的地方，也最容易写歪。
> 记住一句话：**税不是「国家收的」，是国家从某个阶级手里抠出来的。**

### 8.1 固定阶级 key

```ts
type EstateKey =
  | 'dynasty' | 'nobles' | 'officials' | 'gentry'
  | 'merchants' | 'peasants' | 'soldiers' | 'clergy'
  | `custom:${string}`;   // 如 'custom:natives'、'custom:bondservants'
```

阶级 key 是**代码常量**，不允许内容里自创（`custom:` 前缀除外）。新增通用阶级要改 schema 与本文档。

### 8.2 阶级定义（`estates/_common.yaml`）

```yaml
estates:
  - key: gentry
    name: 士绅地主
    name_by_country: { MING: 士绅, QING: 汉地士绅, JOSEON: 两班 }
    sensitivity: 1.5          # 税率变化对忠诚的影响倍数（0.5–2.5）
    income_from: land         # land | trade | stipend | mixed
    default_privileges: [priv_gentry_corvee_exempt]
  - key: peasants
    name: 农民
    sensitivity: 2.0
    income_from: land
    default_privileges: []
```

### 8.3 势力阶级配置（`estates/MING.yaml`）

```yaml
country: MING
estates:
  - key: dynasty
    name: 宗藩
    influence: 20
    loyalty: 65
    income_share: 0.026
    privileges: [priv_clan_stipend, priv_clan_manor]
    tax_law: tax_dynasty_stipend
  - key: gentry
    name: 士绅
    influence: 35
    loyalty: 55
    income_share: 0.215
    privileges: [priv_gentry_corvee_exempt, priv_gentry_hidden_land]
    tax_law: tax_gentry_exemption
  - key: peasants
    name: 农民
    influence: 8
    loyalty: 30
    income_share: 0.517
    privileges: []
    tax_law: tax_peasants_single_whip
```

约束（校验期强制）：

- `income_share` 之和必须 = 1.00（容差 0.01）。
- 每个启用阶级必须有 `tax_law`，且该税法 `estate` 字段等于本阶级 key。
- `influence` 会在运行时归一化，配置里不必凑够 100。
- 未启用的阶级不能出现在列表里（如顺、西没有 `clergy`，蒙古、西藏没有 `gentry`）。

十二国的完整底稿见 `examples/estates-tax.yaml`（明、清）与 `examples/estates-10-factions.yaml`（其余 10 国）。

### 8.4 税法（`tax_laws/*.yaml`）

```ts
interface TaxLaw {
  id: string;
  country?: string;                 // 限定势力；空 = 通用
  estate: EstateKey;
  name: string;
  desc: string;
  rate: number;                     // 0–0.30
  efficiency: number;               // 0–1
  evasionBase: number;              // 0–0.50
  silverShare: number;              // 0–1，其余折粮
  loyaltyDrift: number;             // 每月忠诚漂移，可负
  influenceShift: number;           // 切换时的影响力变化
  incidence?: { estate: EstateKey; factor: number };  // 税负转嫁
  require?: Trigger;                // 解锁条件（科技/国策/港口）
  effects?: Effect[];               // 附加修正
  aiWeight: number;                 // 0–100
}
```

三条完整示例：

```yaml
# 农民：默认税制
- id: tax_peasants_single_whip
  estate: peasants
  name: 一条鞭
  desc: 计亩征银，赋役合一。简便易行，然银贵钱贱则民困。
  rate: 0.04
  efficiency: 0.75
  evasion_base: 0.15
  silver_share: 0.9
  loyalty_drift: 0
  influence_shift: 0
  effects:
    - add_modifier: { tax_efficiency_pct: 5 }
  ai_weight: 60

# 士绅：祖制优免，几乎不纳税
- id: tax_gentry_exemption
  estate: gentry
  name: 优免
  desc: 有功名者免差徭，田亩多诡寄其名下。国用不足，而绅衿不可犯。
  rate: 0.005
  efficiency: 0.9
  evasion_base: 0.05
  silver_share: 0.8
  loyalty_drift: 0.4
  influence_shift: 0
  effects:
    - add_modifier: { stability_monthly: 0.05, tax_efficiency_pct: -6 }
  ai_weight: 40

# 士绅：清丈限田，向士绅开刀
- id: tax_gentry_land_survey
  estate: gentry
  name: 清丈限田
  desc: 丈量隐田，按实亩起科。豪右大恨，而小民稍苏。
  rate: 0.05
  efficiency: 0.7
  evasion_base: 0.2
  silver_share: 0.9
  loyalty_drift: -1.2
  influence_shift: -8
  incidence: { estate: peasants, factor: 0.35 }
  require:
    all:
      - has_tech: adm_assessment_law
      - authority: { gte: 55 }
  ai_weight: 25
```

### 8.5 特权（privileges）

特权是「阶级凭什么少交税」的制度化表达。收回特权是财政改革最有效也最危险的一步。

```yaml
- id: priv_gentry_corvee_exempt
  estate: gentry
  name: 优免差徭
  desc: 有功名者免徭役，投献成风，田亩多挂绅衿名下。
  effects:
    - add_modifier: { tax_efficiency_pct: -4 }
  revoke:
    cost: { political_power: 80 }
    effects:
      - add_estate_loyalty: { estate: gentry, value: -20 }
      - add_stability: -5
      - add_modifier: { tax_efficiency_pct: 4 }
  ai_keep: 60
```

### 8.6 引擎侧结算顺序（必须照此实现）

```
每月：
  1. 聚合各府收入 → estate.income
  2. 对每个已启用阶级：
       gross     = income/12 × rate
       evasion   = clamp(evasionBase + (100-loyalty)/400 + influence/500 - admin/300, 0, 0.8)
       collected = gross × efficiency × (1-evasion) × (1-corruption/200)
       入银库   += collected × silverShare
       入粮库   += collected × (1-silverShare) / grainPrice
  3. incidence：上调税率的阶级，把一部分负担转给目标阶级
  4. 忠诚漂移：loyalty += (习惯税率 - rate) × sensitivity × 20 + loyaltyDrift
  5. 抗税：loyalty < 30 时 collected 打折；< 15 时进入事件池
```

### 8.7 阶级事件

事件可以绑定到阶级：`scope: estate` + `estate: gentry`。
这类事件只在目标阶级的忠诚/影响力满足条件时进入池子，例如：

```yaml
- id: rand_estate_gentry_1
  title: 绅衿抗税
  scope: estate
  estate: gentry
  trigger:
    all:
      - estate_loyalty: { gentry: { lt: 25 } }
      - estate_influence: { gentry: { gte: 30 } }
  mtth: 180
  options:
    - id: back_down
      name: 让步
      effect:
        - add_estate_loyalty: { estate: gentry, value: 10 }
        - add_treasury: -100000
    - id: crack_down
      name: 强硬
      effect:
        - add_estate_loyalty: { estate: gentry, value: -15 }
        - add_stability: -8
        - add_modifier: { tax_efficiency_pct: 5 }
```

### 8.8 阶级部分的校验规则

- 8 个固定 key 在 `_common.yaml` 中都有定义。
- 势力配置里的每个 `tax_law` 存在，且 `law.estate` 与配置的 key 一致。
- `income_share` 之和 = 1（容差 0.01）。
- 税率 ≤ 0.30；效率 0–1；逃税 0–0.5。
- `incidence.estate` 必须是该势力已启用的阶级。
- 每个阶级至少有 3 条可用税法（通用 + 专属）。
- 每条 `revoke` 必须有成本，且至少有一项负面效果。

---

## 9. 势力与剧本

### 9.1 势力

```yaml
tag: MING
name: 大明
color: "#9e2b25"
capital: beijing
government: monarchy
religion: confucian
culture: han
playable: true
ai_personality: defensive_bureaucratic
estates_file: estates/MING.yaml      # 阶级配置单独成文件
factions: [donglin, eunuch, imperial, military, royal_clan, gentry, merchants, farmers]
starting:
  treasury: 1200000
  food: 8000000
  stability: 45
  mandate: 65
  corruption: 55
  authority: 50
  political_power: 0
  army_loyalty: 55
  provinces: [ ... provincia id 列表 ... ]
  armies:
    - { template: ming_guard, province: beijing, size: 4 }
    - { template: guanning_army, province: ningyuan, size: 5 }
  focuses_done: []
  flags: []
```

### 9.2 剧本

```yaml
id: "1627"
name: 崇祯元年
start_date: 1627-10-01
description: 阉党初败，辽东糜烂，陕西饥民方起。大明仍有牌可打。
overrides:
  MING: { stability: 45, treasury: 1200000 }
  QING: { stability: 60, mandate: 40 }
initial_events: [MING_e_1627_01]
victory_hints: [...]
```

规则：剧本只做**增量覆盖**，不重复定义完整势力数据。

---

## 10. 地图数据

```yaml
# provinces.yaml
- id: shanhaiguan
  name: 山海关
  prefecture: pref_yongping
  region: reg_beizhili
  terrain: urban
  coastal: true
  river: false
  fort: true
  fort_level: 8
  population: 90000
  development: 55
  supply_limit: 30000
  neighbors: [yongping, ningyuan, capital]
```

- `neighbors` 必须双向一致（校验期检查）。
- 每个省必须属于一个已存在的府；每个府属于一个已存在的地区。
- **480 省**的人口总和应约等于剧本全国人口。
- 每个省的 `dominant_estate` 必须是该势力已启用的阶级。
- `landholding` 决定农业税基；各省之和应与 `balance.yaml` 的全国田亩数一致。

---

## 11. 本地化

v1 允许**内联中文文本**（`name` / `desc` / `tooltip`），理由：内容量在千条以内，内联减少一层间接、
让 AI 少犯错。

但必须遵守：
- 字段名固定为 `name` / `desc` / `tooltip` / `historical_context`，不得自创 `title_cn` 之类。
- 提供 `scripts/extract-loc.ts`，把所有文本导出为 `loc/zh.json`（key = 内容 id + 字段）。
- 为 v2 的 i18n 留位：`name` 允许写成 `{ key: "focus.ming_fiscal_open_sea.name", default: "开海通商" }`，
  加载器两种形式都接受。

---

## 12. 校验（`pnpm validate`）

必须全部通过，否则 CI 失败：

1. **Schema**：每个 YAML 通过对应 zod schema，错误信息含文件路径与字段路径。
2. **ID 唯一**：跨文件全局唯一。
3. **引用完整**：国策前置、事件链、科技前置、决议、省份邻接、势力首都，全部指向存在的 ID。
4. **无环**：国策树、科技树、事件链。
5. **互斥对称**。
6. **可达性**：每个国策能从根到达；每个事件链每环至少一条可达路径。
7. **修饰符白名单**。
8. **数值范围**：稳定度 0–100、天命 0–100、人口 ≥ 0、日期合法。
9. **地图一致性**：邻接双向、人口总和、每个府至少 1 省。
10. **阶级一致性**：8 个 key 有定义；`income_share` 之和 = 1；每个启用阶级有合法 `tax_law`；
    `incidence` 目标已启用；税率 ≤ 0.30；每个阶级 ≥ 3 条税法。
11. **未使用检测**：定义了但从未被引用的 flag / 事件 / 科技 / 税法 / 特权（warning，不阻塞）。

---

## 13. 新增一条内容的流程

```
1. 在对应 YAML 追加条目（新 ID，不改旧 ID）
2. pnpm validate        → 修 schema / 引用错误
3. pnpm test content    → 跑内容测试（可达性、无环、快照）
4. pnpm dev             → 游戏内 `~` 控制台 `event <id>` / `focus <id>` 手动触发
5. 提交：一次提交只加一类内容，message 写 `content(MING): +8 fiscal focuses`
```

**禁止**为了「先跑起来」而跳过校验，或在 schema 里加 `passthrough()` 放过未知字段。
