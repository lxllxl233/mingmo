import { chromium } from 'playwright-core';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const width = Number(process.env.UI_WIDTH ?? 1440);
const height = Number(process.env.UI_HEIGHT ?? 900);
const suffix = `${width}x${height}`;

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
console.log('title:', await page.title());
console.log('start-screen:', await page.locator('.start').count());
await page.screenshot({ path: `ui-start-${suffix}.png` });

await page.getByRole('button', { name: '进入势力选择' }).click();
await page.waitForTimeout(300);
const faction = process.env.UI_FACTION;
if (faction) {
  await page.locator('.faction-card').filter({ hasText: faction }).first().click();
  await page.waitForTimeout(200);
}
await page.getByRole('button', { name: '开始游戏' }).click();
await page.waitForTimeout(500);
const skip = page.getByRole('button', { name: '跳过' });
if (await skip.count() > 0) await skip.first().click();
await page.waitForTimeout(1000);
console.log('topbar:', (await page.locator('.topbar').innerText()).replace(/\s+/g, ' ').slice(0, 240));
console.log('canvas:', await page.locator('.map-host canvas').count());
await page.screenshot({ path: `ui-game-${suffix}.png` });

const box = await page.locator('.map-host').boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.57, box.y + box.height * 0.43);
  await page.waitForTimeout(500);
  console.log('panel:', (await page.locator('.right-panel').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await page.screenshot({ path: `ui-panel-${suffix}.png` });
}

await page.getByRole('button', { name: '国策', exact: true }).click();
await page.waitForTimeout(400);
console.log('focus-nodes:', await page.locator('.focus-tree-node').count());
await page.screenshot({ path: `ui-focus-${suffix}.png` });
await page.getByRole('button', { name: '关闭', exact: true }).first().click();

const courtButton = page.getByRole('button', { name: '朝议', exact: true });
if (await courtButton.count() > 0) {
  await courtButton.click();
  await page.waitForTimeout(400);
  console.log('court:', (await page.locator('.court-panel').innerText()).replace(/\s+/g, ' ').slice(0, 200));
  await page.screenshot({ path: `ui-court-${suffix}.png` });
  await courtButton.click();
}

const bannerButton = page.getByRole('button', { name: '八旗', exact: true });
if (await bannerButton.count() > 0) {
  await bannerButton.click();
  await page.waitForTimeout(400);
  console.log('banner:', (await page.locator('.banner-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-banner-${suffix}.png` });
  await bannerButton.click();
}

const shunButton = page.getByRole('button', { name: '追赃', exact: true });
if (await shunButton.count() > 0) {
  await shunButton.click();
  await page.waitForTimeout(400);
  console.log('shun:', (await page.locator('.shun-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-shun-${suffix}.png` });
  await shunButton.click();
}
await page.getByRole('button', { name: '2x', exact: true }).click();
await page.waitForTimeout(1800);
console.log('after-tick:', (await page.locator('.bottombar').innerText()).replace(/\s+/g, ' ').slice(0, 240));
await page.screenshot({ path: `ui-tick-${suffix}.png` });

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
if (errors.length > 0) process.exitCode = 1;
