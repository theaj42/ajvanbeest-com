// S14 accessibility: axe (zero serious/critical) and Lighthouse accessibility >= 95, on home,
// a lane index, and an entry page, in both themes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import * as H from './helpers.mjs';
import * as B from './browser-helpers.mjs';

const PAGES = [['home', '/'], ['lane index', '/writing/'], ['entry', '/writing/composable-security-investigation/']];
const THEMES = ['dark', 'light'];
const LH_MIN = 95; // SPEC scenario 14 — do not lower.
const T = (ms) => ({ timeout: ms });

let browser;
before(async () => { browser = await B.launch(); });
after(async () => { if (browser) await browser.close(); });

async function assertTheme(page, theme, label) {
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme === 'dark') assert.equal(attr, 'dark', `${label}: page did not come up in dark theme`);
  else assert.ok(attr === 'light' || attr === null, `${label}: page did not come up in light theme (data-theme=${attr})`);
}

for (const theme of THEMES) {
  test(`S14 accessibility (axe, ${theme}): zero serious/critical violations on home, lane index, entry page`, T(180000), async () => {
    const failures = [];
    for (const [label, url] of PAGES) {
      const { page, close } = await B.open(browser, { colorScheme: theme });
      try {
        await page.goto(url, { waitUntil: 'load' });
        await assertTheme(page, theme, `${label} ${url}`);
        const results = await new AxeBuilder({ page }).analyze();
        const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        for (const v of bad) failures.push(`${url} [${theme}] ${v.impact} ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      } finally { await close(); }
    }
    assert.deepEqual(failures, []);
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

for (const theme of THEMES) {
  test(`S14 accessibility (Lighthouse, ${theme}): accessibility score >= ${LH_MIN} on home, lane index, entry page`, T(600000), async () => {
    const port = await freePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-lh-'));
    let context;
    try {
      // A persistent context is the browser's default context, so a page opened here shares
      // localStorage with the target Lighthouse creates over the CDP port.
      context = await chromium.launchPersistentContext(userDataDir, { headless: true, args: [`--remote-debugging-port=${port}`], colorScheme: theme });
      const seed = await context.newPage();
      await seed.goto(H.BASE_URL + '/', { waitUntil: 'load' });
      await seed.evaluate((t) => localStorage.setItem('theme', t), theme);
      await seed.reload({ waitUntil: 'load' });
      await assertTheme(seed, theme, 'lighthouse seed page');
      await seed.close();
      const failures = [];
      for (const [label, url] of PAGES) {
        const result = await lighthouse(H.BASE_URL + url, {
          port, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'],
          disableStorageReset: true, maxWaitForLoad: 30000,
          blockedUrlPatterns: ['*giscus.app*', '*plausible.io*', '*fonts.googleapis.com*', '*fonts.gstatic.com*'],
        });
        const lhr = result && result.lhr;
        assert.ok(lhr && lhr.categories && lhr.categories.accessibility, `${url} [${theme}]: Lighthouse produced no accessibility category (runtimeError: ${JSON.stringify(lhr && lhr.runtimeError)})`);
        const score = Math.round(lhr.categories.accessibility.score * 100);
        if (score < LH_MIN) {
          const refs = lhr.categories.accessibility.auditRefs.map((r) => r.id);
          const failing = refs.map((id) => lhr.audits[id]).filter((a) => a && a.score !== null && a.score < 1).map((a) => `${a.id} (${a.title})`);
          failures.push(`${label} ${url} [${theme}]: accessibility ${score} < ${LH_MIN}; failing audits: ${failing.join('; ')}`);
        }
      }
      assert.deepEqual(failures, []);
    } finally {
      if (context) await context.close().catch(() => {});
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
}
