import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { StartScreen } from '../src/ui/shell/StartScreen';
import { PauseMenu } from '../src/ui/shell/PauseMenu';
import { SettingsModal } from '../src/ui/shell/SettingsModal';
import { HelpOverlay } from '../src/ui/shell/HelpOverlay';
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

  it('renders onboarding, pause, settings and help overlays', () => {
    const store = useGameStore.getState();
    store.start('1627', 'MING');
    store.updateSettings({ tutorialSeen: false });
    expect(renderToString(<OnboardingOverlay />)).toContain('第一步');
    store.setSettingsOpen(true);
    expect(renderToString(<SettingsModal />)).toContain('音乐音量');
    store.setSettingsOpen(false);
    store.setHelpOpen(true);
    expect(renderToString(<HelpOverlay />)).toContain('怎么玩');
    store.setHelpOpen(false);
    store.setMenuOpen(true);
    expect(renderToString(<PauseMenu />)).toContain('暂停');
  });

  it('marks the tutorial done', () => {
    useGameStore.getState().updateSettings({ tutorialSeen: false });
    useGameStore.getState().finishTutorial();
    expect(useGameStore.getState().settings.tutorialSeen).toBe(true);
  });
});
