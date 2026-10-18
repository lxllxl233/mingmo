import type { Tech } from '../../content/types';
import { isTechAvailable } from '../../engine/systems/research';
import { useGameStore } from '../state/store';
import { effectsSummary } from '../format';

const CATEGORIES: Array<{ key: Tech['category']; label: string }> = [
  { key: 'military', label: '军事' },
  { key: 'agriculture', label: '农业' },
  { key: 'administration', label: '行政' },
  { key: 'fiscal', label: '财政' },
  { key: 'thought', label: '思想技艺' },
];

export function ResearchPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;

  return (
    <div className="panel">
      <h2>科研</h2>
      <p className="muted">研究槽 {country.research.length} / {country.researchSlots}。同一科技完成后才会解锁后继。</p>
      {country.research.map(slot => {
        const tech = content.techs.get(slot.techId);
        if (!tech) return null;
        return (
          <div className="row" key={slot.techId}>
            <span>{tech.name}</span>
            <b>{Math.floor(slot.progress)} / {tech.costDays} 日</b>
          </div>
        );
      })}
      <div className="tech-columns">
        {CATEGORIES.map(category => (
          <div key={category.key}>
            <h3>{category.label}</h3>
            {(content.techsByCategory.get(category.key) ?? []).sort((a, b) => a.era - b.era || a.costDays - b.costDays).map(tech => {
              const completed = country.completedTechs.includes(tech.id);
              const active = country.research.some(slot => slot.techId === tech.id);
              const available = isTechAvailable(game, content, country.tag, tech);
              const status = completed ? 'completed' : active ? 'available' : available ? 'available' : 'locked';
              return (
                <div
                  key={tech.id}
                  className={`tech-card ${status}`}
                  onClick={() => { if (available) command({ type: 'research.start', techId: tech.id }); }}
                  title={tech.desc}
                >
                  <div className="tname">{tech.name}</div>
                  <div className="tmeta">{tech.costDays} 日 · {tech.era}</div>
                  <div className="tmeta">{completed ? '已完成' : active ? '研究中' : effectsSummary(tech.effects)}</div>
                  {tech.prerequisites.length > 0 && !completed && (
                    <div className="tmeta">前置：{tech.prerequisites.map(id => content.techs.get(id)?.name ?? id).join('、')}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
