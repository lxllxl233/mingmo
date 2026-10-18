import { useMemo, useState } from 'react';
import { hasLocal } from '../../app/save/save';
import { createInitialState } from '../../engine/state/initial';
import { formatNumber } from '../format';
import { useGameStore } from '../state/store';

const MECHANIC_LABELS: Record<string, string> = {
  party_strife: '党争',
  banner_system: '八旗编制',
  confiscation: '追赃助饷',
  terror: '恐怖统治',
  legitimacy_contest: '正统竞争',
  maritime_network: '海贸网络',
  banner_league: '盟旗',
  tribute: '事大朝贡',
  sakoku: '锁国',
  theocracy: '政教合一',
  company_dividend: '公司分红',
  cossack_host: '哥萨克',
  tributary: '藩属',
};

const PERSONALITY_LABELS: Record<string, string> = {
  aggressive: '好战',
  defensive: '守成',
  opportunistic: '投机',
  mercantile: '重商',
  bureaucratic: '官僚',
};

export function StartScreen() {
  const content = useGameStore(state => state.content);
  const start = useGameStore(state => state.start);
  const load = useGameStore(state => state.load);
  const [scenarioId, setScenarioId] = useState('1627');
  const [tag, setTag] = useState('MING');
  const [seed, setSeed] = useState('42');

  const scenario = content.scenarios.get(scenarioId);
  const tags = useMemo(() => {
    if (!scenario) return [];
    const allowed = scenario.playableTags.length > 0
      ? scenario.playableTags
      : [...content.countries.values()].filter(country => country.playable).map(country => country.tag);
    return allowed
      .map(id => content.countries.get(id))
      .filter((country): country is NonNullable<typeof country> => country !== undefined);
  }, [scenario, content]);

  const selectedTag = tags.some(country => country.tag === tag) ? tag : (tags[0]?.tag ?? 'MING');

  const preview = useMemo(() => {
    if (!scenario) return null;
    try {
      return createInitialState(content, scenario.id, 42, selectedTag);
    } catch {
      return null;
    }
  }, [content, scenario, selectedTag]);
  const previewCountry = preview?.countries[selectedTag];
  const previewDef = content.countries.get(selectedTag);
  const previewProvinces = preview
    ? Object.values(preview.provinces).filter(province => province.controller === selectedTag).length
    : 0;
  const previewArmies = preview
    ? Object.values(preview.armies).filter(army => army.tag === selectedTag).length
    : 0;
  const previewWars = preview
    ? preview.wars.filter(war => war.attacker === selectedTag || war.defender === selectedTag).length
    : 0;
  const previewLeader = previewDef?.leadersByScenario?.[scenario?.id ?? '']?.name ?? previewDef?.leader?.name ?? '—';

  return (
    <div className="start">
      <header>
        <h1>甲申</h1>
        <p className="subtitle">1616–1683 · 明末清初 · 省份级大战略</p>
      </header>
      <div className="start-grid">
        <section className="start-column">
          <h2>剧本</h2>
          {[...content.scenarios.values()].map(entry => (
            <div
              key={entry.id}
              className={`scenario-card${entry.id === scenarioId ? ' selected' : ''}`}
              onClick={() => setScenarioId(entry.id)}
            >
              <h3>{entry.name}</h3>
              <p>{entry.description}</p>
              <p style={{ marginTop: 6 }}>
                {entry.startDate} · 可玩 {entry.playableTags.length || content.countries.size} 方
              </p>
            </div>
          ))}
          {scenario && (
            <div className="muted" style={{ marginTop: 12 }}>
              {scenario.playerHints.map(hint => <div key={hint}>· {hint}</div>)}
            </div>
          )}
        </section>
        <section className="start-column">
          <h2>势力</h2>
          <div className="faction-grid">
            {tags.map(country => (
              <div
                key={country.tag}
                className={`faction-card${country.tag === selectedTag ? ' selected' : ''}`}
                onClick={() => setTag(country.tag)}
              >
                <h3><span className="faction-dot" style={{ background: country.color }} />{country.name}</h3>
                <p>{MECHANIC_LABELS[country.uniqueMechanic] ?? country.uniqueMechanic} · {PERSONALITY_LABELS[country.aiPersonality] ?? country.aiPersonality}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="muted">随机种子 </label>
            <input value={seed} onChange={event => setSeed(event.target.value.replace(/[^0-9]/g, ''))} style={{ width: 120 }} />
          </div>
          {previewCountry && (
            <div className="start-briefing">
              <h3>开局态势 · {previewDef?.name ?? selectedTag}</h3>
              <div className="briefing-grid">
                <span>领袖 <b>{previewLeader}</b></span>
                <span>国库 <b>{formatNumber(previewCountry.treasury)}</b></span>
                <span>粮储 <b>{formatNumber(previewCountry.food)}</b></span>
                <span>兵源 <b>{formatNumber(previewCountry.manpower)}</b></span>
                <span>稳定 <b>{Math.round(previewCountry.stability)}</b></span>
                <span>天命 <b>{Math.round(previewCountry.mandate)}</b></span>
                <span>控制省份 <b>{previewProvinces}</b></span>
                <span>军团 <b>{previewArmies}</b></span>
                <span>战争 <b>{previewWars}</b></span>
              </div>
            </div>
          )}
        </section>
      </div>
      <footer className="start-actions">
        <span className="hint">同一种子与同一串指令会得到逐日一致的结果。</span>
        {hasLocal('auto') && <button onClick={() => load('auto')}>读取自动存档</button>}
        {hasLocal('manual') && <button onClick={() => load('manual')}>读取手动存档</button>}
        <button className="primary" onClick={() => start(scenarioId, selectedTag, Number(seed) || 42)}>
          开始游戏
        </button>
      </footer>
    </div>
  );
}
