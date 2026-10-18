import { useCallback, useEffect, useRef } from 'react';
import { MapRenderer } from '../../map/render/MapRenderer';
import { useGameStore } from '../state/store';

export function MapViewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const content = useGameStore(state => state.content);
  const game = useGameStore(state => state.game);
  const version = useGameStore(state => state.version);
  const selectedProvince = useGameStore(state => state.selectedProvince);
  const selectedArmy = useGameStore(state => state.selectedArmy);
  const diplomaticMode = useGameStore(state => state.diplomaticMode);
  const diplomaticAnchor = useGameStore(state => state.diplomaticAnchor);
  const panel = useGameStore(state => state.panel);
  const mapMode = panel === 'estates'
    ? 'estates'
    : panel === 'budget'
      ? 'finance'
      : panel === 'military'
        ? 'military'
        : panel === 'core'
          ? 'core'
          : panel === 'diplomacy' || diplomaticMode
            ? 'diplomacy'
            : 'normal';
  const mapAnchor = panel === 'diplomacy' ? game?.playerTag ?? null : diplomaticAnchor;
  const selectProvince = useGameStore(state => state.selectProvince);
  const selectArmy = useGameStore(state => state.selectArmy);
  const trainingRequest = useGameStore(state => state.trainingRequest);
  const cancelTrainingRequest = useGameStore(state => state.cancelTrainingRequest);

  const lastArmyClickRef = useRef<{ id: string; at: number }>({ id: '', at: 0 });

  const handleSelectArmy = useCallback((armyId: string) => {
    const now = performance.now();
    if (lastArmyClickRef.current.id === armyId && now - lastArmyClickRef.current.at < 150) return;
    lastArmyClickRef.current = { id: armyId, at: now };
    const state = useGameStore.getState();
    if (state.trainingRequest) {
      const army = state.game?.armies[armyId];
      if (army) state.deployTraining(army.province);
      return;
    }
    state.selectArmy(armyId);
  }, []);

  const handleSelectProvince = useCallback((provinceId: string) => {
    const state = useGameStore.getState();
    if (state.trainingRequest) {
      state.deployTraining(provinceId);
      return;
    }
    state.selectProvince(provinceId);
  }, []);

  const handleContextProvince = useCallback((provinceId: string, ctrlKey: boolean) => {
    const state = useGameStore.getState();
    const game = state.game;
    if (!game) return;
    if (state.selectedArmy && game.armies[state.selectedArmy]) {
      if (ctrlKey) state.appendArmyWaypoint(provinceId);
      else state.moveArmyTo(provinceId);
      return;
    }
    const province = game.provinces[provinceId];
    const tag = province?.controller ?? province?.owner;
    if (tag) state.openCountry(tag);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new MapRenderer(host, content.geo, content, handleSelectProvince, handleSelectArmy, handleContextProvince);
    rendererRef.current = renderer;
    let cancelled = false;
    void renderer.init().then(() => {
      if (cancelled) return;
      const state = useGameStore.getState().game;
      if (state) {
        renderer.setState(state, useGameStore.getState().selectedProvince, useGameStore.getState().selectedArmy);
        renderer.setMapMode(mapMode, mapAnchor);
      }
    });
    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [content, selectProvince, selectArmy, handleContextProvince, handleSelectProvince, handleSelectArmy]);

  useEffect(() => {
    if (game && rendererRef.current) {
      rendererRef.current.setState(game, selectedProvince, selectedArmy);
    }
  }, [game, version, selectedProvince, selectedArmy]);

  useEffect(() => {
    rendererRef.current?.setMapMode(mapMode, mapAnchor);
  }, [mapMode, mapAnchor]);

  useEffect(() => {
    rendererRef.current?.setDeploymentTargets(
      trainingRequest?.kind ?? null,
      trainingRequest ? game?.playerTag ?? null : null,
    );
  }, [trainingRequest, game?.playerTag]);

  return (
    <div className="map-host" ref={hostRef}>
      <div className="map-grain" />
      {trainingRequest && (
        <div className="deploy-banner">
          <b>{trainingRequest.kind === 'navy' ? '部署水军' : '部署陆军'}</b>
          <span>点击地图上的{trainingRequest.kind === 'navy' ? '我方港口' : '我方地区'}开始训练</span>
          <button onClick={cancelTrainingRequest}>取消</button>
        </div>
      )}
      {mapMode !== 'normal' && (
        <div className="map-mode-legend">
          <b>
            {mapMode === 'estates' && '阶级地图'}
            {mapMode === 'finance' && '财政地图'}
            {mapMode === 'military' && '军事地图'}
            {mapMode === 'core' && '核心地图'}
            {mapMode === 'diplomacy' && '外交地图'}
          </b>
          {mapMode === 'estates' && (
            <>
              <span><i style={{ background: '#b8892e' }} />宗室贵族</span>
              <span><i style={{ background: '#3f6f9a' }} />官僚</span>
              <span><i style={{ background: '#5f7d4a' }} />士绅</span>
              <span><i style={{ background: '#c46a2b' }} />商人</span>
              <span><i style={{ background: '#9a7b4f' }} />农民</span>
              <span><i style={{ background: '#a33a32' }} />军人</span>
            </>
          )}
          {mapMode === 'finance' && (
            <>
              <span><i style={{ background: '#a33a32' }} />低发展</span>
              <span><i style={{ background: '#d4b25a' }} />高发展</span>
              <span className="muted">按地区发展度着色</span>
            </>
          )}
          {mapMode === 'military' && (
            <>
              <span><i style={{ background: '#3f6f9a' }} />我军</span>
              <span><i style={{ background: '#a33a32' }} />敌军</span>
              <span><i style={{ background: '#8a8578' }} />无军</span>
            </>
          )}
          {mapMode === 'core' && (
            <>
              <span><i style={{ background: '#6f8a5a' }} />核心</span>
              <span><i style={{ background: '#b0603f' }} />占领区</span>
              <span><i style={{ background: '#9a9384' }} />他国</span>
            </>
          )}
          {mapMode === 'diplomacy' && (
            <>
              <span><i style={{ background: '#a33a32' }} />交战</span>
              <span><i style={{ background: '#3f6f9a' }} />友好</span>
              <span><i style={{ background: '#8a8578' }} />中立</span>
              <span><i style={{ background: '#e0c26a' }} />本国/目标</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

