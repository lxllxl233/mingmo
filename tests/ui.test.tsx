import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { StartScreen } from '../src/ui/shell/StartScreen';
import { OnboardingOverlay } from '../src/ui/shell/OnboardingOverlay';
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

  it('pauses from the menu and resumes the previous speed', () => {
    const store = useGameStore.getState();
    store.start('1627', 'MING');
    store.setSpeed(2);
    store.setMenuOpen(true);
    expect(useGameStore.getState().menuOpen).toBe(true);
    expect(useGameStore.getState().speed).toBe(0);
    useGameStore.getState().setMenuOpen(false);
    expect(useGameStore.getState().speed).toBe(2);
  });

  it('tracks onboarding, settings and help flags', () => {
    const store = useGameStore.getState();
    store.start('1627', 'MING');
    store.updateSettings({ tutorialSeen: false });
    expect(renderToString(<OnboardingOverlay />)).toContain('第一步');
    store.setSettingsOpen(true);
    expect(useGameStore.getState().settingsOpen).toBe(true);
    store.setHelpOpen(true);
    expect(useGameStore.getState().helpOpen).toBe(true);
    expect(useGameStore.getState().settingsOpen).toBe(false);
    store.setHelpOpen(false);
    store.setMenuOpen(true);
    expect(useGameStore.getState().menuOpen).toBe(true);
  });

  it('marks the tutorial done', () => {
    useGameStore.getState().updateSettings({ tutorialSeen: false });
    useGameStore.getState().finishTutorial();
    expect(useGameStore.getState().settings.tutorialSeen).toBe(true);
  });

  it('stores separate music and sfx volumes', () => {
    useGameStore.getState().updateSettings({ musicVolume: 0.4, sfxVolume: 0.3 });
    expect(useGameStore.getState().settings.musicVolume).toBe(0.4);
    expect(useGameStore.getState().settings.sfxVolume).toBe(0.3);
  });
});
