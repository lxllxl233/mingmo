import { chromium } from 'playwright-core';

const chrome = process.env.UI_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
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
await page.getByRole('button', { name: '开始游戏' }).click();
await page.waitForTimeout(500);
const skip = page.getByRole('button', { name: '跳过' });
if (await skip.count() > 0) await skip.first().click();
await page.waitForTimeout(300);

const activeSpeed = async () => (await page.locator('.bottombar .speed button.active').first().innerText()).trim();
console.log('start speed:', await activeSpeed());
await page.keyboard.press('Space');
await page.waitForTimeout(200);
console.log('after space:', await activeSpeed());
await page.keyboard.press('Space');
await page.waitForTimeout(200);
console.log('after space2:', await activeSpeed());

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('pause:', await page.locator('.pause-overlay').count());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('pause closed:', await page.locator('.pause-overlay').count());

await page.keyboard.press('F1');
await page.waitForTimeout(300);
console.log('help:', await page.locator('.help-overlay').count());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('help closed:', await page.locator('.help-overlay').count());

await page.getByRole('button', { name: '菜单', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '设置', exact: true }).click();
await page.waitForTimeout(300);
console.log('settings:', await page.locator('.settings-overlay').count());
await page.getByRole('button', { name: '关闭', exact: true }).last().click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: '继续（Esc）', exact: true }).click();
await page.waitForTimeout(300);
console.log('menu closed:', await page.locator('.pause-overlay').count());

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
if (errors.length > 0) process.exitCode = 1;
