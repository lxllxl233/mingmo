/**
 * Phase 2.2 地图渲染探针：单省易主重绘耗时、标签纹理内存、1080p 帧率。
 *
 * 前置：开发服务器运行在 JIASHEN_URL（默认 http://127.0.0.1:5173）。
 * 用法：node scripts/dev/map-perf.mjs
 */
import { chromium } from 'playwright-core';

const chrome = process.env.UI_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const width = Number(process.env.UI_WIDTH ?? 1920);
const height = Number(process.env.UI_HEIGHT ?? 1080);

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('.scenario-card').filter({ hasText: '崇祯元年' }).first().click();
await page.getByRole('button', { name: /进入势力选择/ }).click();
await page.locator('.faction-card').filter({ hasText: '大明' }).first().click();
await page.getByRole('button', { name: /开始游戏/ }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: '跳过', exact: true });
if (await skip.count() > 0) await skip.first().click();
await page.waitForTimeout(1200);
const eventDebug = await page.evaluate(() => {
  const state = window.__MINGMO_STORE__.getState();
  const game = state.game;
  return {
    pending: game?.pendingEvents.map(event => ({ id: event.eventId, country: event.country, player: game.playerTag })),
    modal: document.querySelectorAll('.event-modal').length,
    onboarding: document.querySelectorAll('.onboarding').length,
  };
});
// 开局事件会强制暂停；先清空待决事件，才能稳定测 tick 提交耗时。
for (let attempt = 0; attempt < 6; attempt += 1) {
  if (await page.locator('.event-modal').count() === 0) break;
  const option = page.locator('.event-modal button.option:not([disabled])').first();
  if (await option.count() === 0) break;
  await option.click();
  await page.waitForTimeout(150);
}
await page.evaluate(() => window.__MINGMO_STORE__.getState().setSpeed(0));

const initial = await page.evaluate(() => window.__MINGMO_MAP_PERF__ ?? null);

const captures = await page.evaluate(async () => {
  const store = window.__MINGMO_STORE__;
  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    const game = store.getState().game;
    const province = Object.values(game.provinces)
      .find(entry => entry.controller !== game.playerTag && entry.owner === entry.controller);
    if (!province) return { error: 'no candidate province', samples };
    const previous = province.controller;
    province.controller = game.playerTag;
    game.mapRevision += 1;
    store.setState({ version: store.getState().version + 1 });
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    samples.push(window.__MINGMO_MAP_PERF__?.lastRedrawMs ?? null);
    province.controller = previous;
    game.mapRevision += 1;
    store.setState({ version: store.getState().version + 1 });
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
  return { samples, perf: window.__MINGMO_MAP_PERF__ };
});

// 放大到本地地名层级，把 480 个县级标签计入纹理统计。
const host = page.locator('.map-host');
await host.hover({ position: { x: Math.floor(width * 0.45), y: Math.floor(height * 0.5) } });
for (let i = 0; i < 18; i += 1) {
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(60);
}
await page.waitForTimeout(500);
const zoomed = await page.evaluate(() => window.__MINGMO_MAP_PERF__ ?? null);
await page.screenshot({ path: 'out/screenshots/map-perf-zoomed.png' });

// 恢复默认缩放后跑 3 秒 32 倍速，采样 rAF 帧间隔。
for (let i = 0; i < 24; i += 1) {
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(30);
}
await page.evaluate(() => {
  const store = window.__MINGMO_STORE__;
  const game = store.getState().game;
  if (game) game.pendingEvents.length = 0;
  store.setState({ version: store.getState().version + 1 });
  store.getState().setSpeed(32);
});
await page.waitForTimeout(400);
const reactStart = await page.evaluate(() => Math.round(performance.now()));
const beforeRun = await page.evaluate(() => ({
  day: window.__MINGMO_STORE__.getState().game?.day,
  speed: window.__MINGMO_STORE__.getState().speed,
  spectator: window.__MINGMO_STORE__.getState().game?.spectator,
  pending: window.__MINGMO_STORE__.getState().game?.pendingEvents.map(event => event.eventId),
  ended: window.__MINGMO_STORE__.getState().game?.ended,
}));
const frames = await page.evaluate(() => new Promise(resolve => {
  const store = window.__MINGMO_STORE__;
  const deltas = [];
  const start = performance.now();
  let last = start;
  let lastTick = start;
  const tickOnce = () => {
    const state = store.getState();
    const game = state.game;
    if (!game) return;
    // 开局事件会强制暂停；探针只关心 React 提交成本，直接清空队列。
    game.pendingEvents.length = 0;
    if (state.speed !== 32) state.setSpeed(32);
    state.tick();
  };
  tickOnce();
  const frame = now => {
    deltas.push(now - last);
    last = now;
    if (now - lastTick >= 94) {
      lastTick = now;
      tickOnce();
    }
    if (now - start < 3000) requestAnimationFrame(frame);
    else {
      store.getState().setSpeed(0);
      resolve(deltas.slice(1));
    }
  };
  requestAnimationFrame(frame);
}));
const reactEntries = await page.evaluate(() => window.__MINGMO_REACT_PERF__ ?? []);
const tickDebug = await page.evaluate(() => {
  const game = window.__MINGMO_STORE__.getState().game;
  const entries = window.__MINGMO_REACT_PERF__ ?? [];
  return {
    day: game?.day ?? null,
    speed: window.__MINGMO_STORE__.getState().speed,
    entries: entries.length,
    phases: [...new Set(entries.map(entry => entry.phase))],
    firstAt: entries[0]?.at ?? null,
    lastAt: entries[entries.length - 1]?.at ?? null,
  };
});
await page.evaluate(() => window.__MINGMO_STORE__.getState().setSpeed(0));
await page.screenshot({ path: 'out/screenshots/map-perf-1080p.png' });

await browser.close();

const sorted = [...frames].sort((a, b) => a - b);
const quantile = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
const report = {
  viewport: `${width}x${height}`,
  initial,
  capture: {
    samples: captures.samples,
    medianMs: median(captures.samples),
    maxMs: Math.max(...captures.samples.filter(value => typeof value === 'number')),
    error: captures.error ?? null,
  },
  zoomed,
  fps: {
    frames: frames.length,
    avg: Math.round(1000 / (frames.reduce((sum, value) => sum + value, 0) / Math.max(1, frames.length))),
    p50FrameMs: round(quantile(0.5)),
    p95FrameMs: round(quantile(0.95)),
    worstFrameMs: round(sorted[sorted.length - 1] ?? 0),
  },
  react: reactStats(reactEntries.filter(entry => entry.phase !== 'mount' && entry.at >= reactStart)),
  beforeRun,
  afterRun: tickDebug,
  eventDebug,
  errors,
};
console.log(JSON.stringify(report, null, 2));

function reactStats(entries) {
  const groups = new Map();
  for (const entry of entries) {
    let list = groups.get(entry.id);
    if (!list) {
      list = [];
      groups.set(entry.id, list);
    }
    list.push(entry.duration);
  }
  const result = {};
  for (const [id, values] of groups) {
    const durations = values.sort((a, b) => a - b);
    result[id] = {
      updates: durations.length,
      medianMs: round(durations[Math.floor(durations.length / 2)]),
      p95Ms: round(durations[Math.floor(durations.length * 0.95)]),
      maxMs: round(durations[durations.length - 1]),
    };
  }
  return result;
}
function median(values) {
  const numbers = values.filter(value => typeof value === 'number').sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  return round(numbers[Math.floor(numbers.length / 2)]);
}
function round(value) {
  return Math.round(value * 100) / 100;
}
if (errors.length > 0) process.exit(1);
