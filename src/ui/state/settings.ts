export interface UiSettings {
  musicVolume: number;
  muted: boolean;
  reduceMotion: boolean;
  tutorialSeen: boolean;
}

const STORAGE_KEY = 'jiashen.settings.v1';

export const DEFAULT_SETTINGS: UiSettings = {
  musicVolume: 0.65,
  muted: false,
  reduceMotion: false,
  tutorialSeen: false,
};

export function loadSettings(): UiSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      musicVolume: typeof parsed.musicVolume === 'number'
        ? Math.max(0, Math.min(1, parsed.musicVolume))
        : DEFAULT_SETTINGS.musicVolume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
      tutorialSeen: typeof parsed.tutorialSeen === 'boolean' ? parsed.tutorialSeen : DEFAULT_SETTINGS.tutorialSeen,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function persistSettings(settings: UiSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 隐私模式下忽略。
  }
}
