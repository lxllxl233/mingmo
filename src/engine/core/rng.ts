/**
 * 确定性随机数。
 *
 * 约定：
 * - 模拟内核禁止 Math.random()；所有随机性来自 seed + day + system 派生。
 * - 不把 RNG 内部状态放进 GameState：每个系统每天用 `rngFor(seed, day, system)`
 *   重新派生，避免存档需要序列化随机流。
 */

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [minInclusive, maxExclusive) 的整数 */
  int(minInclusive: number, maxExclusive: number): number;
  /** 从非空数组取一个元素 */
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  /** 返回新数组，不修改输入 */
  shuffle<T>(items: readonly T[]): T[];
  /** 派生独立子流，用于同一 tick 内不同子系统 */
  fork(label: string): Rng;
}

/** FNV-1a 32-bit，用于把字符串混进种子。 */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 把多个整数/字符串混成一个 32-bit 种子。 */
export function hashSeed(...parts: Array<number | string>): number {
  let hash = 0x9e3779b9;
  for (const part of parts) {
    const value = typeof part === 'number' ? part >>> 0 : hashString(part);
    hash ^= value + 0x9e3779b9 + (hash << 6) + (hash >>> 2);
    hash >>>= 0;
  }
  return hash >>> 0;
}

/** mulberry32：小、快、可复现，足够支撑游戏模拟。 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int(minInclusive, maxExclusive) {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
        throw new Error('rng.int requires integer bounds');
      }
      if (maxExclusive <= minInclusive) {
        throw new Error(`rng.int empty range: [${minInclusive}, ${maxExclusive})`);
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick on empty array');
      const item = items[rng.int(0, items.length)];
      if (item === undefined) throw new Error('rng.pick out of bounds');
      return item;
    },
    chance(probability) {
      if (probability <= 0) return false;
      if (probability >= 1) return true;
      return next() < probability;
    },
    shuffle(items) {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = rng.int(0, i + 1);
        const a = result[i];
        const b = result[j];
        if (a === undefined || b === undefined) throw new Error('rng.shuffle out of bounds');
        result[i] = b;
        result[j] = a;
      }
      return result;
    },
    fork(label) {
      return mulberry32(hashSeed(seed, label));
    },
  };

  return rng;
}

/** 每个系统每日独立流：同 seed + day + system 必得同序列。 */
export function rngFor(worldSeed: number, day: number, system: string): Rng {
  return mulberry32(hashSeed(worldSeed, day, system));
}
