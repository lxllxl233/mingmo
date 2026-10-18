import type { MusicTrack } from './music';

type SoundKind = 'click' | 'command' | 'event' | 'choice' | 'battle' | 'save' | 'error';
type MusicLoop = 'off' | 'list' | 'single';

export interface MusicState {
  tracks: MusicTrack[];
  index: number;
  loop: MusicLoop;
  playing: boolean;
  volume: number;
}

const STORAGE_KEY = 'jiashen.muted';

class SoundEngine {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private musicTracks: MusicTrack[] = [];
  private musicIndex = 0;
  private musicLoop: MusicLoop = 'list';
  private musicPlaying = false;
  private musicVolume = 0.65;
  private musicAudio: HTMLAudioElement | null = null;
  private voiceAudio: HTMLAudioElement | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1';
      const storedVolume = localStorage.getItem('jiashen.musicVolume');
      const savedVolume = storedVolume === null ? 0.65 : Number(storedVolume);
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) this.musicVolume = savedVolume;
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopMusic();
      this.voiceAudio?.pause();
    } else if (this.musicTracks.length > 0) this.restartMusic();
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
    if (this.context.state === 'suspended') void this.context.resume();
  }

  getMusicState(): MusicState {
    return {
      tracks: this.musicTracks,
      index: this.musicIndex,
      loop: this.musicLoop,
      playing: this.musicPlaying && !this.muted,
      volume: this.musicVolume,
    };
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicAudio) this.musicAudio.volume = this.musicVolume;
    try {
      localStorage.setItem('jiashen.musicVolume', String(this.musicVolume));
    } catch {
      // 忽略隐私模式下的存储错误。
    }
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
    if (this.musicAudio) this.musicAudio.loop = loop === 'single';
    if (loop === 'off') this.stopMusic();
    else this.restartMusic();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicAudio) this.musicAudio.pause();
  }

  private restartMusic(): void {
    this.stopMusic();
    if (this.muted || this.musicLoop === 'off' || this.musicTracks.length === 0) return;
    this.musicPlaying = true;
    const track = this.musicTracks[this.musicIndex];
    if (track?.file && this.startAudio(track)) return;
    this.musicPlaying = false;
  }

  private startAudio(track: MusicTrack): boolean {
    if (!track.file || typeof Audio === 'undefined') return false;
    try {
      if (!this.musicAudio) this.musicAudio = new Audio();
      this.musicAudio.pause();
      this.musicAudio.src = track.file;
      this.musicAudio.loop = this.musicLoop === 'single';
      this.musicAudio.volume = this.musicVolume;
      this.musicAudio.onended = () => {
        if (!this.musicPlaying) return;
        if (this.musicLoop === 'single') {
          void this.musicAudio?.play();
          return;
        }
        this.musicIndex = (this.musicIndex + 1) % this.musicTracks.length;
        const next = this.musicTracks[this.musicIndex];
        if (next) this.startAudio(next);
      };
      void this.musicAudio.play().catch(() => {
        this.musicPlaying = false;
      });
      return true;
    } catch {
      return false;
    }
  }

  playArmySelect(tag: string, composition: {
    infantry: number;
    firearm: number;
    cavalry: number;
    artillery: number;
    naval: number;
  }): void {
    if (this.muted) return;
    this.unlock();
    const total = composition.infantry + composition.firearm + composition.cavalry
      + composition.artillery + composition.naval;
    const factionVoice: Record<string, string> = {
      MING: 'ming_line.mp3',
      QING: 'qing_array.mp3',
      SHUN: 'ming_line.mp3',
      XI: 'ming_line.mp3',
      SMING: 'ming_line.mp3',
      ZHENG: 'ming_line.mp3',
      MONGOL: 'mongol_line.mp3',
      JOSEON: 'joseon_line.mp3',
      JAPAN: 'japan_dress.mp3',
      TIBET: 'ming_line.mp3',
      VOC: 'voc_line.mp3',
      RUSSIA: 'russia_line.mp3',
    };
    let phrase = '集合！';
    let file = factionVoice[tag] ?? 'default_assemble.mp3';
    const chineseFaction = ['MING', 'QING', 'SHUN', 'XI', 'SMING', 'ZHENG', 'TIBET'].includes(tag);
    if (chineseFaction && total > 0 && composition.naval / total >= 0.35) { phrase = '扬帆！'; file = 'navy_sail.mp3'; }
    else if (chineseFaction && total > 0 && composition.cavalry / total >= 0.3) { phrase = '上马！'; file = 'cavalry_mount.mp3'; }
    else if (tag === 'ZHENG' && total > 0 && composition.naval / total >= 0.25) { phrase = '扬帆！'; file = 'navy_sail.mp3'; }
    this.playVoice(file, phrase);
    this.tone(96, 0.1, 'triangle', 0.025, 64);
  }

  private playVoice(file: string, fallbackText: string): void {
    if (this.muted) return;
    try {
      if (!this.voiceAudio) this.voiceAudio = new Audio();
      this.voiceAudio.pause();
      this.voiceAudio.src = `/audio/voices/${file}`;
      this.voiceAudio.volume = 0.8;
      void this.voiceAudio.play().catch(() => this.shout(fallbackText, 1));
    } catch {
      this.shout(fallbackText, 1);
    }
  }

  private shout(text: string, pitch: number): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.12;
      utterance.pitch = pitch;
      utterance.volume = this.muted ? 0 : 0.7;
      window.speechSynthesis.speak(utterance);
    } catch {
      // 系统语音不可用时保留鼓点提示。
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
    const safeVolume = Math.max(0.0001, volume);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(safeVolume, start + 0.012);
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
