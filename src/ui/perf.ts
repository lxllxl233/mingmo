import type { ProfilerOnRenderCallback } from 'react';

export interface ReactPerfEntry {
  id: string;
  phase: string;
  duration: number;
  at: number;
}

/** DEV 性能探针：记录每个 Profiler 子树每次 React 渲染耗时（毫秒）。 */
export const onReactRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  if (!import.meta.env.DEV) return;
  const target = globalThis as { __MINGMO_REACT_PERF__?: ReactPerfEntry[] };
  const list = target.__MINGMO_REACT_PERF__ ?? [];
  target.__MINGMO_REACT_PERF__ = list;
  list.push({
    id,
    phase,
    duration: Math.round(actualDuration * 100) / 100,
    at: Math.round(performance.now()),
  });
  if (list.length > 600) list.splice(0, list.length - 600);
};
