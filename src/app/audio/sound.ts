import type { MusicTrack } from './music';

type SoundKind = 'click' | 'command' | 'event' | 'choice' | 'battle' | 'save' | 'error';
type MusicLoop = 'off' | 'list' | 'single';

export interface MusicState {
  tracks: MusicTrack[];
  index: number;
  loop: MusicLoop;
  playing: boolean;
}

const STORAGE_KEY = 'jiashen.muted';

class SoundEngine {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private musicTracks: MusicTrack[] = [];
  private musicIndex = 0;
  private musicLoop: MusicLoop = 'list';
  private musicTimer: number | null = null;
  private musicPlaying = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopMusic();
    else if (this.musicTracks.length > 0) this.restartMusic();
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // 忽略隐私模式下的存储错误。
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  unlock(): void {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
    if (!this.context) {
      try {
        this.context = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.context.state === 'suspended') {
      void this.context.resume().then(() => {
        if (this.musicPlaying) this.playMusicPhrase();
      });
    }
  }

  getMusicState(): MusicState {
    return {
      tracks: this.musicTracks,
      index: this.musicIndex,
      loop: this.musicLoop,
      playing: this.musicPlaying && !this.muted,
    };
  }

  setMusicPlaylist(tracks: MusicTrack[], index = 0): void {
    this.musicTracks = [...tracks];
    this.musicIndex = Math.max(0, Math.min(index, this.musicTracks.length - 1));
    this.musicLoop = 'list';
    if (this.muted) {
      this.musicPlaying = false;
      return;
    }
    this.unlock();
    this.restartMusic();
  }

  selectMusic(index: number): void {
    if (index < 0 || index >= this.musicTracks.length) return;
    this.musicIndex = index;
    this.restartMusic();
  }

  setMusicLoop(loop: MusicLoop): void {
    this.musicLoop = loop;
    if (loop === 'off') this.stopMusic();
    else this.restartMusic();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private restartMusic(): void {
    this.stopMusic();
    if (this.muted || this.musicLoop === 'off' || this.musicTracks.length === 0) return;
    this.musicPlaying = true;
    this.playMusicPhrase();
    this.musicTimer = window.setInterval(() => this.nextMusicPhrase(), 7200);
  }

  private nextMusicPhrase(): void {
    if (!this.musicPlaying || this.muted) return;
    if (this.musicLoop === 'list' && this.musicTracks.length > 1) {
      this.musicIndex = (this.musicIndex + 1) % this.musicTracks.length;
    }
    this.playMusicPhrase();
  }

  private playMusicPhrase(): void {
    if (this.muted || this.context?.state !== 'running') return;
    const track = this.musicTracks[this.musicIndex];
    if (!track) return;
    const notes = track.notes;
    for (let i = 0; i < notes.length; i += 1) {
      const frequency = notes[i];
      if (frequency === undefined) continue;
      this.tone(frequency, 0.9, 'sine', 0.012, frequency * 0.998, i * 0.72);
      if (i % 4 === 0) this.tone(frequency / 2, 1.6, 'triangle', 0.006, frequency / 2, i * 0.72);
    }
  }

  play(kind: SoundKind): void {
    if (this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context || context.state !== 'running') return;
    try {
      switch (kind) {
        case 'click':
          this.tone(920, 0.045, 'triangle', 0.018, 720);
          break;
        case 'command':
          this.tone(440, 0.1, 'sine', 0.025, 660);
          break;
        case 'event':
          this.tone(146, 0.55, 'sine', 0.045, 98);
          this.tone(219, 0.45, 'sine', 0.022, 164, 0.04);
          break;
        case 'choice':
          this.noise(0.09, 1800, 0.02);
          this.tone(520, 0.12, 'triangle', 0.02, 700);
          break;
        case 'battle':
          this.noise(0.42, 420, 0.04);
          this.tone(58, 0.42, 'sine', 0.06, 40);
          this.tone(92, 0.3, 'triangle', 0.03, 70, 0.06);
          break;
        case 'save':
          this.tone(523, 0.16, 'sine', 0.025);
          this.tone(784, 0.24, 'sine', 0.022, 784, 0.1);
          break;
        case 'error':
          this.tone(180, 0.14, 'sawtooth', 0.025, 120);
          break;
      }
    } catch {
      // 音频失败不影响游戏。
    }
  }

  private tone(
    startFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = startFrequency,
    delay = 0,
  ): void {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(duration: number, lowpass: number, volume: number): void {
    const context = this.context;
    if (!context) return;
    if (!this.noiseBuffer) {
      const length = Math.floor(context.sampleRate * 1.2);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpass, context.currentTime);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    source.stop(context.currentTime + duration);
  }
}

export const sound = new SoundEngine();
export type { SoundKind };
