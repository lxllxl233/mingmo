import { chromium } from 'playwright-core';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
console.log('title:', await page.title());
console.log('start-screen:', await page.locator('.start').count());
await page.screenshot({ path: 'ui-start.png' });

await page.getByRole('button', { name: '开始游戏' }).click();
await page.waitForTimeout(1500);
console.log('topbar:', (await page.locator('.topbar').innerText()).replace(/\s+/g, ' ').slice(0, 240));
console.log('canvas:', await page.locator('.map-host canvas').count());
await page.screenshot({ path: 'ui-game.png' });

const box = await page.locator('.map-host').boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.57, box.y + box.height * 0.43);
  await page.waitForTimeout(500);
  console.log('panel:', (await page.locator('.right-panel').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await page.screenshot({ path: 'ui-panel.png' });
}

await page.getByRole('button', { name: '国策' }).click();
await page.waitForTimeout(400);
console.log('focus-nodes:', await page.locator('.focus-node').count());
await page.screenshot({ path: 'ui-focus.png' });
await page.getByRole('button', { name: '关闭' }).click();

await page.getByRole('button', { name: '2x' }).click();
await page.waitForTimeout(1800);
console.log('after-tick:', (await page.locator('.bottombar').innerText()).replace(/\s+/g, ' ').slice(0, 240));
await page.screenshot({ path: 'ui-tick.png' });

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
if (errors.length > 0) process.exitCode = 1;
