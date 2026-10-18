import { useGameStore } from '../state/store';

export function ProvincePanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const selected = useGameStore(state => state.selectedProvince);
  const closePanel = useGameStore(state => state.closePanel);
  if (!game || !selected) return null;
  const def = content.provinces.get(selected);
  const province = game.provinces[selected];
  if (!def || !province) return null;
  const owner = content.countries.get(province.owner);
  const controller = content.countries.get(province.controller);
  const prefecture = content.prefectures.get(def.prefectureId);
  const region = content.regions.get(def.regionId);
  const armies = Object.values(game.armies).filter(army => army.province === selected);
  const ownerEstate = content.countryEstates.get(province.owner)?.find(estate => estate.key === def.dominantEstate);
  const estateName = ownerEstate?.name ?? content.estateDefs.get(def.dominantEstate)?.name ?? def.dominantEstate;

  return (
    <div className="panel">
      <button className="close" onClick={closePanel}>关闭</button>
      <h2>{def.name}</h2>
      <p className="muted">{region?.name} · {prefecture?.name} · {def.terrain}</p>
      <div className="row"><span>所有者</span><b style={{ color: owner?.color }}>{owner?.name ?? province.owner}</b></div>
      <div className="row"><span>控制者</span><b style={{ color: controller?.color }}>{controller?.name ?? province.controller}</b></div>
      <div className="row"><span>人口 / 田亩</span><b>{province.population.toLocaleString()} / {def.landholding.toLocaleString()} 万亩</b></div>
      <div className="row"><span>发展度</span><b>{def.development}</b></div>
      <div className="row"><span>占优阶级</span><b>{estateName}</b></div>
      <div className="row"><span>补给上限</span><b>{def.supplyLimit.toLocaleString()}</b></div>
      <div className="row"><span>要塞</span><b>{def.isFort ? `是（${def.fortLevel}）` : '无'}</b></div>
      <div className="row"><span>沿海 / 河流</span><b>{def.isCoastal ? '是' : '否'} / {def.isRiver ? '是' : '否'}</b></div>
      <div className="row"><span>民怨 / 破坏</span><b className={province.unrest > 60 ? 'danger' : ''}>{province.unrest.toFixed(0)} / {province.devastation.toFixed(0)}</b></div>
      {province.siege && (
        <div className="row"><span>围城</span><b>{province.siege.progress.toFixed(0)} / {def.fortLevel * 100}（{province.siege.days} 日）</b></div>
      )}
      <h3>驻军</h3>
      {armies.length === 0 && <p className="muted">无</p>}
      {armies.map(army => {
        const strength = army.composition.infantry + army.composition.firearm + army.composition.cavalry
          + army.composition.artillery + army.composition.naval;
        return (
          <div className="row" key={army.id}>
            <span style={{ color: content.countries.get(army.tag)?.color }}>{army.name}</span>
            <b>{Math.round(strength).toLocaleString()} 人 · 组织 {army.organization.toFixed(0)}</b>
          </div>
        );
      })}
      <h3>相邻省份</h3>
      <div className="panel-actions">
        {def.neighbors.map(id => (
          <button key={id} onClick={() => useGameStore.getState().selectProvince(id)}>
            {content.provinces.get(id)?.name ?? id}
          </button>
        ))}
      </div>
    </div>
  );
}
