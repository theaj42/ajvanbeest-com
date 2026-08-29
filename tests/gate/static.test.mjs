// Static + HTTP checks against dist/ and the gate server. No browser.
// Scenarios: S01 S02 S03(static) S04(static) S05(static) S08 S09 S10 S11 + supporting B6/B8/B9/B10 checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as H from './helpers.mjs';

const content = H.loadContent();
const pub = H.published(content);
const dr = H.drafts(content);
const find = (lane, slug) => content.find((e) => e.lane === lane && e.slug === slug);
const COMPOSABLE = { lane: 'writing', slug: 'composable-security-investigation' };

test('S00 preconditions: dist/ is built and src/content has entries', () => {
  assert.ok(fs.existsSync(H.DIST_DIR), `DIST not found at ${H.DIST_DIR} (run npm run build first)`);
  assert.ok(H.distExists('index.html'), 'dist/index.html missing');
  assert.ok(fs.existsSync(H.CONTENT_DIR), `SRC_CONTENT not found at ${H.CONTENT_DIR}`);
  assert.ok(pub.length >= 9, `expected at least 9 non-draft entries (6 posts + 3 projects), found ${pub.length}`);
  for (const e of content) assert.ok(!isNaN(e.date), `${e.file}: date "${e.data.date}" is not a valid date`);
  for (const e of content) assert.ok(H.MATURITIES.includes(e.maturity), `${e.file}: maturity "${e.maturity}" is not one of ${H.MATURITIES}`);
});

// ---------------- S01 ----------------
test('S01 lanes exist: /writing/ /projects/ /notes/ /playbooks/ /tags/ /about/ return 200 and share the nav', async () => {
  const pages = ['/writing/', '/projects/', '/notes/', '/playbooks/', '/tags/', '/about/'];
  const navLinks = ['/writing/', '/projects/', '/notes/', '/playbooks/', '/about/'];
  for (const p of pages) {
    const r = await H.get(p);
    assert.equal(r.status, 200, `${p} must return 200`);
    const navs = H.blocks(r.text, 'nav');
    assert.ok(navs.length, `${p}: no <nav> element`);
    const ok = navs.some((n) => { const ps = H.hrefs(n).map(H.pathnameOf); return navLinks.every((l) => ps.includes(l)); });
    assert.ok(ok, `${p}: no <nav> links to all of ${navLinks.join(' ')}`);
  }
});

test('S01 lane index rows: every non-draft entry of a lane is listed newest-first with a link to its canonical URL', () => {
  for (const lane of H.LANES) {
    const html = H.readDist(`${lane}/index.html`);
    const expected = pub.filter((e) => e.lane === lane);
    const listed = H.entryLinks(html, lane);
    assert.deepEqual([...listed].sort(), expected.map((e) => e.slug).sort(), `/${lane}/ must list exactly the non-draft ${lane} entries`);
    if (lane !== 'projects') {
      const dates = listed.map((s) => expected.find((e) => e.slug === s).date.getTime());
      assert.ok(H.isNonIncreasing(dates), `/${lane}/ is not newest-first: ${listed.join(', ')}`);
    } else {
      const feat = H.expectedFeatured(content).map((e) => e.slug);
      assert.deepEqual(listed.slice(0, feat.length), feat, '/projects/ must sort featured first (in featured order)');
      const rest = listed.slice(feat.length).map((s) => expected.find((e) => e.slug === s).date.getTime());
      assert.ok(H.isNonIncreasing(rest), '/projects/ non-featured entries must be newest-first');
    }
  }
});

// ---------------- S02 ----------------
test('S02 migration complete: the 6 posts + 3 projects from INTERFACES §4 exist with the expected maturity/status/alias and resolve at their canonical URLs', async () => {
  for (const x of H.HARD_EXPECTED) {
    const e = find(x.lane, x.slug);
    assert.ok(e, `src/content/${x.lane}/${x.slug}.md is missing (INTERFACES §4)`);
    assert.equal(e.draft, false, `${e.url} must not be a draft`);
    if (x.maturity) assert.equal(e.maturity, x.maturity, `${e.url}: maturity`);
    if (x.status) assert.equal(e.status, x.status, `${e.url}: status`);
    if (x.featured) assert.equal(e.featured, x.featured, `${e.url}: featured`);
    if (x.alias) assert.ok(e.aliases.includes(x.alias), `${e.url}: aliases must include ${x.alias}`);
    assert.ok(H.distExists(`${x.lane}/${x.slug}/index.html`), `dist/${x.lane}/${x.slug}/index.html missing`);
    const r = await H.get(e.url);
    assert.equal(r.status, 200, `${e.url} must be 200`);
    assert.ok(H.containsText(H.titleOf(r.text) + ' ' + H.h1Of(r.text), e.title), `${e.url}: title "${e.title}" not found in <title> or <h1>`);
  }
});

