import { chromium, firefox } from 'playwright-core';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserKind = process.env.UI_BROWSER_KIND ?? 'chromium';
const browserPath = process.env.UI_BROWSER ?? (browserKind === 'firefox' ? undefined : chrome);
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const width = Number(process.env.UI_WIDTH ?? 1440);
const height = Number(process.env.UI_HEIGHT ?? 900);
const suffix = `${browserKind}-${width}x${height}`;

const engine = browserKind === 'firefox' ? firefox : chromium;
const browser = await engine.launch(browserPath ? { executablePath: browserPath, headless: true } : { headless: true });
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

const scenario = process.env.UI_SCENARIO;
if (scenario) {
  await page.locator('.scenario-card').filter({ hasText: scenario }).first().click();
  await page.waitForTimeout(250);
}
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

const legitimacyButton = page.getByRole('button', { name: '正统', exact: true });
if (await legitimacyButton.count() > 0) {
  await legitimacyButton.click();
  await page.waitForTimeout(400);
  console.log('legitimacy:', (await page.locator('.legitimacy-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-legitimacy-${suffix}.png` });
  await legitimacyButton.click();
}

const tradeButton = page.getByRole('button', { name: '海贸', exact: true });
if (await tradeButton.count() > 0) {
  await tradeButton.click();
  await page.waitForTimeout(400);
  console.log('trade:', (await page.locator('.trade-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-trade-${suffix}.png` });
  await tradeButton.click();
}

const leagueButton = page.getByRole('button', { name: '盟旗', exact: true });
if (await leagueButton.count() > 0) {
  await leagueButton.click();
  await page.waitForTimeout(400);
  console.log('league:', (await page.locator('.league-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-league-${suffix}.png` });
  await leagueButton.click();
}

const sakokuButton = page.getByRole('button', { name: '锁国', exact: true });
if (await sakokuButton.count() > 0) {
  await sakokuButton.click();
  await page.waitForTimeout(400);
  console.log('sakoku:', (await page.locator('.sakoku-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-sakoku-${suffix}.png` });
  await sakokuButton.click();
}

const tributeButton = page.getByRole('button', { name: '事大', exact: true });
if (await tributeButton.count() > 0) {
  await tributeButton.click();
  await page.waitForTimeout(400);
  console.log('tribute:', (await page.locator('.tribute-panel').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await page.screenshot({ path: `ui-tribute-${suffix}.png` });
  await tributeButton.click();
}
await page.getByRole('button', { name: '2x', exact: true }).click();
await page.waitForTimeout(1800);
console.log('after-tick:', (await page.locator('.bottombar').innerText()).replace(/\s+/g, ' ').slice(0, 240));
await page.screenshot({ path: `ui-tick-${suffix}.png` });

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
if (errors.length > 0) process.exitCode = 1;
