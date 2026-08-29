// Browser checks (Playwright/Chromium) against the gate server.
// Scenarios: S03(landing) S04(status labels) S06 S07 S10(XML well-formedness) S12 S13 S15 S16 S17.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as H from './helpers.mjs';
import * as B from './browser-helpers.mjs';

const content = H.loadContent();
const pub = H.published(content);
const dr = H.drafts(content);
const allUrls = pub.map((e) => e.url);
const COMPOSABLE_URL = '/writing/composable-security-investigation/';
const GEOIP_URL = '/playbooks/geoip-lookup/';
const T = (ms) => ({ timeout: ms });

let browser;
before(async () => { browser = await B.launch(); });
after(async () => { if (browser) await browser.close(); });

// ---------------- S03 ----------------
test('S03 old URLs live (browser): navigating to each legacy URL lands on its destination', T(180000), async () => {
  const { page, close } = await B.open(browser);
  try {
    const failures = [];
    for (const { from, to } of H.readLegacy()) {
      await page.goto(from, { waitUntil: 'load' }).catch(() => {});
      try { await page.waitForURL((u) => u.pathname === to, { timeout: 10000 }); }
      catch { failures.push(`${from}: expected to land on ${to}, still at ${new URL(page.url()).pathname}`); }
    }
    assert.deepEqual(failures, []);
  } finally { await close(); }
});

// ---------------- S04 (browser) ----------------
test('S04 featured projects (browser): each home card shows its project status label', T(60000), async () => {
  const { page, close } = await B.open(browser);
  try {
    await page.goto('/', { waitUntil: 'load' });
    for (const e of H.expectedFeatured(content)) {
      const card = await B.evalWithTools(page, (arg, t) => t.isolate(arg.url, arg.urls), { url: e.url, urls: allUrls });
      assert.ok(!card.error, `${e.url}: ${card.error}`);
      assert.match(card.text, H.STATUS_LABEL[e.status], `${e.url}: card must show status "${e.status}" (card text: "${card.text.slice(0, 120)}")`);
    }
  } finally { await close(); }
});

// ---------------- S06 ----------------
test('S06 maturity marker everywhere: every lane-index row carries the marker matching frontmatter (server-rendered; JS disabled)', T(120000), async () => {
  const { page, close } = await B.open(browser, { javaScriptEnabled: false });
  try {
    const failures = [];
    for (const lane of H.LANES) {
      await page.goto(`/${lane}/`, { waitUntil: 'load' });
      for (const e of pub.filter((x) => x.lane === lane)) {
        const row = await B.evalWithTools(page, (arg, t) => t.rowFor(arg.url, arg.urls), { url: e.url, urls: allUrls });
        if (row.error) { failures.push(`/${lane}/ row for ${e.url}: ${row.error}`); continue; }
        const wrong = row.markers.filter((m) => m !== e.maturity);
        if (wrong.length) failures.push(`/${lane}/ row for ${e.url}: expected ${e.maturity}, row carries [${row.markers}] — ${row.html.slice(0, 200)}`);
      }
    }
    assert.deepEqual(failures, []);
  } finally { await close(); }
});

test('S06 maturity marker everywhere: every entry page shows the marker matching frontmatter in its meta row (JS disabled)', T(180000), async () => {
  const { page, close } = await B.open(browser, { javaScriptEnabled: false });
  try {
    const failures = [];
    for (const e of pub) {
      await page.goto(e.url, { waitUntil: 'load' });
      const marks = await B.evalWithTools(page, (arg, t) => t.findMarkers(document.querySelector('main') || document.body).map((m) => m.value));
      if (!marks.length) { failures.push(`${e.url}: no maturity marker found`); continue; }
      if (marks[0] !== e.maturity) failures.push(`${e.url}: first marker is ${marks[0]}, frontmatter says ${e.maturity}`);
    }
    assert.deepEqual(failures, []);
  } finally { await close(); }
});