test('S02 migration complete: every non-draft entry has a canonical page, and it carries the title', () => {
  for (const e of pub) {
    const rel = `${e.lane}/${e.slug}/index.html`;
    assert.ok(H.distExists(rel), `dist/${rel} missing for ${e.file}`);
    const html = H.readDist(rel);
    assert.ok(H.containsText(H.titleOf(html) + ' ' + H.h1Of(html), e.title), `${e.url}: title not in <title>/<h1>`);
  }
});

test('S02 drafts absent (adversarial): no draft page, twin, URL, or title appears anywhere in dist/ outside redirect pages', () => {
  assert.ok(dr.length >= 1, 'expected at least one draft: true entry in src/content (INTERFACES §4 moves 10 drafts with draft: true)');
  const offenders = [];
  for (const d of dr) {
    for (const rel of [`${d.lane}/${d.slug}/index.html`, `${d.lane}/${d.slug}.md`, `${d.lane}/${d.slug}.json`, `og/${d.lane}/${d.slug}.png`]) {
      if (H.distExists(rel)) offenders.push(`dist/${rel} exists for draft ${d.file}`);
    }
  }
  const needles = dr.flatMap((d) => [{ d, kind: 'url', s: d.url }, { d, kind: 'md-twin', s: `/${d.lane}/${d.slug}.md` }, ...(d.title ? [{ d, kind: 'title', s: d.title }] : [])]);
  for (const rel of H.distTextFiles()) {
    const text = H.readDist(rel);
    if (H.metaRefreshTarget(text)) continue; // redirect pages are exempt per the scenario text
    for (const n of needles) if (H.containsText(text, n.s)) offenders.push(`dist/${rel} contains draft ${n.kind} "${n.s}" (${path.basename(n.d.file)})`);
  }
  assert.deepEqual(offenders, []);
});

// ---------------- S03 (static) ----------------
test('S03 old URLs live (static): every legacy-urls.txt line and every frontmatter alias has a redirect page (meta refresh + canonical + visible link) that is served and whose destination is 200', async () => {
  const legacy = H.readLegacy();
  assert.ok(legacy.length >= 11, 'legacy-urls.txt must have at least 11 lines');
  const pairs = legacy.map((l) => ({ ...l, src: 'legacy-urls.txt' }));
  for (const e of pub) for (const a of e.aliases) pairs.push({ from: a, to: e.url, src: path.basename(e.file) });
  const failures = [];
  for (const { from, to, src } of pairs) {
    const html = H.readRedirectPage(from);
    if (!html) { failures.push(`${from} (${src}): no redirect page in dist (expected dist${from}/index.html or dist${from})`); continue; }
    const target = H.pathnameOf(H.metaRefreshTarget(html));
    if (target !== to) failures.push(`${from}: meta refresh target is ${target}, expected ${to}`);
    const canon = H.pathnameOf(H.canonicalHref(html));
    if (canon !== to) failures.push(`${from}: <link rel=canonical> is ${canon}, expected ${to}`);
    if (!H.hrefs(html).map(H.pathnameOf).includes(to)) failures.push(`${from}: no visible <a href> to ${to}`);
    const dest = await H.get(to);
    if (dest.status !== 200) failures.push(`${from}: destination ${to} returned ${dest.status}`);
    const served = await H.get(from);
    if (served.status !== 200) failures.push(`${from}: served status ${served.status}`);
    else if (H.pathnameOf(H.metaRefreshTarget(served.text)) !== to) failures.push(`${from}: served page does not meta-refresh to ${to}`);
  }
  assert.deepEqual(failures, []);
});

// ---------------- S04 / S05 (static, live content) ----------------
test('S04 featured projects: home shows exactly the `featured` projects, in featured order, max 3, with an "All projects" link', () => {
  const home = H.readDist('index.html');
  const exp = H.expectedFeatured(content).map((e) => e.slug);
  assert.ok(exp.length >= 1, 'precondition: at least one project has `featured` (INTERFACES §4 expects 3)');
  assert.deepEqual(H.entryLinks(home, 'projects'), exp, 'home project cards (by link order) must equal featured projects ascending');
  assert.ok(H.hrefs(home).map(H.pathnameOf).includes('/projects/'), 'home must link to /projects/ ("All projects")');
  assert.match(H.stripTags(home), /featured projects/i, 'home must have the "Featured projects" section');
});

