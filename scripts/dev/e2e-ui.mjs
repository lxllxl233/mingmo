/**
 * Phase 1.3 UI E2E：8 个可玩势力 × 开局 → 面板 → 训练 → 行军 → 事件 → 存读档 → 设置 → 主菜单。
 *
 * 前置：开发服务器运行在 JIASHEN_URL（默认 http://127.0.0.1:5173）。
 * 用法：node scripts/dev/e2e-ui.mjs
 * 环境：UI_WIDTH/UI_HEIGHT（默认 1280×800）、UI_BROWSER（Chrome 路径）。
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const chrome = process.env.UI_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.JIASHEN_URL ?? 'http://127.0.0.1:5173';
const width = Number(process.env.UI_WIDTH ?? 1280);
const height = Number(process.env.UI_HEIGHT ?? 800);
const shotDir = process.env.UI_SHOT_DIR ?? 'out/screenshots';
mkdirSync(shotDir, { recursive: true });

const FACTIONS = [
  { scenario: '崇祯元年', tag: 'MING', name: '大明', panel: '朝议', panelSelector: '.court-panel' },
  { scenario: '崇祯元年', tag: 'QING', name: '大清', panel: '八旗', panelSelector: '.banner-panel' },
  { scenario: '崇祯元年', tag: 'SHUN', name: '大顺', panel: '追赃', panelSelector: '.shun-panel' },
  { scenario: '崇祯元年', tag: 'ZHENG', name: '郑氏', panel: '海贸', panelSelector: '.trade-panel' },
  { scenario: '崇祯元年', tag: 'MONGOL', name: '察哈尔蒙古', panel: '盟旗', panelSelector: '.league-panel' },
  { scenario: '崇祯元年', tag: 'JOSEON', name: '朝鲜', panel: '事大', panelSelector: '.tribute-panel' },
  { scenario: '崇祯元年', tag: 'JAPAN', name: '日本', panel: '锁国', panelSelector: '.sakoku-panel' },
  { scenario: '永历播迁', tag: 'SMING', name: '南明', panel: '正统', panelSelector: '.legitimacy-panel' },
];

const GENERIC_PANELS = ['国策', '核心', '科研', '分配', '军事', '外交', '决议', '日志'];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const failures = [];

function fail(faction, label, detail) {
  failures.push(`${faction.tag}/${label}: ${detail}`);
}

async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

async function checkOverflow(page, faction, label) {
  const result = await overflow(page);
  if (result.scrollWidth > result.innerWidth + 1) {
    fail(faction, label, `horizontal overflow ${result.scrollWidth} > ${result.innerWidth}`);
  }
}

for (const faction of FACTIONS) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('dialog', dialog => dialog.accept());
  const shot = name => `${shotDir}/e2e-${faction.tag}-${name}.png`;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('.scenario-card').filter({ hasText: faction.scenario }).first().click();
    await page.getByRole('button', { name: /进入势力选择/ }).click();
    await page.locator('.faction-card').filter({ hasText: faction.name }).first().click();
    await page.getByRole('button', { name: /开始游戏/ }).click();
    await page.waitForTimeout(600);
    const skip = page.getByRole('button', { name: '跳过', exact: true });
    if (await skip.count() > 0) await skip.first().click();
    await page.waitForTimeout(800);

    if (await page.locator('.topbar').count() === 0) fail(faction, 'start', 'topbar missing');
    if (await page.locator('.map-host canvas').count() === 0) fail(faction, 'start', 'map canvas missing');
    const playerTag = await page.evaluate(() => window.__MINGMO_STORE__?.getState().game?.playerTag ?? null);
    if (playerTag !== faction.tag) fail(faction, 'start', `playerTag=${playerTag}`);
    await checkOverflow(page, faction, 'start');
    await page.screenshot({ path: shot('start') });

    for (const label of GENERIC_PANELS) {
      const button = page.locator('.sidebar button').filter({ hasText: label }).first();
      if (await button.count() === 0) {
        fail(faction, `panel:${label}`, 'button missing');
        continue;
      }
      await button.click();
      await page.waitForTimeout(250);
      if (label === '国策' || label === '科研') {
        if (await page.locator('.focus-overlay').count() === 0) fail(faction, `panel:${label}`, 'overlay not open');
        await page.locator('.focus-head button').filter({ hasText: '关闭' }).click();
      } else {
        const panel = page.locator('.right-panel .panel').first();
        if (await panel.count() === 0) fail(faction, `panel:${label}`, 'panel not open');
        else {
          const text = (await panel.innerText()).trim();
          if (text.length < 2) fail(faction, `panel:${label}`, 'panel empty');
        }
        await button.click();
      }
      await page.waitForTimeout(150);
      await checkOverflow(page, faction, `panel:${label}`);
    }

    const uniqueButton = page.locator('.sidebar button').filter({ hasText: faction.panel }).first();
    if (await uniqueButton.count() === 0) {
      fail(faction, `panel:${faction.panel}`, 'unique panel button missing');
    } else {
      await uniqueButton.click();
      await page.waitForTimeout(300);
      if (await page.locator(faction.panelSelector).count() === 0) {
        fail(faction, `panel:${faction.panel}`, `selector ${faction.panelSelector} missing`);
      }
      await page.screenshot({ path: shot('unique-panel') });
      await uniqueButton.click();
    }
    await checkOverflow(page, faction, 'panels');

    // 训练：UI 选模板 → 部署到本国省份。
    await page.locator('.sidebar button').filter({ hasText: '军事' }).first().click();
    await page.getByRole('button', { name: /训练陆军/ }).click();
    await page.waitForTimeout(200);
    if (await page.locator('.training-modal').count() === 0) {
      fail(faction, 'training', 'training modal missing');
    } else {
      await page.locator('.training-option:not([disabled])').first().click();
      await page.waitForTimeout(150);
      if (await page.locator('.deploy-banner').count() === 0) fail(faction, 'training', 'deploy banner missing');
    }
    const training = await page.evaluate(() => {
      const store = window.__MINGMO_STORE__;
      const state = store.getState();
      const game = state.game;
      const owned = Object.values(game.provinces).find(province => province.controller === game.playerTag);
      if (!owned) return { ok: false, reason: 'no owned province' };
      const ok = state.deployTraining(owned.id);
      return { ok, queued: store.getState().game.training.length, province: owned.id };
    });
    if (!training.ok) fail(faction, 'training', `deploy failed (${training.province})`);
    else if (training.queued < 1) fail(faction, 'training', 'training queue empty');
    // deployTraining 会短暂抑制军团选择（防止误选），等待窗口结束再测试行军。
    await page.waitForTimeout(900);
    await checkOverflow(page, faction, 'training');

    // 行军：选中现有军团，移动到本国相邻省份。
    const march = await page.evaluate(() => {
      const store = window.__MINGMO_STORE__;
      const state = store.getState();
      const game = state.game;
      const content = state.content;
      const armies = Object.values(game.armies).filter(army => army.tag === game.playerTag);
      const tryMove = (army, neighbors) => {
        store.getState().selectArmy(army.id);
        for (const next of neighbors) {
          if (store.getState().moveArmyTo(next)) {
            const moved = store.getState().game.armies[army.id];
            return { id: army.id, to: next, path: moved?.movePath ?? [] };
          }
        }
        store.getState().selectArmy(null);
        return null;
      };
      for (const army of armies) {
        const def = content.provinces.get(army.province);
        if (!def) continue;
        const moved = tryMove(army, def.neighbors);
        if (moved) return { ok: true, ...moved };
      }
      // 无处可去（如开局孤悬一港）：对邻省宣战后重试，验证宣战→行军闭环。
      for (const army of armies) {
        const def = content.provinces.get(army.province);
        if (!def) continue;
        const targetTag = def.neighbors.map(next => game.provinces[next]?.controller).find(tag => tag && tag !== game.playerTag);
        if (targetTag) {
          const declared = store.getState().command({ type: 'diplomacy.declareWar', target: targetTag, cb: '扩张' });
          if (declared) {
            const moved = tryMove(army, def.neighbors);
            if (moved) return { ok: true, ...moved, declared: targetTag };
          }
        }
      }
      return { ok: false, reason: 'no reachable neighbor' };
    });
    if (!march.ok) fail(faction, 'march', march.reason ?? 'failed');
    else if (!march.path || march.path.length === 0) fail(faction, 'march', 'movePath empty');
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot('march') });

    // 事件弹窗：先尝试自然触发；未触发则直接注入一条 pending 事件测试弹窗。
    await page.evaluate(() => window.__MINGMO_STORE__.getState().setSpeed(32));
    let eventSeen = false;
    try {
      await page.locator('.event-modal').first().waitFor({ state: 'visible', timeout: 8000 });
      eventSeen = true;
    } catch {
      eventSeen = false;
    }
    if (!eventSeen) {
      await page.evaluate(() => {
        const store = window.__MINGMO_STORE__;
        const state = store.getState();
        const game = state.game;
        const event = [...state.content.events.values()].find(entry => entry.options.length > 0);
        if (game && event) {
          game.pendingEvents.push({ eventId: event.id, country: game.playerTag, firedDay: game.day });
          store.setState({ version: store.getState().version + 1, speed: 0 });
        }
      });
      await page.waitForTimeout(300);
    }
    if (await page.locator('.event-modal').count() === 0) {
      fail(faction, 'event', 'event modal not shown');
    } else {
      const before = await page.evaluate(() => window.__MINGMO_STORE__.getState().game.pendingEvents.length);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (await page.locator('.event-modal').count() === 0) break;
        const option = page.locator('.event-modal button.option:not([disabled])').first();
        if (await option.count() === 0) {
          fail(faction, 'event', 'no enabled option');
          break;
        }
        await option.click();
        await page.waitForTimeout(250);
      }
      const after = await page.evaluate(() => window.__MINGMO_STORE__.getState().game.pendingEvents.length);
      if (after >= before) fail(faction, 'event', `pending not consumed ${before} -> ${after}`);
      await page.screenshot({ path: shot('event') });
    }

    // 存档 / 读档 / 设置 / 返回主菜单。
    await page.evaluate(() => window.__MINGMO_STORE__.getState().setSpeed(0));
    await page.getByRole('button', { name: /菜单（Esc）/ }).click();
    await page.waitForTimeout(200);
    if (await page.locator('.pause-overlay').count() === 0) fail(faction, 'menu', 'pause menu missing');
    await page.getByRole('button', { name: '快速存档', exact: true }).click();
    await page.waitForTimeout(250);
    const savedMessage = await page.evaluate(() => window.__MINGMO_STORE__.getState().message);
    if (!savedMessage || !savedMessage.includes('已保存')) fail(faction, 'save', `message=${savedMessage}`);
    await page.getByRole('button', { name: '快速读档', exact: true }).click();
    await page.waitForTimeout(400);
    const loadedMessage = await page.evaluate(() => window.__MINGMO_STORE__.getState().message);
    if (!loadedMessage || !loadedMessage.includes('已读取')) fail(faction, 'load', `message=${loadedMessage}`);

    // 读档会关闭暂停菜单（避免旧局浮层盖在新档上），重新打开后继续设置检查。
    await page.getByRole('button', { name: /菜单（Esc）/ }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.waitForTimeout(200);
    if (await page.locator('.settings-card').count() === 0) {
      fail(faction, 'settings', 'settings modal missing');
    } else {
      const checkbox = page.locator('.settings-card input[type="checkbox"]').first();
      const before = await checkbox.isChecked();
      await checkbox.click();
      const after = await checkbox.isChecked();
      if (before === after) fail(faction, 'settings', 'checkbox did not toggle');
      await page.locator('.settings-card button').filter({ hasText: '关闭' }).click();
      await page.waitForTimeout(150);
    }
    await checkOverflow(page, faction, 'settings');

    await page.getByRole('button', { name: /返回主菜单/ }).click();
    await page.waitForTimeout(500);
    if (await page.locator('.start').count() === 0) fail(faction, 'main-menu', 'start screen not shown');
  } catch (error) {
    fail(faction, 'exception', error instanceof Error ? error.message : String(error));
    try {
      await page.screenshot({ path: shot('failure') });
    } catch {
      // 截图失败不掩盖原始错误。
    }
  }

  if (errors.length > 0) fail(faction, 'console', errors.join(' | '));
  console.log(`${faction.tag}: ${errors.length === 0 ? 'ok' : `${errors.length} console errors`}`);
  await context.close();
}

await browser.close();
if (failures.length > 0) {
  console.error(`E2E FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`E2E ok: ${FACTIONS.length} factions @ ${width}x${height}`);
