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
  const selectProvince = useGameStore(state => state.selectProvince);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new MapRenderer(host, content.geo, content, selectProvince);
    rendererRef.current = renderer;
    let cancelled = false;
    void renderer.init().then(() => {
      if (cancelled) return;
      const state = useGameStore.getState().game;
      if (state) renderer.setState(state, useGameStore.getState().selectedProvince);
    });
    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [content, selectProvince]);

  useEffect(() => {
    if (game && rendererRef.current) rendererRef.current.setState(game, selectedProvince);
  }, [game, version, selectedProvince]);

  return <div className="map-host" ref={hostRef} />;
}
