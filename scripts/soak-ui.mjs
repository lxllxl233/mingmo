import { chromium } from 'playwright-core';

const chrome = process.env.UI_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const minutes = Number(process.env.SOAK_MINUTES ?? 10);
const speed = process.env.SOAK_SPEED ?? '32x';
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
    return {
      date: document.querySelector('.topbar .date')?.textContent ?? '',
      heap: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
      event: document.querySelector('.event-modal h2')?.textContent ?? null,
    };
  });
  samples.push({ at: Math.round((Date.now() - started) / 1000), ...sample });
  console.log(JSON.stringify(samples[samples.length - 1]));
}

await page.screenshot({ path: 'ui-soak.png' });
console.log(`soakMinutes=${minutes} samples=${samples.length} errors=${errors.length}`);
if (errors.length > 0) console.log(errors.slice(0, 10).join('\n'));
await browser.close();
if (errors.length > 0) process.exitCode = 1;
