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

