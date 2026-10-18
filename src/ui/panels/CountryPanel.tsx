import type { LeaderDef } from '../../content/types';
import { areAtWar } from '../../engine/rules/war';
import { relationKey } from '../../engine/state/types';
import { controlledProvinceCount, ownedProvinceCount } from '../../engine/rules/geography';
import { useGameStore } from '../state/store';
import { formatNumber, effectsSummary } from '../format';
import { LeaderPortrait } from './LeaderPortrait';
import { CountryFlag } from './CountryFlag';

const GOVERNMENTS: Record<string, string> = {
  monarchy: '君主制',
  absolute_monarchy: '君主专制',
  bureaucratic_monarchy: '官僚君主制',
  rebel: '农民政权',
  maritime: '海商集团',
  khanate: '汗国',
  shogunate: '幕府',
  theocracy: '政教合一',
  company: '特许公司',
  tributary: '藩属',
  military_junta: '军事集团',
  feudal: '封建联盟',
  tribal_confederation: '部落联盟',
  merchant_republic: '商人共和',
  cossack_host: '哥萨克军镇',
};

const RELIGIONS: Record<string, string> = {
  confucian: '儒教',
  buddhist: '佛教',
  islam: '伊斯兰教',
  catholic: '天主教',
  orthodox: '东正教',
  shinto: '神道',
  shamanism: '萨满教',
  folk: '民间信仰',
  protestant: '新教',
  tengri: '腾格里',
  animist: '萨满',
};

const CULTURES: Record<string, string> = {
  chinese: '汉',
  manchu: '满',
  mongol: '蒙古',
  korean: '朝鲜',
  japanese: '日本',
  tibetan: '藏',
  dutch: '荷兰',
  russian: '俄罗斯',
  southeast_asian: '东南亚',
  han: '汉',
  jurchen: '女真',
};

const LEADER_EFFECTS: Record<string, string> = {
  taxEfficiencyPct: '税收效率',
  tradeEfficiencyPct: '贸易效率',
  stabilityMonthly: '稳定',
  corruptionMonthly: '腐败',
  mandateMonthly: '天命',
  armyAttackPct: '陆军攻击',
  armyDefensePct: '陆军防御',
  armyUpkeepPct: '军费',
};

function fallbackLeader(name: string, color: string): LeaderDef {
  return {
    name,
    title: '君主',
    style: 'king',
    trait: '守成之主',
    skin: '#e6c3a1',
    hair: '#241c18',
    robe: color,
    accent: '#b8892e',
  };
}