test('S05 selected writing rule: home shows the 3 newest evergreen writing entries, backfilled with the newest growing when fewer than 3 evergreen exist', () => {
  const home = H.readDist('index.html');
  const w = pub.filter((e) => e.lane === 'writing');
  const exp = H.expectedSelectedWriting(content);
  assert.equal(exp.length, 3, `precondition: content must yield 3 selected entries, rule yields ${exp.length}`);
  const err = H.sameOrderModuloTies(H.entryLinks(home, 'writing'), exp, w);
  assert.equal(err, null, `home selected writing mismatch: ${err}`);
  assert.ok(H.hrefs(home).map(H.pathnameOf).includes('/writing/'), 'home must link to /writing/ ("All writing")');
});

test('S05 (supporting, B3) from the garden: home lists the newest notes (max 4) and links to /notes/', () => {
  const home = H.readDist('index.html');
  const notes = pub.filter((e) => e.lane === 'notes');
  const exp = H.expectedGarden(content);
  const err = H.sameOrderModuloTies(H.entryLinks(home, 'notes'), exp, notes);
  assert.equal(err, null, `home garden mismatch: ${err}`);
  assert.ok(H.hrefs(home).map(H.pathnameOf).includes('/notes/'), 'home must link to /notes/ ("All notes")');
  assert.match(H.stripTags(home), /from the garden/i);
});

// ---------------- S08 ----------------
test('S08 markdown twin: /<lane>/<slug>.md is byte-for-byte the source file (dist and served), and drafts have no twin', async () => {
  for (const e of pub) {
    const rel = `${e.lane}/${e.slug}.md`;
    assert.ok(H.distExists(rel), `dist/${rel} missing`);
    const src = fs.readFileSync(e.file);
    assert.ok(src.equals(H.readDistBuf(rel)), `dist/${rel} differs from ${e.file}`);
    const r = await H.get(`/${rel}`);
    assert.equal(r.status, 200, `/${rel} must be 200`);
    assert.ok(src.equals(r.buf), `served /${rel} differs from ${e.file} (${r.buf.length} vs ${src.length} bytes)`);
  }
  for (const d of dr) assert.ok(!H.distExists(`${d.lane}/${d.slug}.md`), `draft twin dist/${d.lane}/${d.slug}.md must not exist`);
});

// ---------------- S09 ----------------
test('S09 JSON twin: composable-security-investigation.json parses, tags is an array, maturity is "evergreen", markdown non-empty', async () => {
  const r = await H.get(`/${COMPOSABLE.lane}/${COMPOSABLE.slug}.json`);
  assert.equal(r.status, 200);
  const j = JSON.parse(r.text);
  assert.ok(Array.isArray(j.tags), 'tags must be an array');
  assert.equal(j.maturity, 'evergreen');
  assert.ok(typeof j.markdown === 'string' && j.markdown.trim().length > 0, 'markdown must be non-empty');
});

