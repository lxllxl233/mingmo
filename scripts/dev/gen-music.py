"""Generate two original, royalty-free ambient tracks for 甲申.

This is a one-off asset generator: pentatonic plucks + drone + soft frame drum,
rendered to 22.05 kHz mono WAV so the browser can stream them without a codec.
"""
import math
import os
import wave

import numpy as np

SR = 22050


def pluck(freq: float, duration: float, amp: float = 1.0) -> np.ndarray:
    t = np.arange(int(SR * duration)) / SR
    env = np.exp(-t * 3.2) * (1 - np.exp(-t * 120))
    out = np.zeros_like(t)
    for harmonic, weight in [(1, 1.0), (2, 0.42), (3, 0.22), (4, 0.1), (5, 0.05)]:
        out += weight * np.sin(2 * math.pi * freq * harmonic * t + harmonic * 0.4)
    # slight detune gives the pluck a wider, wooden body
    out += 0.18 * np.sin(2 * math.pi * freq * 1.003 * t)
    return out * env * amp


def drone(freq: float, duration: float, amp: float = 1.0) -> np.ndarray:
    t = np.arange(int(SR * duration)) / SR
    swell = 0.55 + 0.45 * np.sin(2 * math.pi * 0.045 * t - math.pi / 2)
    return (np.sin(2 * math.pi * freq * t) + 0.35 * np.sin(2 * math.pi * freq * 1.5 * t)) * swell * amp


def drum(duration: float, amp: float = 1.0) -> np.ndarray:
    t = np.arange(int(SR * duration)) / SR
    env = np.exp(-t * 18)
    body = np.sin(2 * math.pi * (62 - 18 * t) * t)
    click = np.random.default_rng(7).normal(0, 0.4, len(t)) * np.exp(-t * 60)
    return (body + click) * env * amp


def add_at(target: np.ndarray, sound: np.ndarray, start: float) -> None:
    i = int(start * SR)
    end = min(len(target), i + len(sound))
    if i < len(target):
        target[i:end] += sound[:end - i]


def reverb(x: np.ndarray) -> np.ndarray:
    out = x.copy()
    for delay, gain in [(0.17, 0.22), (0.29, 0.15), (0.43, 0.09)]:
        n = int(delay * SR)
        out[n:] += x[:-n] * gain
    return out


def write_wav(path: str, samples: np.ndarray) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    peak = np.max(np.abs(samples)) or 1.0
    samples = samples / peak * 0.88
    fade = int(SR * 1.2)
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    pcm = np.clip(samples * 32767, -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


D3, F3, G3, A3, C4, D4 = 146.83, 174.61, 196.00, 220.00, 261.63, 293.66
PENTA = [D3, F3, G3, A3, C4, D4, C4, A3]


def render_start() -> np.ndarray:
    duration = 48.0
    out = drone(D3 / 2, duration, 0.16) + drone(A3 / 2, duration, 0.07)
    rng = np.random.default_rng(1627)
    beat = 1.0
    for i in range(int(duration / beat)):
        if i % 4 == 0:
            add_at(out, drum(0.9, 0.12), i * beat)
        if i % 2 == 0:
            note = PENTA[(i // 2 + rng.integers(0, 3)) % len(PENTA)]
            add_at(out, pluck(note, 2.6, 0.22), i * beat + 0.02)
        if i % 8 == 4:
            add_at(out, pluck(PENTA[0] * 2, 2.2, 0.1), i * beat)
    return reverb(out)


def render_war() -> np.ndarray:
    duration = 48.0
    out = drone(D3 / 2, duration, 0.2) + drone(D3 * 0.75, duration, 0.08)
    rng = np.random.default_rng(1644)
    beat = 0.62
    for i in range(int(duration / beat)):
        if i % 2 == 0:
            add_at(out, drum(0.7, 0.2), i * beat)
        if i % 4 == 0:
            add_at(out, pluck(D3 / 2, 1.8, 0.2), i * beat)
        if i % 3 != 2:
            note = PENTA[(i + rng.integers(0, 2)) % len(PENTA)] * 2
            add_at(out, pluck(note, 1.5, 0.12), i * beat + 0.01)
    return reverb(out)


write_wav('public/audio/music/original/start_original.wav', render_start())
write_wav('public/audio/music/original/war_original.wav', render_war())
print('generated original music')
