// Drives a running Kidzink AI dev app (ENABLE_PLAYWRIGHT=true) through key setup and error cases.
const path = require('path');
const { chromium } = require(require.resolve('@playwright/test', {
  paths: [path.join(__dirname, '../../ui/desktop')],
}));

const OUT = process.env.OUT_DIR || process.cwd();
const port = process.env.PLAYWRIGHT_DEBUG_PORT || '9222';
const step = (name) => console.log(`--- ${name}`);

async function connect() {
  for (let i = 0; i < 300; i++) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('could not connect');
}

async function mainPage(browser) {
  for (let i = 0; i < 200; i++) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    const page = pages.find((p) => !p.url().includes('launcher')) ?? pages[0];
    if (page) return page;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('no page');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`screenshot ${name}.png`);
}

async function enterKey(page, key) {
  const input = page.locator('#kidzink-api-key');
  await input.fill(key);
  await page.locator('form button[type="submit"]').click();
}

async function sendChat(page, text) {
  const box = page.locator('textarea').first();
  await box.waitFor({ timeout: 30000 });
  await box.fill(text);
  await box.press('Enter');
}

(async () => {
  const browser = await connect();
  const page = await mainPage(browser);
  await page.waitForLoadState('domcontentloaded');
  const scenario = process.argv[2] || 'setup';

  if (scenario === 'setup') {
    step('welcome screen');
    await page.getByText(/^Welcome to Kidzink AI/).waitFor({ timeout: 60000 });
    await shot(page, '01-welcome');

    step('invalid key');
    await enterKey(page, 'sk-or-v1-wrong');
    await page.getByRole('alert').waitFor({ timeout: 20000 });
    console.log('alert:', await page.getByRole('alert').innerText());
    await shot(page, '02-invalid-key');

    step('valid key with exhausted credits');
    await enterKey(page, 'sk-or-v1-broke');
    await page.locator('textarea').first().waitFor({ timeout: 60000 });
    await shot(page, '03-home');

    step('chat hits usage limit');
    await sendChat(page, 'Hello there');
    await page.getByText('AI usage limit reached').waitFor({ timeout: 60000 });
    await shot(page, '04-usage-limit');
  }

  if (scenario === 'settings') {
    step('settings app tab');
    await page.evaluate(() => (window.location.hash = '#/settings'));
    await page.getByRole('tab', { name: 'App' }).click();
    await page.getByText('Change API key').first().scrollIntoViewIfNeeded();
    await shot(page, '05-settings');

    step('change key');
    await page.getByRole('button', { name: 'Change API key' }).click();
    await enterKey(page, process.argv[3] || 'sk-or-v1-good');
    await page.getByText('API key updated').waitFor({ timeout: 30000 });
    await shot(page, '06-key-updated');
    await page.getByText('About Kidzink AI').scrollIntoViewIfNeeded();
    await shot(page, '06b-about');
  }

  if (scenario === 'models') {
    step('model tier label and picker');
    await page.evaluate(() => (window.location.hash = '#/'));
    const trigger = page.getByText(/^(Low|Medium|High)$/).first();
    await trigger.waitFor({ timeout: 30000 });
    await shot(page, '08-tier-label');
    await trigger.click();
    await page.getByText('Change Model').click();
    await page.getByText('Most capable. Complex documents and analysis.').waitFor({ timeout: 30000 });
    await shot(page, '09-tier-picker');
    const dialog = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ');
    console.log('dialog:', dialog);
    console.log('model slug visible:', /anthropic\/|claude|openrouter/i.test(dialog));
  }

  if (scenario === 'staff') {
    step('key setup if needed');
    if (await page.getByText(/^Welcome to Kidzink AI/).isVisible({ timeout: 15000 }).catch(() => false)) {
      await enterKey(page, 'sk-or-v1-good');
    }

    step('home recipe cards');
    await page.getByText('Or start with a task').waitFor({ timeout: 60000 });
    await shot(page, '10-home-cards');
    const cards = await page.locator('button[title]').allInnerTexts();
    console.log('cards:', cards.map((c) => c.split('\n')[0]).join(' | '));
    for (const label of ['Recipes', 'Skills', 'Apps', 'Scheduler', 'Extensions', 'Session History']) {
      console.log(`sidebar shows ${label}:`, (await page.getByText(label, { exact: true }).count()) > 0);
    }

    step('settings tabs');
    await page.evaluate(() => (window.location.hash = '#/settings'));
    await page.getByRole('tab').first().waitFor({ timeout: 30000 });
    console.log('tabs:', (await page.getByRole('tab').allInnerTexts()).join(' | '));
    console.log('mode section visible:', await page.getByText('Default Mode').isVisible());
    await shot(page, '11-settings-tabs');

    step('hidden page redirects home');
    await page.evaluate(() => (window.location.hash = '#/extensions'));
    await page.waitForTimeout(1500);
    console.log('after #/extensions:', await page.evaluate(() => window.location.hash));

    step('start a recipe');
    await page.evaluate(() => (window.location.hash = '#/'));
    await page.getByText('Make a spreadsheet', { exact: true }).click();
    await page.getByText(/Tell me what the spreadsheet is for/).waitFor({ timeout: 60000 });
    await shot(page, '12-recipe-chat');
    await page.getByText(/^A project tracker/).first().click();
    await page.getByText('OpenRouter.').last().waitFor({ timeout: 60000 });
    await shot(page, '13-recipe-reply');
  }

  if (scenario === 'chat') {
    step('new chat');
    await page.evaluate(() => (window.location.hash = '#/'));
    await sendChat(page, process.argv[3] || 'Hello there');
    await page.waitForTimeout(8000);
    await shot(page, `07-chat-${process.argv[4] || 'result'}`);
    console.log((await page.locator('body').innerText()).slice(-1500));
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