test('S09 JSON twin shape (INTERFACES §8) for every non-draft entry', () => {
  const req = ['title', 'subtitle', 'description', 'lane', 'slug', 'url', 'maturity', 'date', 'updated', 'tags', 'wordCount', 'readingMinutes', 'markdown', 'html', 'links', 'alternates'];
  for (const e of pub) {
    const rel = `${e.lane}/${e.slug}.json`;
    assert.ok(H.distExists(rel), `dist/${rel} missing`);
    let j; try { j = JSON.parse(H.readDist(rel)); } catch (err) { assert.fail(`dist/${rel} is not valid JSON: ${err.message}`); }
    for (const k of req) assert.ok(k in j, `dist/${rel}: missing key "${k}"`);
    assert.equal(j.title, e.title, `${rel}: title`);
    assert.equal(j.lane, e.lane); assert.equal(j.slug, e.slug);
    assert.equal(j.url, `${H.SITE}${e.url}`, `${rel}: url must be absolute canonical`);
    assert.equal(j.maturity, e.maturity, `${rel}: maturity`);
    assert.equal(j.date, H.fmtISO(e.date), `${rel}: date must be ISO YYYY-MM-DD`);
    assert.ok(j.updated === null || /^\d{4}-\d{2}-\d{2}$/.test(j.updated), `${rel}: updated must be null or YYYY-MM-DD`);
    assert.deepEqual(j.tags, Array.isArray(e.data.tags) ? e.data.tags : [], `${rel}: tags`);
    assert.ok(Number.isInteger(j.wordCount) && j.wordCount > 0, `${rel}: wordCount`);
    assert.ok(Number.isInteger(j.readingMinutes) && j.readingMinutes >= 1, `${rel}: readingMinutes`);
    assert.ok(typeof j.markdown === 'string' && j.markdown.trim().length > 0, `${rel}: markdown`);
    assert.ok(typeof j.html === 'string' && /<[a-z]/i.test(j.html), `${rel}: html`);
    assert.ok(Array.isArray(j.links), `${rel}: links`);
    assert.equal(H.pathnameOf(j.alternates?.markdown), `/${e.lane}/${e.slug}.md`, `${rel}: alternates.markdown`);
    assert.equal(H.pathnameOf(j.alternates?.json), `/${e.lane}/${e.slug}.json`, `${rel}: alternates.json`);
    assert.equal(H.pathnameOf(j.alternates?.html), e.url, `${rel}: alternates.html`);
    if (e.lane === 'projects') { assert.equal(j.status, e.status, `${rel}: status`); assert.ok('featured' in j && 'externalUrl' in j, `${rel}: projects add status/externalUrl/featured`); }
  }
  for (const d of dr) assert.ok(!H.distExists(`${d.lane}/${d.slug}.json`), `draft twin dist/${d.lane}/${d.slug}.json must not exist`);
});

