import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { StartScreen } from '../src/ui/shell/StartScreen';
import { useGameStore } from '../src/ui/state/store';

describe('ui renders without a browser', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('renders the start screen', () => {
    const html = renderToString(<StartScreen />);
    expect(html).toContain('甲申');
    expect(html).toContain('大明');
    expect(html).toContain('崇祯元年');
  });
});
