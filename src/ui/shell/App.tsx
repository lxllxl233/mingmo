import { useGameStore } from '../state/store';
import { StartScreen } from './StartScreen';
import { GameShell } from './GameShell';

export function App() {
  const game = useGameStore(state => state.game);
  return game ? <GameShell /> : <StartScreen />;
}
