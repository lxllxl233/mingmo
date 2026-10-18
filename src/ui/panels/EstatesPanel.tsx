import { useGameStore } from '../state/store';

export function EstatesPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const configs = content.countryEstates.get(country.tag) ?? [];

  return (
    <div className="panel">
      <h2>阶级与税法</h2>
      <p className="muted">
        税不是国家收的，是从某个阶级手里抠出来的。改革需 90 日、50 政治点，期间征收效率 -20%。
      </p>
      <div className="row"><span>政治点</span><b>{Math.round(country.politicalPower)}</b></div>
      {configs.map(config => {
        const estate = country.estates[config.key];
        if (!estate) return null;
        const laws = (content.taxLawsByEstate.get(config.key) ?? [])
          .filter(law => law.country === undefined || law.country === country.tag)
          .sort((a, b) => a.rate - b.rate);
        const currentLaw = content.taxLaws.get(estate.taxLaw);
        const reform = estate.reform;
        return (
          <div className="estate-card" key={config.key}>
            <div className="head">
              <span className="name">{config.name}</span>
              <span className="muted">收入占比 {(config.incomeShare * 100).toFixed(1)}%</span>
            </div>
            <div className="metrics">
              <span>忠诚 {estate.loyalty.toFixed(0)}</span>
              <span>影响 {estate.influence.toFixed(0)}</span>
              <span>实收 {Math.round(estate.collected).toLocaleString()}</span>
            </div>
            <div className="bar"><span style={{ width: `${estate.loyalty}%`, background: estate.loyalty < 30 ? 'var(--danger)' : 'var(--red)' }} /></div>
            <div className="law">
              现行：{currentLaw?.name ?? estate.taxLaw}（税率 {((currentLaw?.rate ?? 0) * 100).toFixed(1)}% · 效率 {((currentLaw?.efficiency ?? 0) * 100).toFixed(0)}%）
            </div>
            {reform && <div className="muted">改革中：{content.taxLaws.get(reform.law)?.name}，剩余 {reform.daysLeft} 日</div>}
            {estate.cooldownDays > 0 && <div className="muted">冷却：{estate.cooldownDays} 日</div>}
            <select
              value={estate.taxLaw}
              disabled={estate.reform !== null || estate.cooldownDays > 0}
              onChange={event => command({ type: 'tax.setLaw', estate: config.key, lawId: event.target.value })}
            >
              {laws.map(law => (
                <option key={law.id} value={law.id}>
                  {law.name} · {((law.rate * 100).toFixed(1))}% · 忠诚{law.loyaltyDrift > 0 ? '+' : ''}{law.loyaltyDrift}
                  {law.incidence ? ` · 转嫁${law.incidence.estate}` : ''}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