test('S06 (supporting, B3) home garden rows carry the marker matching each note (JS disabled)', T(60000), async () => {
  const garden = H.expectedGarden(content);
  const { page, close } = await B.open(browser, { javaScriptEnabled: false });
  try {
    await page.goto('/', { waitUntil: 'load' });
    const failures = [];
    for (const e of garden) {
      const row = await B.evalWithTools(page, (arg, t) => t.rowFor(arg.url, arg.urls), { url: e.url, urls: allUrls });
      if (row.error) failures.push(`garden row ${e.url}: ${row.error}`);
      else if (row.markers.some((m) => m !== e.maturity)) failures.push(`garden row ${e.url}: expected ${e.maturity}, got [${row.markers}]`);
    }
    assert.deepEqual(failures, []);
    const legend = await page.evaluate(() => (document.querySelector('main') || document.body).textContent.toLowerCase());
    for (const m of H.MATURITIES) assert.ok(legend.includes(m), `home maturity legend must mention "${m}"`);
  } finally { await close(); }
});

// ---------------- S07 ----------------
async function checkFilter(lane, maturity) {
  const expected = pub.filter((e) => e.lane === lane && e.maturity === maturity);
  const laneUrls = pub.filter((e) => e.lane === lane).map((e) => e.url);
  const { page, close } = await B.open(browser, { javaScriptEnabled: false });
  try {
    await page.goto(`/${lane}/?maturity=${maturity}`, { waitUntil: 'load' });
    const listed = await B.evalWithTools(page, (arg, t) => t.listedEntryUrls(arg.urls), { urls: laneUrls });
    assert.deepEqual([...listed].sort(), expected.map((e) => e.url).sort(), `/${lane}/?maturity=${maturity} (no JS) must list exactly the ${maturity} entries`);
    for (const url of listed) {
      const row = await B.evalWithTools(page, (arg, t) => t.rowFor(arg.url, arg.urls), { url, urls: laneUrls });
      assert.ok(!row.error, `${url}: ${row.error}`);
      assert.ok(row.markers.every((m) => m === maturity), `${url}: filtered list row carries [${row.markers}], expected only ${maturity}`);
    }
    const html = await page.content();
    for (const m of H.MATURITIES) assert.ok(/href=["'][^"']*\?maturity=/.test(html) && html.toLowerCase().includes(`?maturity=${m}`), `/${lane}/ must offer a no-JS filter link ?maturity=${m}`);
  } finally { await close(); }
}
test('S07 filter without JS: /writing/?maturity=growing renders only growing entries with JavaScript disabled', T(60000), async () => {
  assert.ok(pub.some((e) => e.lane === 'writing' && e.maturity === 'growing'), 'precondition: at least one growing writing entry (INTERFACES §4 has two)');
  await checkFilter('writing', 'growing');
});
test('S07 (supporting) /writing/?maturity=evergreen and ?maturity=seedling also filter without JS', T(60000), async () => {
  await checkFilter('writing', 'evergreen');
  await checkFilter('writing', 'seedling');
});

// ---------------- S10 (well-formedness) ----------------
test('S10 feeds validate: rss.xml, per-lane rss.xml and sitemaps are well-formed XML (DOMParser)', T(60000), async () => {
  const { page, close } = await B.open(browser);
  try {
    await page.goto('/', { waitUntil: 'load' });
    const files = ['rss.xml', ...H.LANES.map((l) => `${l}/rss.xml`), ...H.distFiles().filter((r) => /^sitemap.*\.xml$/.test(r))];
    for (const rel of files) {
      assert.ok(H.distExists(rel), `dist/${rel} missing`);
      const err = await page.evaluate((xml) => { const d = new DOMParser().parseFromString(xml, 'application/xml'); const e = d.querySelector('parsererror'); return e ? e.textContent : null; }, H.readDist(rel));
      assert.equal(err, null, `dist/${rel} is not well-formed XML: ${err}`);
    }
  } finally { await close(); }
});

// ---------------- S12 ----------------
async function focusSearch(page) {
  await page.keyboard.press('/');
  let tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName.toLowerCase());
  if (tag !== 'input' && tag !== 'textarea') {
    const trigger = page.locator('[aria-label*="search" i], [data-search], button:has-text("Search"), a[href*="search"], .search').first();
    if (await trigger.count()) await trigger.click({ timeout: 5000 }).catch(() => {});
    const input = page.locator('input[type="search"], input[role="combobox"], [role="searchbox"], input[aria-label*="search" i], input[placeholder*="search" i]').first();
    await input.focus({ timeout: 5000 }).catch(() => {});
    tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName.toLowerCase());
  }
  return tag;
}
async function typeIntoFocused(page, text) {
  // Clear anything the "/" shortcut may have typed, then type for real so input events fire.
  await page.evaluate(() => { const el = document.activeElement; if (el && 'value' in el) el.value = ''; });
  await page.keyboard.type(text, { delay: 20 });
}
test('S12 search: with JS on, typing "playbook" returns the GeoIP playbook and the Composable post, each showing lane and maturity', T(90000), async () => {
  const { page, close } = await B.open(browser);
  try {
    await page.goto('/about/', { waitUntil: 'load' });
    const tag = await focusSearch(page);
    assert.ok(tag === 'input' || tag === 'textarea', `pressing "/" (or opening search from the nav) must focus the search input; active element is <${tag}>`);
    const t0 = Date.now();
    await typeIntoFocused(page, 'playbook');
    try {
      await page.waitForFunction((urls) => urls.every((u) => Array.from(document.querySelectorAll('a[href]')).some((a) => new URL(a.getAttribute('href'), location.href).pathname === u)), [GEOIP_URL, COMPOSABLE_URL], { timeout: 20000 });
    } catch {
      const seen = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')).filter((h) => /^\/(writing|projects|notes|playbooks)\/[^/]+\/?$/.test(h)));
      assert.fail(`search for "playbook" did not surface both ${GEOIP_URL} and ${COMPOSABLE_URL} within 20s; entry links seen: [${seen}]`);
    }
    const latency = Date.now() - t0;
    for (const [url, lane] of [[GEOIP_URL, 'playbooks'], [COMPOSABLE_URL, 'writing']]) {
      const item = await B.evalWithTools(page, (arg, t) => t.isolate(arg.url, arg.urls, document.body), { url, urls: allUrls });
      assert.ok(!item.error, `${url}: ${item.error}`);
      assert.ok(item.text.toLowerCase().includes(H.LANE_LABEL[lane].toLowerCase()), `search result for ${url} must show its lane "${H.LANE_LABEL[lane]}" (result text: "${item.text.slice(0, 120)}")`);
      assert.ok(item.markers.length, `search result for ${url} must show its maturity (result html: ${item.html.slice(0, 200)})`);
    }
    // adversarial: drafts are not in the index
    const d = dr.find((x) => x.title && x.title.length > 3);
    if (d) {
      const word = d.title.split(/\W+/).filter((w) => w.length > 3).sort((a, b) => b.length - a.length)[0] || d.title;
      await typeIntoFocused(page, word);
      await page.waitForTimeout(Math.max(3000, latency * 3));
      const leaked = await page.evaluate((urls) => Array.from(document.querySelectorAll('a[href]')).map((a) => new URL(a.getAttribute('href'), location.href).pathname).filter((p) => urls.includes(p)), dr.map((x) => x.url));
      assert.deepEqual(leaked, [], `search for "${word}" surfaced draft URLs`);
    }
  } finally { await close(); }
});

