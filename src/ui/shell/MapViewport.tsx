import { useEffect, useRef } from 'react';
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
  const selectProvince = useGameStore(state => state.selectProvince);
  const selectArmy = useGameStore(state => state.selectArmy);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new MapRenderer(host, content.geo, content, selectProvince, selectArmy);
    rendererRef.current = renderer;
    let cancelled = false;
    void renderer.init().then(() => {
      if (cancelled) return;
      const state = useGameStore.getState().game;
      if (state) {
        renderer.setState(state, useGameStore.getState().selectedProvince, useGameStore.getState().selectedArmy);
      }
    });
    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [content, selectProvince, selectArmy]);

  useEffect(() => {
    if (game && rendererRef.current) {
      rendererRef.current.setState(game, selectedProvince, selectedArmy);
    }
  }, [game, version, selectedProvince, selectedArmy]);

  return (
    <div className="map-host" ref={hostRef}>
      <div className="map-grain" />
    </div>
  );
}
