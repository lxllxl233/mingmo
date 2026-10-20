/**
 * Phase 0 "玩家视角"文本转储：把每个屏幕玩家真正读到的文字抓下来（配合截图），
 * 供 AI 以文本方式"亲自阅读"界面，发现 headless 测试看不出的困惑点。
 *
 * 用法：node scripts/dev/play-dump.mjs MING [SMING|ZHENG|JAPAN]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const chrome = process.env.UI_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const width = Number(process.env.UI_WIDTH ?? 1440);
const height = Number(process.env.UI_HEIGHT ?? 900);
const shotDir = process.env.UI_SHOT_DIR ?? 'out/screenshots';
mkdirSync(shotDir, { recursive: true });

const tag = process.argv[2] ?? 'MING';
const SCENARIO = { MING: ['崇祯元年', '大明'], SMING: ['永历播迁', '南明'], ZHENG: ['崇祯元年', '郑氏'], JAPAN: ['崇祯元年', '日本'], QING: ['崇祯元年', '大清'] };
const [scenarioName, factionName] = SCENARIO[tag] ?? ['崇祯元年', '大明'];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ viewport: { width, height } });
const page = await context.newPage();
const out = [];
const section = (title) => out.push(`\n========== ${title} ==========`);
const dump = (label, selector) => {
  return page.evaluate(([sel]) => {
    const el = document.querySelector(sel);
    return el ? el.innerText.trim() : '(missing)';
  }, [selector]).then(text => {
    section(label);
    out.push(text);
  });
};
const shot = (name) => page.screenshot({ path: `${shotDir}/play-${tag}-${name}.png` });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // 1) 剧本选择屏
  section('剧本选择屏');
  out.push(await page.evaluate(() => document.querySelector('.start')?.innerText?.trim() ?? '(no .start)'));

  await page.locator('.scenario-card').filter({ hasText: scenarioName }).first().click();
  await page.getByRole('button', { name: /进入势力选择/ }).click();
  await page.waitForTimeout(400);

  // 2) 势力选择屏
  section('势力选择屏（含难度说明）');
  out.push(await page.evaluate(() => document.querySelector('.start')?.innerText?.trim() ?? '(no .start)'));

  // 列出可选势力卡数量与名称
  const factionNames = await page.evaluate(() =>
    [...document.querySelectorAll('.faction-card h3')].map(h => h.textContent));
  section('可选势力列表');
  out.push(`count=${factionNames.length}: ${factionNames.join(' / ')}`);

  await page.locator('.faction-card').filter({ hasText: factionName }).first().click();
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: '跳过', exact: true });
  if (await skip.count() > 0) await skip.first().click();
  await page.waitForTimeout(900);

  // 3) 顶栏
  await dump('顶栏（玩家第一眼看到的数字）', '.topbar');
  await shot('start');

  // 4) 每个侧栏面板的正文
  const panels = ['国策', '核心', '科研', '分配', '军事', '外交', '决议', '日志'];
  for (const label of panels) {
    const btn = page.locator('.sidebar button').filter({ hasText: label }).first();
    if (await btn.count() === 0) { section(`面板:${label}`); out.push('(无此按钮)'); continue; }
    await btn.click();
    await page.waitForTimeout(300);
    if (label === '国策' || label === '科研') {
      await dump(`面板:${label}（悬浮层）`, '.focus-overlay');
      await page.locator('.focus-head button').filter({ hasText: '关闭' }).click();
    } else {
      await dump(`面板:${label}`, '.right-panel .panel');
      await btn.click();
    }
    await page.waitForTimeout(120);
  }

  // 5) 独特机制面板
  const UNIQUE = { MING: '朝议', QING: '八旗', SHUN: '追赃', SMING: '正统', ZHENG: '海贸', MONGOL: '盟旗', JOSEON: '事大', JAPAN: '锁国' };
  const uniqueName = UNIQUE[tag];
  if (uniqueName) {
    const btn = page.locator('.sidebar button').filter({ hasText: uniqueName }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
      await dump(`独特面板:${uniqueName}`, '.right-panel .panel');
      await shot('unique-panel');
    }
  }

  // 6) 跑 60 天观察开局事件与状态变化
  await page.evaluate(() => window.__MINGMO_STORE__.getState().setSpeed(32));
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__MINGMO_STORE__.getState().setSpeed(0));
  await dump('60 天后的顶栏', '.topbar');
  await dump('事件弹窗（若有）', '.event-modal');
  await shot('after-60d');

  const file = `out/play-dump-${tag}.txt`;
  writeFileSync(file, out.join('\n'), 'utf8');
  console.log(out.join('\n'));
  console.log(`\n[written] ${file}`);
} catch (error) {
  console.error('PLAY-DUMP FAIL', error);
  try { await shot('failure'); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