// ---------------- S13 ----------------
const THEME_RECORDER = () => {
  window.__gate = { rafTheme: undefined, rafBg: undefined, history: [] };
  const attach = () => {
    const html = document.documentElement; if (!html) return false;
    new MutationObserver(() => window.__gate.history.push(html.getAttribute('data-theme'))).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return true;
  };
  if (!attach()) new MutationObserver((_, o) => { if (attach()) o.disconnect(); }).observe(document, { childList: true });
  requestAnimationFrame(() => {
    window.__gate.rafTheme = document.documentElement.getAttribute('data-theme');
    window.__gate.rafBg = getComputedStyle(document.body || document.documentElement).backgroundColor;
  });
};
async function themeState(page) {
  return page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    stored: Object.keys(localStorage).length,
    gate: window.__gate || null,
  }));
}
test('S13 theme: with prefers-color-scheme dark and no stored preference, first paint is dark (attribute set before first frame, no light background)', T(60000), async () => {
  const { page, context, close } = await B.open(browser, { colorScheme: 'dark' });
  try {
    await context.addInitScript(THEME_RECORDER);
    await page.goto('/', { waitUntil: 'load' });
    const s = await themeState(page);
    assert.equal(s.attr, 'dark', 'html[data-theme] must be "dark" after load');
    assert.equal(s.gate && s.gate.rafTheme, 'dark', `html[data-theme] at the first animation frame was ${JSON.stringify(s.gate && s.gate.rafTheme)} — the theme must be set by an inline head script before first paint`);
    const first = B.rgb(s.gate && s.gate.rafBg);
    if (first && !/rgba\(0, 0, 0, 0\)/.test(s.gate.rafBg)) assert.ok(B.luminance(first) < 0.5, `background at first frame was light: ${s.gate.rafBg}`);
    assert.deepEqual(B.rgb(s.bg), B.DARK_BG, `dark body background must be #1d2021, got ${s.bg}`);
  } finally { await close(); }
});
test('S13 theme: with prefers-color-scheme light and no stored preference, the page is light', T(60000), async () => {
  const { page, close } = await B.open(browser, { colorScheme: 'light' });
  try {
    await page.goto('/', { waitUntil: 'load' });
    const s = await themeState(page);
    assert.ok(s.attr === 'light' || s.attr === null, `html[data-theme] must be "light" (or unset) in light mode, got ${s.attr}`);
    assert.deepEqual(B.rgb(s.bg), B.LIGHT_BG, `light body background must be #f9f5d7, got ${s.bg}`);
  } finally { await close(); }
});
test('S13 theme: the toggle overrides the OS preference, persists in localStorage across reload, and clearing storage restores the OS preference', T(90000), async () => {
  const { page, close } = await B.open(browser, { colorScheme: 'dark' });
  try {
    await page.goto('/', { waitUntil: 'load' });
    assert.equal((await themeState(page)).attr, 'dark');
    const toggle = page.locator('[data-theme-toggle], button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i], button[title*="theme" i], .theme-toggle, #theme-toggle').first();
    assert.ok(await toggle.count(), 'no theme toggle found in the nav (looked for data-theme-toggle / aria-label containing theme|dark|light / .theme-toggle)');
    await toggle.click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') !== 'dark', null, { timeout: 5000 }).catch(() => {});
    let s = await themeState(page);
    assert.ok(s.attr === 'light', `after toggling from dark, html[data-theme] must be "light", got ${s.attr}`);
    assert.deepEqual(B.rgb(s.bg), B.LIGHT_BG, `after toggle body background must be light, got ${s.bg}`);
    assert.ok(s.stored >= 1, 'toggle must persist the choice in localStorage');
    await page.reload({ waitUntil: 'load' });
    s = await themeState(page);
    assert.equal(s.attr, 'light', 'theme choice must survive reload');
    assert.deepEqual(B.rgb(s.bg), B.LIGHT_BG);
    await page.goto('/writing/', { waitUntil: 'load' });
    s = await themeState(page);
    assert.equal(s.attr, 'light', 'theme choice must apply on other pages');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    s = await themeState(page);
    assert.equal(s.attr, 'dark', 'with storage cleared the OS preference (dark) must win again');
  } finally { await close(); }
});

