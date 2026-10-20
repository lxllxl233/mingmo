import { Profiler } from 'react';
import { useGameStore } from '../state/store';
import { onReactRender } from '../perf';
import { StartScreen } from './StartScreen';
import { GameShell } from './GameShell';

export function App() {
  const game = useGameStore(state => state.game);
  if (!game) return <StartScreen />;
  if (!import.meta.env.DEV) return <GameShell />;
  return (
    <Profiler id="game" onRender={onReactRender}>
      <GameShell />
    </Profiler>
  );
}