export function CountryPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const countryFocus = useGameStore(state => state.countryFocus);
  const openCountry = useGameStore(state => state.openCountry);
  const closePanel = useGameStore(state => state.closePanel);
  const command = useGameStore(state => state.command);
  if (!game) return null;

  const tag = countryFocus ?? game.playerTag;
  const def = content.countries.get(tag);
  const country = game.countries[tag];
  if (!def || !country) {
    return <div className="panel"><p className="muted">势力不存在。</p></div>;
  }
  const leader = def.leadersByScenario?.[game.scenarioId] ?? def.leader ?? fallbackLeader(def.name, def.color);
  const controlled = Object.values(game.provinces).filter(province => province.controller === tag);
  const owned = Object.values(game.provinces).filter(province => province.owner === tag);
  const controlledProvinces = controlledProvinceCount(game, content, tag);
  const ownedProvinces = ownedProvinceCount(game, content, tag);
  const activeFocus = country.focus ? content.focuses.get(country.focus.id) : null;
  const population = controlled.reduce((sum, province) => sum + province.population, 0);
  const armies = Object.values(game.armies).filter(army => army.tag === tag);
  const strength = armies.reduce((sum, army) => sum + army.composition.infantry
    + army.composition.firearm + army.composition.cavalry + army.composition.artillery + army.composition.naval, 0);
  const wars = Object.values(game.wars).filter(war => war.attacker === tag || war.defender === tag);
  const playerWar = wars.find(war => war.attacker === game.playerTag || war.defender === game.playerTag);
  const isPlayer = !game.spectator && tag === game.playerTag;
  const readOnly = game.spectator;
  const playerRelation = isPlayer
    ? 100
    : game.relations[relationKey(game.playerTag, tag)] ?? 0;
  const atWarWithPlayer = !isPlayer && areAtWar(game, game.playerTag, tag);
  const statusToPlayer = atWarWithPlayer ? '交战' : playerRelation >= 20 ? '友好' : '中立';
  const diplomacy = Object.values(game.countries)
    .filter(country => country.alive && country.tag !== tag)
    .map(country => {
      const relation = game.relations[relationKey(tag, country.tag)] ?? 0;
      const war = areAtWar(game, tag, country.tag);
      return {
        tag: country.tag,
        name: content.countries.get(country.tag)?.name ?? country.tag,
        relation,
        war,
        status: war ? '交战' : relation >= 20 ? '友好' : '中立',
        color: war ? '#a33a32' : relation >= 20 ? '#3f6f9a' : '#8a8578',
      };
    })
    .sort((a, b) => Number(b.war) - Number(a.war) || b.relation - a.relation);

  return (
    <div className="panel country-panel">
      <header className="panel-head">
        <div className="country-title">
          <CountryFlag country={def} width={66} />
          <div>
            <h2>{def.name}</h2>
            <p className="muted">{tag} · {GOVERNMENTS[def.government] ?? def.government} · {RELIGIONS[def.religion] ?? def.religion} · {CULTURES[def.culture] ?? def.culture}</p>
          </div>
        </div>
        <button onClick={closePanel}>关闭</button>
      </header>
      {def.goal && <p className="briefing-goal">战略目标：{def.goal}</p>}

      <section className="leader-card">
        <LeaderPortrait leader={leader} size={112} />
        <div className="leader-info">
          <p className="eyebrow">{leader.title}</p>
          <h3>{leader.name}</h3>
          <p className="leader-trait">{leader.trait}</p>
          {leader.quote && <blockquote className="leader-quote">“{leader.quote}”</blockquote>}
          {leader.effects && Object.keys(leader.effects).length > 0 && (
            <div className="leader-effects">
              {Object.entries(leader.effects).map(([key, value]) => (
                <span key={key} className={value >= 0 ? 'good' : 'danger'}>
                  {LEADER_EFFECTS[key] ?? key} {value >= 0 ? '+' : ''}{value}{key.endsWith('Monthly') ? '/月' : '%'}
                </span>
              ))}
            </div>
          )}
          {leader.timeline && leader.timeline.length > 0 && (
            <details className="leader-timeline">
              <summary>生平时间线</summary>
              <ol>
                {leader.timeline.map(entry => (
                  <li key={`${entry.year}-${entry.text}`}><b>{entry.year}</b><span>{entry.text}</span></li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </section>

      <section className="country-grid">
        <div className="country-stat"><span>首都</span><strong>{content.provinces.get(country.capital)?.name ?? country.capital}</strong></div>
        <div className="country-stat"><span>控制</span><strong>{controlledProvinces} / {content.prefectures.size} 省 · {controlled.length} / {content.provinces.size} 地区</strong></div>
        <div className="country-stat"><span>领有</span><strong>{ownedProvinces} 省 · {owned.length} 地区</strong></div>
        <div className="country-stat"><span>人口</span><strong>{formatNumber(population)}</strong></div>
        <div className="country-stat"><span>国库 / 欠饷</span><strong>{formatNumber(country.treasury)} / {formatNumber(country.arrears)}</strong></div>
        <div className="country-stat"><span>稳定 / 天命</span><strong>{Math.round(country.stability)} / {Math.round(country.mandate)}</strong></div>
        <div className="country-stat"><span>腐败 / 皇权</span><strong>{Math.round(country.corruption)} / {Math.round(country.authority)}</strong></div>
        <div className="country-stat"><span>军心 / 战争疲劳</span><strong>{Math.round(country.armyLoyalty)} / {Math.round(country.warExhaustion)}</strong></div>
        <div className="country-stat"><span>军队 / 兵力</span><strong>{armies.length} 支 / {formatNumber(strength)}</strong></div>
      </section>

      <section className="country-focus-card">
        <h3>当前国策</h3>
        {activeFocus && country.focus ? (
          <>
            <div className="country-focus-head">
              <b>{activeFocus.name}</b>
              <span>{Math.floor(country.focus.progress)} / {activeFocus.costDays} 日</span>
            </div>
            <progress value={Math.min(1, country.focus.progress / Math.max(1, activeFocus.costDays))} max={1} />
            <p className="country-focus-effect">效果：{effectsSummary(activeFocus.completionEffect)}</p>
            <p className="muted">{activeFocus.desc}</p>
            {!readOnly && tag === game.playerTag && (
              <button onClick={() => command({ type: 'focus.cancel' })}>取消国策（进度清零）</button>
            )}
          </>
        ) : (
          <p className="muted">当前没有进行中的国策。打开“国策”选择新的方向。</p>
        )}
      </section>

      <div className="diplo-self">
        <span className="dot" style={{ background: '#e0c26a' }} />
        <span>{readOnly ? '观测势力' : isPlayer ? '本国' : `本国 · 与我国：${statusToPlayer}（${playerRelation}）`}</span>
      </div>
      <div className="diplo-legend">
        <span><i className="dot war" />交战</span>
        <span><i className="dot friendly" />友好</span>
        <span><i className="dot neutral" />中立</span>
        <span className="muted">地图按 {def.name} 的关系着色</span>
      </div>

      <section>
        <h3 className="section-title">外交态势</h3>
        {diplomacy.map(row => (
          <button
            className={`diplo-row${row.tag === tag ? ' active' : ''}`}
            key={row.tag}
            onClick={() => openCountry(row.tag)}
          >
            <i className="dot" style={{ background: row.color }} />
            <span>{row.name}</span>
            <span className="muted">{row.status}</span>
            <b>{row.relation}</b>
          </button>
        ))}
      </section>

      <section>
        <h3 className="section-title">阶级</h3>
        {Object.entries(country.estates).map(([id, estate]) => {
          const estateDef = content.estateDefs.get(id);
          return (
            <div className="estate-mini" key={id}>
              <span>{estateDef?.name ?? id}</span>
              <span className="muted">影响 {Math.round(estate.influence)}</span>
              <div className="estate-bar"><i style={{ width: `${Math.max(0, Math.min(100, estate.influence))}%` }} /></div>
              <span className="muted">忠诚 {Math.round(estate.loyalty)}</span>
            </div>
          );
        })}
      </section>

      <section>
        <h3 className="section-title">战争</h3>
        {wars.length === 0 && <p className="muted">目前没有战争。</p>}
        {wars.map(war => {
          const enemy = war.attacker === tag ? war.defender : war.attacker;
          return (
            <div className="war-row" key={war.id}>
              <span>{content.countries.get(enemy)?.name ?? enemy}</span>
              <span className="muted">疲劳 {Math.round(war.exhaustion[tag] ?? 0)}</span>
              {!readOnly && enemy === game.playerTag && (
                <button onClick={() => command({ type: 'diplomacy.makePeace', warId: war.id })}>议和</button>
              )}
            </div>
          );
        })}
      </section>

      <footer className="panel-actions">
        {!readOnly && !isPlayer && !playerWar && (
          <button onClick={() => command({ type: 'diplomacy.declareWar', target: tag, cb: 'border_dispute' })}>宣战</button>
        )}
        {!readOnly && !isPlayer && <button onClick={() => openCountry(game.playerTag)}>查看我国</button>}
        <button className="ghost" onClick={closePanel}>返回地图</button>
      </footer>
    </div>
  );
}
