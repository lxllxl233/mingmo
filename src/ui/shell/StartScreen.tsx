import { useEffect, useMemo, useState } from 'react';
import { hasLocal } from '../../app/save/save';
import { sound } from '../../app/audio/sound';
import { START_MUSIC } from '../../app/audio/music';
import { createInitialState } from '../../engine/state/initial';
import type { Difficulty } from '../../engine/state/types';
import { controlledProvinceCount } from '../../engine/rules/geography';
import { formatNumber } from '../format';
import { CountryFlag } from '../panels/CountryFlag';
import { LeaderPortrait } from '../panels/LeaderPortrait';
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
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [phase, setPhase] = useState<'scenario' | 'faction'>('scenario');

  useEffect(() => {
    const startMusic = () => {
      sound.unlock();
      sound.setMusicPlaylist(START_MUSIC);
    };
    window.addEventListener('pointerdown', startMusic, { once: true });
    window.addEventListener('keydown', startMusic, { once: true });
    return () => {
      window.removeEventListener('pointerdown', startMusic);
      window.removeEventListener('keydown', startMusic);
    };
  }, []);

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
      return createInitialState(content, scenario.id, 42, selectedTag, difficulty);
    } catch {
      return null;
    }
  }, [content, scenario, selectedTag, difficulty]);
  const previewCountry = preview?.countries[selectedTag];
  const previewDef = content.countries.get(selectedTag);
  const previewProvinces = preview && previewDef
    ? controlledProvinceCount(preview, content, selectedTag)
    : 0;
  const previewAreas = preview
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
        <h1>明末 华夏震荡</h1>
        <p className="subtitle">1616–1683 · 明清易代 · 省份—地区级大战略</p>
      </header>
      <div className="start-grid">
        <section className={phase === 'scenario' ? 'start-column start-full' : 'start-column'}>
          <h2>{phase === 'scenario' ? '剧本' : '已选剧本'} <small className="step-label">第一步</small></h2>
          {phase === 'faction' && (
            <button className="back-button" onClick={() => setPhase('scenario')}>← 返回剧本选择</button>
          )}
          {phase === 'scenario' && [...content.scenarios.values()].map(entry => (
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
            <div className="scenario-detail">
              <h3>{scenario.name} · {scenario.startDate}</h3>
              <p>{scenario.description}</p>
              {scenario.playerHints.map(hint => <div key={hint} className="scenario-hint">· {hint}</div>)}
            </div>
          )}
          {phase === 'scenario' && (
            <button className="primary next-button" onClick={() => setPhase('faction')}>进入势力选择 →</button>
          )}
          {phase === 'faction' && previewCountry && (
            <div className="start-briefing">
              <h3>开局态势 · {previewDef?.name ?? selectedTag}</h3>
              {previewDef?.goal && <p className="briefing-goal">战略目标：{previewDef.goal}</p>}
              {previewDef?.background && <p className="faction-history"><b>前因：</b>{previewDef.background}</p>}
              {previewDef?.outcome && <p className="faction-history"><b>历史结局：</b>{previewDef.outcome}</p>}
              <div className="briefing-grid">
                <span>领袖 <b>{previewLeader}</b></span>
                <span>国库 <b>{formatNumber(previewCountry.treasury)}</b></span>
                <span>粮储 <b>{formatNumber(previewCountry.food)}</b></span>
                <span>兵源 <b>{formatNumber(previewCountry.manpower)}</b></span>
                <span>稳定 <b>{Math.round(previewCountry.stability)}</b></span>
                <span>天命 <b>{Math.round(previewCountry.mandate)}</b></span>
                <span>控制省份 <b>{previewProvinces}</b> / {content.prefectures.size}</span>
                <span>控制地区 <b>{previewAreas}</b> / {content.provinces.size}</span>
                <span>军团 <b>{previewArmies}</b></span>
                <span>战争 <b>{previewWars}</b></span>
              </div>
            </div>
          )}
        </section>
        {phase === 'faction' && (
        <section className="start-column">
          <h2>势力 <small className="step-label">第二步</small></h2>
          <div className="difficulty-picker">
            <b>难度</b>
            {([
              ['easy', '简单'],
              ['normal', '普通'],
              ['hard', '困难'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={difficulty === value ? 'active' : ''}
                onClick={() => setDifficulty(value)}
              >
                {label}
              </button>
            ))}
            <p className="muted">
              {difficulty === 'easy' && 'AI 更保守、更晚宣战、更少多线出兵；不获得任何资源或战斗加成。'}
              {difficulty === 'normal' && 'AI 按史实性格行动；不获得任何资源或战斗加成。'}
              {difficulty === 'hard' && 'AI 更早宣战、更会选择弱邻、更愿意多路出兵；不获得任何资源或战斗加成。'}
            </p>
          </div>
          <div className="faction-grid">
            {tags.map(country => {
              const leader = country.leadersByScenario?.[scenario?.id ?? ''] ?? country.leader;
              return (
                <div
                  key={country.tag}
                  className={`faction-card${country.tag === selectedTag ? ' selected' : ''}`}
                  onClick={() => setTag(country.tag)}
                >
                  <div className="faction-card-top">
                    <CountryFlag country={country} width={34} />
                    {leader && <LeaderPortrait leader={leader} size={28} />}
                  </div>
                  <h3>{country.name}</h3>
                  <p className="faction-leader">领袖：{leader?.name ?? '—'} · {MECHANIC_LABELS[country.uniqueMechanic] ?? country.uniqueMechanic} · {PERSONALITY_LABELS[country.aiPersonality] ?? country.aiPersonality}</p>
                  <p className="goal">{country.goal}</p>
                  {country.background && <p className="faction-background">{country.background}</p>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="muted">随机种子 </label>
            <input value={seed} onChange={event => setSeed(event.target.value.replace(/[^0-9]/g, ''))} style={{ width: 120 }} />
          </div>
        </section>
        )}
      </div>
      <footer className="start-actions">
        <span className="hint">同一种子与同一串指令会得到逐日一致的结果。</span>
        {hasLocal('auto') && <button onClick={() => load('auto')}>读取自动存档</button>}
        {hasLocal('manual') && <button onClick={() => load('manual')}>读取手动存档</button>}
        {phase === 'faction' && (
          <button className="primary" onClick={() => start(scenarioId, selectedTag, Number(seed) || 42, difficulty)}>
            开始游戏
          </button>
        )}
      </footer>
    </div>
  );
}