// ---------------- S15 ----------------
test('S15 fonts: no request to fonts.googleapis.com or fonts.gstatic.com on any page; fonts are self-hosted and declared', T(90000), async () => {
  for (const url of ['/', '/writing/', COMPOSABLE_URL]) {
    const { page, requests, close } = await B.open(browser);
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bad = requests.filter((r) => /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(r));
      assert.deepEqual(bad, [], `${url}: third-party font requests`);
      const local = requests.filter((r) => new URL(r).origin === B.ORIGIN && /\.(woff2?|ttf|otf)(\?|$)/i.test(r));
      assert.ok(local.length >= 1, `${url}: expected at least one same-origin font file request (self-hosted fonts)`);
      const fams = await page.evaluate(() => Array.from(document.fonts).map((f) => f.family.replace(/["']/g, '').toLowerCase()));
      for (const want of [/newsreader/, /source serif/, /jetbrains/]) assert.ok(fams.some((f) => want.test(f)), `${url}: no @font-face family matching ${want} (found: ${[...new Set(fams)].join(', ')})`);
    } finally { await close(); }
  }
});

// ---------------- S16 ----------------
const OVERFLOW_PROBE = () => {
  const iw = window.innerWidth;
  const offenders = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed' || el.closest('[hidden], [aria-hidden="true"]')) continue;
    let clipped = false; let p = el.parentElement;
    while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (['hidden', 'auto', 'scroll', 'clip'].includes(ox)) { clipped = true; break; } p = p.parentElement; }
    if (clipped) continue;
    if (r.right > iw + 1 || r.left < -1) offenders.push(`<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}> left=${Math.round(r.left)} right=${Math.round(r.right)} (viewport ${iw})`);
  }
  return { scrollWidth: document.scrollingElement.scrollWidth, innerWidth: iw, offenders: offenders.slice(0, 8) };
};
test('S16 mobile: at 390x844 the home page has no horizontal overflow and sections run nav → hero → Featured projects → Selected writing → From the garden → footer', T(60000), async () => {
  const { page, close } = await B.open(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  try {
    await page.goto('/', { waitUntil: 'load' });
    const o = await page.evaluate(OVERFLOW_PROBE);
    assert.ok(o.scrollWidth <= o.innerWidth, `document scrollWidth ${o.scrollWidth} > viewport ${o.innerWidth}`);
    assert.deepEqual(o.offenders, [], 'elements extending past the 390px viewport');
    const order = await page.evaluate(() => {
      const y = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : null);
      const heading = (re) => Array.from(document.querySelectorAll('h1, h2, h3')).find((h) => re.test(h.textContent.replace(/\s+/g, ' ').trim()));
      const hero = Array.from(document.querySelectorAll('h1, h2, p')).find((el) => /I build robots to fight cybercrime/i.test(el.textContent));
      return { nav: y(document.querySelector('nav')), hero: y(hero), featured: y(heading(/featured projects/i)), writing: y(heading(/selected writing/i)), garden: y(heading(/from the garden/i)), footer: y(document.querySelector('footer')) };
    });
    for (const k of Object.keys(order)) assert.ok(order[k] !== null, `home is missing its ${k} section (headline / heading / landmark not found)`);
    const seq = ['nav', 'hero', 'featured', 'writing', 'garden', 'footer'];
    for (let i = 1; i < seq.length; i++) assert.ok(order[seq[i]] >= order[seq[i - 1]], `section order wrong: ${seq[i - 1]} (${Math.round(order[seq[i - 1]])}px) should be above ${seq[i]} (${Math.round(order[seq[i]])}px)`);
  } finally { await close(); }
});
test('S16 (supporting, B9) nothing horizontally scrolls at 360px on home, a lane index, and an entry page', T(60000), async () => {
  for (const url of ['/', '/writing/', COMPOSABLE_URL]) {
    const { page, close } = await B.open(browser, { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    try {
      await page.goto(url, { waitUntil: 'load' });
      const o = await page.evaluate(OVERFLOW_PROBE);
      assert.ok(o.scrollWidth <= o.innerWidth, `${url}: scrollWidth ${o.scrollWidth} > viewport ${o.innerWidth}`);
      assert.deepEqual(o.offenders, [], `${url}: elements extending past the 360px viewport`);
    } finally { await close(); }
  }
});

// ---------------- S17 ----------------
const GISCUS_SEL = 'script[src*="giscus.app"], iframe[src*="giscus.app"], iframe.giscus-frame, .giscus';
test('S17 comments: Giscus is present on an entry page (same repo/category/mapping) and absent on home and index pages', T(90000), async () => {
  const { page, close } = await B.open(browser);
  try {
    await page.goto(COMPOSABLE_URL, { waitUntil: 'load' });
    await page.waitForSelector(GISCUS_SEL, { state: 'attached', timeout: 10000 }).catch(() => {});
    const g = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const s = document.querySelector('script[src*="giscus.app"]'); return { tag: el.tagName.toLowerCase(), repo: s && s.getAttribute('data-repo'), category: s && s.getAttribute('data-category'), mapping: s && s.getAttribute('data-mapping') }; }, GISCUS_SEL);
    assert.ok(g, `${COMPOSABLE_URL}: no Giscus script/iframe found`);
    if (g.repo !== null) {
      assert.equal(g.repo, 'theaj42/ajvanbeest-com', 'giscus data-repo must be unchanged');
      assert.equal(g.category, 'General', 'giscus data-category must be unchanged');
      assert.equal(g.mapping, 'pathname', 'giscus data-mapping must be unchanged');
    }
    for (const url of ['/', ...H.LANES.map((l) => `/${l}/`), '/tags/']) {
      await page.goto(url, { waitUntil: 'load' });
      const n = await page.evaluate((sel) => document.querySelectorAll(sel).length, GISCUS_SEL);
      assert.equal(n, 0, `${url}: Giscus must not be present on home/index pages`);
      assert.ok(!/giscus\.app/i.test(H.readDist(url === '/' ? 'index.html' : `${url.slice(1)}index.html`)), `${url}: static HTML must not reference giscus.app`);
    }
  } finally { await close(); }
});
