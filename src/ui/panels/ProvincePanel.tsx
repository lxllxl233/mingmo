import { useGameStore } from '../state/store';
import { CountryFlag } from './CountryFlag';

const TERRAIN_NAMES: Record<string, string> = {
  plains: '平原',
  hills: '丘陵',
  mountains: '山地',
  wetland: '水网',
  desert: '荒漠',
  steppe: '草原',
  jungle: '丛林',
  urban: '城市',
};



export function ProvincePanel() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const selected = useGameStore(state => state.selectedProvince);
  const closePanel = useGameStore(state => state.closePanel);
  const command = useGameStore(state => state.command);
  if (!game || !selected) return null;
  const def = content.provinces.get(selected);
  const province = game.provinces[selected];
  if (!def || !province) return null;
  const owner = content.countries.get(province.owner);
  const controller = content.countries.get(province.controller);
  const prefecture = content.prefectures.get(def.prefectureId);
  const region = content.regions.get(def.regionId);
  const armies = Object.values(game.armies).filter(army => army.province === selected);
  const navalTemplates = [...content.armyTemplates.values()].filter(template => template.composition.naval > 0).slice(0, 3);
  const fleets = armies.filter(army => army.tag === game.playerTag && army.composition.naval > 0);
  const ownerEstate = content.countryEstates.get(province.owner)?.find(estate => estate.key === def.dominantEstate);
  const estateName = ownerEstate?.name ?? content.estateDefs.get(def.dominantEstate)?.name ?? def.dominantEstate;

  return (
    <div className="panel">
      <button className="close" onClick={closePanel}>关闭</button>
      <h2>地区 · {def.name}</h2>
      <p className="muted">{region?.name} · 所属省份：{prefecture?.name ?? '—'} · {TERRAIN_NAMES[def.terrain] ?? def.terrain}</p>
      <div className="row"><span>所有者</span><b style={{ color: owner?.color }}>{owner?.name ?? province.owner}</b></div>
      <div className="row"><span>控制者</span><b style={{ color: controller?.color }}>{controller?.name ?? province.controller}</b></div>
      {province.controller === game.playerTag && (
        <>
          <div className="row"><span>核心状态</span><b className={province.cores.includes(game.playerTag) ? 'good' : 'warn'}>
            {province.cores.includes(game.playerTag) ? '核心（100% 人力与资源）' : '占领区（15% 人力与资源）'}
          </b></div>
          {!province.cores.includes(game.playerTag) && (
            <div className="core-integrate">
              {province.coreWork ? (
                <p className="muted">收买人心：{province.coreWork.progress} / {province.coreWork.totalDays} 日</p>
              ) : (
                <button onClick={() => command({ type: 'province.integrateCore', provinceId: selected })}>
                  收买人心（30000 两 / 12000 石 / 360 日）
                </button>
              )}
            </div>
          )}
        </>
      )}
      <div className="core-owners">
        <span className="muted">拥有核心的势力</span>
        <div>
          {province.cores.map(tag => {
            const coreCountry = content.countries.get(tag);
            return coreCountry ? (
              <button key={tag} className="core-owner" onClick={() => useGameStore.getState().openCountry(tag)}>
                <CountryFlag country={coreCountry} width={18} />
                {coreCountry.name}
              </button>
            ) : null;
          })}
        </div>
      </div>
      <div className="row"><span>人口 / 田亩</span><b>{province.population.toLocaleString()} / {def.landholding.toLocaleString()} 万亩</b></div>
      <div className="row"><span>发展度</span><b>{def.development}</b></div>
      <div className="row"><span>占优阶级</span><b>{estateName}</b></div>
      <div className="row"><span>补给上限</span><b>{def.supplyLimit.toLocaleString()}</b></div>
      <div className="row"><span>要塞</span><b>{def.isFort ? `是（${def.fortLevel}）` : '无'}</b></div>
      <div className="row"><span>沿海 / 河流</span><b>{def.isCoastal ? '是' : '否'} / {def.isRiver ? '是' : '否'}</b></div>
      <div className="row"><span>港口</span><b>{def.isPort ? '是' : '否'}</b></div>
      <section className="building-section">
        <h3>营造</h3>
        {province.buildings.length > 0 && (
          <div className="building-tags">
            {province.buildings.map(id => <span key={id}>{content.buildings.get(id)?.name ?? id}</span>)}
          </div>
        )}
        {province.building ? (
          <div className="building-progress">
            <b>{content.buildings.get(province.building.id)?.name ?? province.building.id}</b>
            <span>剩余 {province.building.daysLeft} / {province.building.totalDays} 日</span>
            <div className="bar"><i style={{ width: `${Math.max(2, 100 - (province.building.daysLeft / Math.max(1, province.building.totalDays)) * 100)}%` }} /></div>
          </div>
        ) : province.controller === game.playerTag ? (
          <div className="building-list">
            {[...content.buildings.values()]
              .filter(building => !province.buildings.includes(building.id)
                && (building.terrain.length === 0 || building.terrain.includes(def.terrain)))
              .map(building => {
                const country = game.countries[game.playerTag];
                const affordable = (country?.treasury ?? 0) >= building.costSilver
                  && (country?.food ?? 0) >= building.costFood;
                return (
                  <button
                    key={building.id}
                    className="building-option"
                    disabled={!affordable}
                    title={`${building.desc}${affordable ? '' : `（需要银 ${building.costSilver.toLocaleString()} / 粮 ${building.costFood.toLocaleString()}）`}`}
                    onClick={() => command({ type: 'province.build', provinceId: selected, buildingId: building.id })}
                  >
                    <b>{building.name}</b>
                    <span>银 {building.costSilver.toLocaleString()} · 粮 {building.costFood.toLocaleString()} · {building.days} 日</span>
                  </button>
                );
              })}
          </div>
        ) : (
          <p className="muted">只有控制该地区才能营造。</p>
        )}
      </section>
      {def.isPort && (
        <section className="port-section">
          <h3>港口</h3>
          <p className="muted">
            {fleets.length > 0 ? `本港有 ${fleets.length} 支舰队，可护送陆军海运。` : '本港暂无舰队；建造战船后可进行海运。'}
          </p>
          {province.controller === game.playerTag && navalTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => command({ type: 'army.recruit', province: selected, template: template.id, size: 1 })}
            >
              建造 {template.name}
            </button>
          ))}
        </section>
      )}
      <div className="row"><span>民怨 / 破坏</span><b className={province.unrest > 60 ? 'danger' : ''}>{province.unrest.toFixed(0)} / {province.devastation.toFixed(0)}</b></div>
      {province.siege && (
        <div className="row"><span>围城</span><b>{province.siege.progress.toFixed(0)} / {def.fortLevel * 100}（{province.siege.days} 日）</b></div>
      )}
      {province.occupation && (
        <div className="row"><span>占领进度</span><b>{province.occupation.progress.toFixed(0)} / 100（{province.occupation.days} 日）</b></div>
      )}
      <h3>驻军</h3>
      {armies.length === 0 && <p className="muted">无</p>}
      {armies.length > 0 && (
        <div className="battle-summary">
          <span>战线宽度 <b>{content.balance.military.terrainWidth[def.terrain] ?? 20}</b></span>
          <span>进攻方 <b>{armies.filter(army => army.tag !== province.controller).length}</b></span>
          <span>防守方 <b>{armies.filter(army => army.tag === province.controller).length}</b></span>
          <span>工事 <b>{def.isFort ? `要塞 ${def.fortLevel}` : '野战'}</b></span>
        </div>
      )}
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
      <h3>相邻地区</h3>
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

