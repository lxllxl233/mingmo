import { mkdirSync } from 'node:fs';
import { constants, setPriority } from 'node:os';
import { chromium } from 'playwright-core';

// Windows 会对长时间后台运行启用省电节流；soak 需要按真实速度推进。
try {
  setPriority(process.pid, constants.priority.PRIORITY_HIGH);
} catch {
  // 无权限时保持默认优先级。
}

const chrome = process.env.UI_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const minutes = Number(process.env.SOAK_MINUTES ?? 10);
const speed = process.env.SOAK_SPEED ?? '32x';
const shotDir = process.env.UI_SHOT_DIR ?? 'out/screenshots';
const shot = name => `${shotDir}/${name}`;
mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '进入势力选择' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '看海模式' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: speed, exact: true }).click();

const started = Date.now();
const samples = [];
while (Date.now() - started < minutes * 60_000) {
  await page.waitForTimeout(30_000);
  const sample = await page.evaluate(() => {
    const memory = performance.memory;
    // 看海模式使用 SpectatorShell，日期不在 .topbar 内；生产构建也没有 store 钩子。
    // 从顶栏可见文本中取含年份的那一段，同时保留整段用于人工核对。
    const top = document.querySelector('.spectator-top');
    const texts = top ? [...top.querySelectorAll('span')].map(node => node.textContent ?? '') : [];
    const date = texts.find(text => /\d{4}/.test(text)) ?? '';
    return {
      date,
      label: top ? (top.textContent ?? '').trim().slice(0, 80) : '',
      heap: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
      event: document.querySelector('.event-modal h2')?.textContent ?? null,
    };
  });
  samples.push({ at: Math.round((Date.now() - started) / 1000), ...sample });
  console.log(JSON.stringify(samples[samples.length - 1]));
}

await page.screenshot({ path: shot('ui-soak.png') });
console.log(`soakMinutes=${minutes} samples=${samples.length} errors=${errors.length}`);
if (errors.length > 0) console.log(errors.slice(0, 10).join('\n'));
await browser.close();
if (errors.length > 0) process.exitCode = 1;
