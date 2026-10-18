import type { GameState } from './types';

/** 稳定哈希：测试与回放用。对象键顺序由构造顺序决定，模拟中不依赖随机遍历。 */
export function hashState(state: GameState): string {
  const text = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