// ---------------- S10 ----------------
function checkJsonFeed(rel, expectedEntries) {
  assert.ok(H.distExists(rel), `dist/${rel} missing`);
  let f; try { f = JSON.parse(H.readDist(rel)); } catch (err) { assert.fail(`dist/${rel}: invalid JSON: ${err.message}`); }
  assert.equal(f.version, 'https://jsonfeed.org/version/1.1', `${rel}: version`);
  assert.ok(typeof f.title === 'string' && f.title, `${rel}: title`);
  assert.ok(Array.isArray(f.items), `${rel}: items`);
  assert.ok(f.items.length <= 50, `${rel}: max 50 items`);
  for (const it of f.items) {
    assert.ok(it.id, `${rel}: item without id`);
    assert.ok(typeof it.url === 'string', `${rel}: item without url`);
    assert.ok(typeof it.content_html === 'string' || typeof it.content_text === 'string', `${rel}: item ${it.url} needs content_html or content_text`);
    assert.ok(typeof it.date_published === 'string' && !isNaN(new Date(it.date_published)), `${rel}: item ${it.url} date_published`);
  }
  const got = f.items.map((it) => H.pathnameOf(it.url)).sort();
  const exp = expectedEntries.slice(0, 50).map((e) => e.url).sort();
  assert.deepEqual(got, exp, `${rel}: item URLs must be exactly the non-draft entries`);
  assert.ok(H.isNonIncreasing(f.items.map((it) => new Date(it.date_published).getTime())), `${rel}: items must be newest first`);
  const text = H.readDist(rel);
  for (const d of dr) { assert.ok(!H.containsText(text, d.url), `${rel} contains draft url ${d.url}`); if (d.title) assert.ok(!H.containsText(text, d.title), `${rel} contains draft title "${d.title}"`); }
}
function checkRss(rel, expectedEntries) {
  assert.ok(H.distExists(rel), `dist/${rel} missing`);
  const xml = H.readDist(rel);
  assert.match(xml, /<rss\b[^>]*version=["']2\.0["']/i, `${rel}: <rss version="2.0"> root`);
  const ch = H.blocks(xml, 'channel')[0];
  assert.ok(ch, `${rel}: <channel>`);
  for (const t of ['title', 'link', 'description']) assert.match(ch, new RegExp(`<${t}\\b[^>]*>[^<]+<\\/${t}>`, 'i'), `${rel}: channel <${t}>`);
  const items = H.rssItems(xml);
  assert.ok(items.length <= 50, `${rel}: max 50 items`);
  for (const it of items) {
    assert.ok(it.title || it.description, `${rel}: item needs title or description`);
    assert.ok(it.link && /^https?:\/\//.test(it.link), `${rel}: item link must be absolute (${it.link})`);
    assert.ok(it.guid, `${rel}: item ${it.link} needs <guid>`);
    assert.ok(it.pubDate && H.RFC822.test(it.pubDate), `${rel}: item ${it.link} pubDate "${it.pubDate}" is not RFC 822`);
  }
  const got = items.map((it) => H.pathnameOf(it.link)).sort();
  const exp = expectedEntries.slice(0, 50).map((e) => e.url).sort();
  assert.deepEqual(got, exp, `${rel}: item links must be exactly the non-draft entries`);
  assert.ok(H.isNonIncreasing(items.map((it) => new Date(it.pubDate).getTime())), `${rel}: items must be newest first`);
  for (const d of dr) { assert.ok(!H.containsText(xml, d.url), `${rel} contains draft url ${d.url}`); if (d.title) assert.ok(!H.containsText(xml, d.title), `${rel} contains draft title "${d.title}"`); }
}
test('S10 feeds validate: /feed.json is JSON Feed 1.1 with every non-draft entry, newest first, no drafts', () => {
  checkJsonFeed('feed.json', [...pub].sort(H.byDateDesc));
});
test('S10 feeds validate: /rss.xml is RSS 2.0 (required elements, absolute links, RFC 822 dates) with every non-draft entry, no drafts', () => {
  checkRss('rss.xml', [...pub].sort(H.byDateDesc));
});
test('S10 (supporting, B6) per-lane feeds /<lane>/feed.json and /<lane>/rss.xml', () => {
  for (const lane of H.LANES) {
    const es = pub.filter((e) => e.lane === lane).sort(H.byDateDesc);
    checkJsonFeed(`${lane}/feed.json`, es);
    checkRss(`${lane}/rss.xml`, es);
  }
});

// ---------------- S11 ----------------
test('S11 llms.txt: every non-draft entry listed under its lane H2 (nav order), each line linking the .md twin; no drafts', () => {
  assert.ok(H.distExists('llms.txt'), 'dist/llms.txt missing');
  const txt = H.readDist('llms.txt');
  assert.match(txt, /^# .+/m, 'must start with an H1 site title');
  const h2s = [...txt.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(h2s, H.LANES.map((l) => H.LANE_LABEL[l]), 'one H2 per lane, in nav order');
  let lane = null; const found = new Map(); const unknown = [];
  for (const line of txt.split(/\r?\n/)) {
    const h = /^## (.+)$/.exec(line); if (h) { lane = H.LANES.find((l) => H.LANE_LABEL[l] === h[1].trim()); continue; }
    const m = /^- \[(.+?)\]\((\S+?)\)(?::\s*(.*))?$/.exec(line); if (!m) continue;
    const p = H.pathnameOf(m[2]);
    const e = pub.find((x) => `/${x.lane}/${x.slug}.md` === p);
    if (!e) { unknown.push(line); continue; }
    found.set(e.url, { lane, title: m[1], href: m[2] });
  }
  assert.deepEqual(unknown, [], 'llms.txt lines that do not link a non-draft entry .md twin (draft leak or wrong URL)');
  for (const e of pub) {
    const f = found.get(e.url);
    assert.ok(f, `llms.txt: missing entry ${e.url} (expected "- [${e.title}](${H.SITE}/${e.lane}/${e.slug}.md): ...")`);
    assert.equal(f.lane, e.lane, `llms.txt: ${e.url} listed under the wrong lane heading`);
    assert.equal(f.href, `${H.SITE}/${e.lane}/${e.slug}.md`, `llms.txt: ${e.url} must link the absolute .md twin`);
    assert.equal(f.title, e.title, `llms.txt: ${e.url} title`);
  }
  for (const d of dr) if (d.title) assert.ok(!txt.includes(d.title), `llms.txt contains draft title "${d.title}"`);
});

test('S11 llms-full.txt: contains the full markdown body of every non-draft entry; no drafts', () => {
  assert.ok(H.distExists('llms-full.txt'), 'dist/llms-full.txt missing');
  const txt = H.readDist('llms-full.txt').replace(/\r\n/g, '\n');
  for (const e of pub) {
    assert.ok(txt.includes(e.title), `llms-full.txt: missing title of ${e.url}`);
    const body = e.body.replace(/\r\n/g, '\n').trim();
    if (body) assert.ok(txt.includes(body), `llms-full.txt: body of ${e.url} is not present verbatim`);
  }
  for (const d of dr) {
    if (d.title) assert.ok(!txt.includes(d.title), `llms-full.txt contains draft title "${d.title}"`);
    const body = d.body.replace(/\r\n/g, '\n').trim();
    if (body.length > 40) assert.ok(!txt.includes(body.slice(0, 200)), `llms-full.txt contains draft body from ${path.basename(d.file)}`);
  }
});

// ---------------- supporting (B6 / B8 / B9 / B10) ----------------
test('B6 (supporting) alternates: every entry page links its .md and .json twins and the site feeds via <link rel="alternate">; index pages link the site feeds', () => {
  for (const e of pub) {
    const alts = H.alternateHrefs(H.readDist(`${e.lane}/${e.slug}/index.html`)).map(H.pathnameOf);
    for (const want of [`/${e.lane}/${e.slug}.md`, `/${e.lane}/${e.slug}.json`, '/rss.xml', '/feed.json']) assert.ok(alts.includes(want), `${e.url}: missing <link rel="alternate" href="${want}">`);
  }
  for (const rel of ['index.html', ...H.LANES.map((l) => `${l}/index.html`)]) {
    const alts = H.alternateHrefs(H.readDist(rel)).map(H.pathnameOf);
    for (const want of ['/rss.xml', '/feed.json']) assert.ok(alts.includes(want), `dist/${rel}: missing <link rel="alternate" href="${want}">`);
  }
});

test('B6 (supporting) robots.txt allows all crawlers; sitemap-index.xml exists and lists no draft', () => {
  assert.ok(H.distExists('robots.txt'), 'dist/robots.txt missing');
  const robots = H.readDist('robots.txt');
  assert.match(robots, /^User-agent:\s*\*/mi, 'robots.txt needs a User-agent: * block');
  assert.ok(!/^Disallow:\s*\/\s*$/mi.test(robots), 'robots.txt must not Disallow: /');
  assert.ok(H.distExists('sitemap-index.xml'), 'dist/sitemap-index.xml missing');
  const maps = H.distFiles().filter((r) => /^sitemap.*\.xml$/.test(r)).map((r) => H.readDist(r)).join('\n');
  for (const d of dr) assert.ok(!maps.includes(d.url), `sitemap lists draft ${d.url}`);
  assert.ok(maps.includes(`${H.SITE}/${COMPOSABLE.lane}/${COMPOSABLE.slug}/`), 'sitemap must list the canonical composable URL');
});

test('B10 (supporting) custom 404 page exists and an unknown URL returns 404', async () => {
  assert.ok(H.distExists('404.html'), 'dist/404.html missing');
  const r = await H.get('/this-page-does-not-exist-gate-probe/');
  assert.equal(r.status, 404);
});

test('B10 (supporting) per-entry OG image is a 1200x630 PNG and referenced from the entry page', () => {
  for (const e of pub) {
    const rel = `og/${e.lane}/${e.slug}.png`;
    assert.ok(H.distExists(rel), `dist/${rel} missing`);
    const size = H.pngSize(H.readDistBuf(rel));
    assert.deepEqual(size, { width: 1200, height: 630 }, `dist/${rel} must be a 1200x630 PNG`);
    const og = H.metaContent(H.readDist(`${e.lane}/${e.slug}/index.html`), 'og:image');
    assert.equal(H.pathnameOf(og), `/${rel}`, `${e.url}: og:image must point at /${rel}`);
  }
});

test('B9 (supporting, S13) theme bootstrap: an inline <script> precedes every stylesheet/<style> in <head> on every page type', () => {
  for (const rel of ['index.html', 'writing/index.html', `${COMPOSABLE.lane}/${COMPOSABLE.slug}/index.html`, 'about.html', 'about/index.html'].filter(H.distExists)) {
    const head = H.headOf(H.readDist(rel));
    const firstScript = head.search(/<script\b(?![^>]*\bsrc=)[^>]*>/i);
    const firstStyle = head.search(/<style\b|<link\b[^>]*rel=["']?stylesheet/i);
    assert.ok(firstScript >= 0, `dist/${rel}: no inline <script> in <head> to set the theme before paint`);
    if (firstStyle >= 0) assert.ok(firstScript < firstStyle, `dist/${rel}: inline theme script must come before the first stylesheet/<style> (script@${firstScript}, style@${firstStyle})`);
    assert.match(head.slice(firstScript, firstStyle > firstScript ? firstStyle : undefined), /data-theme|prefers-color-scheme/i, `dist/${rel}: the first inline head script does not look like a theme bootstrap`);
  }
});
