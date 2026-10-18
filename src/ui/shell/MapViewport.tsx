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
  const selectProvince = useGameStore(state => state.selectProvince);
  const selectArmy = useGameStore(state => state.selectArmy);

  const handleContextProvince = useCallback((provinceId: string) => {
    const state = useGameStore.getState();
    const game = state.game;
    if (!game) return;
    if (state.selectedArmy && game.armies[state.selectedArmy]) {
      state.moveArmyTo(provinceId);
      return;
    }
    const province = game.provinces[provinceId];
    const tag = province?.controller ?? province?.owner;
    if (tag) state.openCountry(tag);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new MapRenderer(host, content.geo, content, selectProvince, selectArmy, handleContextProvince);
    rendererRef.current = renderer;
    let cancelled = false;
    void renderer.init().then(() => {
      if (cancelled) return;
      const state = useGameStore.getState().game;
      if (state) {
        renderer.setState(state, useGameStore.getState().selectedProvince, useGameStore.getState().selectedArmy);
        renderer.setDiplomaticMode(useGameStore.getState().diplomaticMode);
      }
    });
    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [content, selectProvince, selectArmy, handleContextProvince]);

  useEffect(() => {
    if (game && rendererRef.current) {
      rendererRef.current.setState(game, selectedProvince, selectedArmy);
    }
  }, [game, version, selectedProvince, selectedArmy]);

  useEffect(() => {
    rendererRef.current?.setDiplomaticMode(diplomaticMode);
  }, [diplomaticMode]);

  return (
    <div className="map-host" ref={hostRef}>
      <div className="map-grain" />
    </div>
  );
}
