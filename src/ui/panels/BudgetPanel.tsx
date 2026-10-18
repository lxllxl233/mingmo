import { useGameStore } from '../state/store';
import { formatNumber } from '../format';

export function BudgetPanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  if (!game) return null;
  const country = game.countries[game.playerTag];
  if (!country) return null;
  const report = country.lastReport;

  return (
    <div className="panel">
      <h2>财政</h2>
      <div className="row"><span>国库</span><b>{Math.round(country.treasury).toLocaleString()} 两</b></div>
      <div className="row"><span>粮储</span><b>{Math.round(country.food).toLocaleString()} 石</b></div>
      <div className="row"><span>欠饷</span><b className={country.arrears > 0 ? 'danger' : ''}>{Math.round(country.arrears).toLocaleString()} 两</b></div>
      <div className="row"><span>通胀 / 腐败</span><b>{country.inflation.toFixed(0)} / {country.corruption.toFixed(0)}</b></div>
      {!report && <p className="muted">尚未结算。按 1x 推进到下个月。</p>}
      {report && (
        <>
          <h3>本月收支</h3>
          <table className="table">
            <tbody>
              <tr><td>阶级实收</td><td>{formatNumber(report.income)}</td></tr>
              <tr><td>军饷</td><td>-{formatNumber(report.expenseArmy)}</td></tr>
              <tr><td>官俸</td><td>-{formatNumber(report.expenseOfficials)}</td></tr>
              <tr><td>宗禄</td><td>-{formatNumber(report.expenseDynasty)}</td></tr>
              <tr><td>净额</td><td className={report.net < 0 ? 'danger' : ''}>{report.net > 0 ? '+' : ''}{formatNumber(report.net)}</td></tr>
            </tbody>
          </table>
          <h3>按阶级</h3>
          <table className="table">
            <thead><tr><th>阶级</th><th>银</th><th>粮</th></tr></thead>
            <tbody>
              {Object.entries(report.silverByEstate).map(([key, silver]) => (
                <tr key={key}>
                  <td>{content.countryEstates.get(country.tag)?.find(estate => estate.key === key)?.name ?? key}</td>
                  <td>{formatNumber(silver)}</td>
                  <td>{formatNumber(report.foodByEstate[key] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {country.monthlyHistory.length > 1 && (
            <>
              <h3>近月趋势</h3>
              <table className="table">
                <thead><tr><th>月</th><th>收</th><th>支</th><th>净</th></tr></thead>
                <tbody>
                  {country.monthlyHistory.slice(-8).map(entry => (
                    <tr key={entry.day}>
                      <td>{Math.floor(entry.day / 30)}</td>
                      <td>{formatNumber(entry.income)}</td>
                      <td>{formatNumber(entry.expense)}</td>
                      <td className={entry.net < 0 ? 'danger' : ''}>{formatNumber(entry.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
