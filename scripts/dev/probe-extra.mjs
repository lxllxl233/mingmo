import { chromium } from 'playwright-core';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const FACTIONS = [
  { scenario: '崇祯元年', tag: 'XI', name: '大西' },
  { scenario: '崇祯元年', tag: 'TIBET', name: '和硕特·西藏' },
  { scenario: '崇祯元年', tag: 'VOC', name: '荷兰东印度' },
  { scenario: '崇祯元年', tag: 'RUSSIA', name: '沙俄' },
];
for (const f of FACTIONS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.scenario-card').filter({ hasText: f.scenario }).first().click();
  await page.getByRole('button', { name: /进入势力选择/ }).click();
  await page.locator('.faction-card').filter({ hasText: f.name }).first().click();
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.waitForTimeout(800);
  const skip = page.getByRole('button', { name: '跳过', exact: true });
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(600);
  const topbar = await page.locator('.topbar').count();
  const sidebarButtons = await page.evaluate(() => [...document.querySelectorAll('.sidebar button')].map(b => b.textContent?.trim()));
  const playerTag = await page.evaluate(() => window.__MINGMO_STORE__?.getState().game?.playerTag);
  console.log(`${f.tag}: topbar=${topbar} player=${playerTag} errors=${errors.length}${errors.length ? ' ['+errors[0]+']' : ''}`);
  console.log(`  sidebar: ${sidebarButtons.join(' / ')}`);
  await ctx.close();
}
await browser.close();
