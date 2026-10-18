import math
import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'music')

MINOR = [0, 2, 3, 5, 7, 8, 10]
MAJOR = [0, 2, 4, 5, 7, 9, 11]


def freq(root, semitones):
    return root * (2 ** (semitones / 12))


def pluck(f, duration, volume=0.16):
    n = int(duration * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 4.2) * (1 - np.exp(-t * 80))
    tone = (
        np.sin(2 * np.pi * f * t)
        + 0.42 * np.sin(4 * np.pi * f * t)
        + 0.18 * np.sin(6 * np.pi * f * t)
    )
    return tone * env * volume


def pad(f, duration, volume=0.035):
    n = int(duration * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t * 3) * np.minimum(1, (duration - t) * 2.5)
    tone = (
        np.sin(2 * np.pi * f * t)
        + 0.4 * np.sin(2 * np.pi * f * 1.005 * t)
        + 0.25 * np.sin(2 * np.pi * f * 0.5 * t)
    )
    return tone * env * volume


def drum(duration, low=True, volume=0.16):
    n = int(duration * SR)
    t = np.arange(n) / SR
    if low:
        env = np.exp(-t * 24)
        return np.sin(2 * np.pi * (58 - 18 * t / duration) * t) * env * volume
    noise = np.random.default_rng(7).normal(0, 1, n)
    env = np.exp(-t * 35)
    return noise * env * volume * 0.5


def add(buffer, sound, start):
    at = int(start * SR)
    end = min(len(buffer), at + len(sound))
    if end > at:
        buffer[at:end] += sound[:end - at]


def make_track(name, root, mode, bpm, style, seconds=12.0):
    scale = MINOR if mode == 'minor' else MAJOR
    beat = 60.0 / bpm
    bars = max(1, int(seconds / (beat * 4)))
    total = bars * beat * 4
    buffer = np.zeros(int(total * SR))
    pattern = [0, 2, 4, 3, 1, 4, 2, 0, 3, 1, 4, 2]
    for bar in range(bars):
        base = bar * beat * 4
        chord_root = root if bar % 4 < 2 else root * 0.75
        for i in range(4):
            semis = 0 if i in (0, 3) else 3
            add(buffer, pad(freq(chord_root, semis), beat * 2.2, 0.025), base + i * beat)
        add(buffer, pad(freq(chord_root, scale[4]), beat * 3.8, 0.018), base)
        for step in range(8):
            idx = pattern[(bar * 8 + step) % len(pattern)]
            note = freq(root, scale[idx])
            delay = base + step * beat / 2
            if style in ('guzheng', 'koto'):
                add(buffer, pluck(note * (2 if style == 'koto' else 1), beat * 1.0, 0.12), delay)
            elif style == 'drums':
                if step % 2 == 0:
                    add(buffer, drum(beat * 0.5, True, 0.18), delay)
                if step % 4 == 2:
                    add(buffer, drum(beat * 0.2, False, 0.06), delay)
                add(buffer, pluck(note, beat * 0.5, 0.08), delay)
            else:
                add(buffer, pluck(note, beat * 1.2, 0.11), delay)
        add(buffer, pluck(freq(chord_root, 0) / 2, beat * 2.0, 0.10), base)
    # gentle stereo-free reverb using feedback delay
    delay = int(0.16 * SR)
    for _ in range(2):
        buffer[delay:] += buffer[:-delay] * 0.18
    # fades
    fade = int(0.4 * SR)
    buffer[:fade] *= np.linspace(0, 1, fade)
    buffer[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(buffer)) or 1
    buffer = np.clip(buffer / peak * 0.82, -1, 1)
    path = os.path.join(OUT, f'{name}.wav')
    with wave.open(path, 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes((buffer * 32767).astype('<i2').tobytes())
    print(name, round(total, 1), len(buffer) // SR, 's')


TRACKS = [
    ('start_1', 196.0, 'minor', 54, 'guzheng'),
    ('start_2', 174.6, 'minor', 50, 'strings'),
    ('scenario_1627', 174.6, 'minor', 58, 'guzheng'),
    ('scenario_1644', 196.0, 'minor', 72, 'drums'),
    ('scenario_1650', 164.8, 'minor', 62, 'strings'),
    ('ming_1', 196.0, 'minor', 56, 'guzheng'),
    ('ming_2', 220.0, 'major', 68, 'koto'),
    ('ming_3', 164.8, 'minor', 62, 'drums'),
    ('qing_1', 174.6, 'minor', 86, 'drums'),
    ('qing_2', 146.8, 'minor', 78, 'drums'),
    ('shun_1', 196.0, 'minor', 92, 'drums'),
    ('shun_2', 164.8, 'minor', 80, 'drums'),
    ('xi_1', 174.6, 'minor', 64, 'strings'),
    ('sming_1', 196.0, 'minor', 48, 'guzheng'),
    ('sming_2', 174.6, 'minor', 52, 'guzheng'),
    ('zheng_1', 220.0, 'major', 76, 'koto'),
    ('zheng_2', 196.0, 'minor', 74, 'koto'),
    ('mongol_1', 146.8, 'minor', 60, 'strings'),
    ('mongol_2', 164.8, 'minor', 62, 'strings'),
    ('joseon_1', 196.0, 'major', 64, 'koto'),
    ('joseon_2', 174.6, 'minor', 60, 'koto'),
    ('japan_1', 220.0, 'major', 70, 'koto'),
    ('japan_2', 164.8, 'minor', 66, 'koto'),
    ('tibet_1', 146.8, 'minor', 46, 'strings'),
    ('voc_1', 196.0, 'major', 88, 'koto'),
    ('russia_1', 146.8, 'minor', 58, 'drums'),
    ('neu_1', 164.8, 'minor', 58, 'strings'),
]

os.makedirs(OUT, exist_ok=True)
for track in TRACKS:
    make_track(*track)
