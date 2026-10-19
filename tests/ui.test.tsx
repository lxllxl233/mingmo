import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { StartScreen } from '../src/ui/shell/StartScreen';
import { useGameStore } from '../src/ui/state/store';

describe('ui renders without a browser', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('clears single and batch army selection on demand', () => {
    const store = useGameStore.getState();
    store.start('1627', 'MING');
    const armies = Object.values(useGameStore.getState().game?.armies ?? {})
      .filter(army => army.tag === 'MING');
    expect(armies.length).toBeGreaterThan(0);
    store.selectArmy(armies[0]?.id ?? null);
    expect(useGameStore.getState().selectedArmy).not.toBeNull();
    store.clearArmySelection();
    expect(useGameStore.getState().selectedArmy).toBeNull();
    store.openArmyStack(armies.slice(0, 2).map(army => army.id));
    expect(useGameStore.getState().armyStack?.length).toBe(2);
    store.clearArmySelection();
    expect(useGameStore.getState().armyStack).toBeNull();
  });

  it('renders the start screen', () => {
    const html = renderToString(<StartScreen />);
    expect(html).toContain('甲申');
    expect(html).toContain('大明');
    expect(html).toContain('崇祯元年');
  });
});
