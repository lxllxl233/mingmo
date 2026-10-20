import { chromium } from 'playwright-core';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.locator('.scenario-card').filter({ hasText: '崇祯元年' }).first().click();
await page.getByRole('button', { name: /进入势力选择/ }).click();
await page.waitForTimeout(400);
for (const name of ['大西', '和硕特·西藏', '荷兰东印度', '沙俄', '大明', '郑氏']) {
  const text = await page.locator('.faction-card').filter({ hasText: name }).first().locator('.faction-leader').innerText();
  console.log(`${name}: ${text.trim()}`);
}
await browser.close();
