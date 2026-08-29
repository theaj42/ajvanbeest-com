#!/usr/bin/env node
/**
 * Build-time gate (INTERFACES §9). Runs after `astro build`, before pagefind.
 *
 *  1. Every same-site href in dist/**\/*.html must resolve to a file in dist/:
 *     dist/<path>/index.html, dist/<path> (a file), or dist/<path>.html.
 *  2. No `draft: true` entry's title may appear in any dist html/xml/json/txt
 *     that is not a redirect page.
 *
 * Exit 1 with every offending file + href/title listed; exit 0 when clean.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'src', 'content');

// Pagefind writes into dist/pagefind/ *after* this script runs, so links into it
// cannot be verified here and are exempt.
const EXEMPT_PREFIXES = ['/pagefind/'];

if (!fs.existsSync(DIST)) {
  console.error(`check-links: ${DIST} does not exist — run \`astro build\` first`);
  process.exit(1);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(ROOT, f);

// ---------------------------------------------------------------------------
// 1. Internal links
// ---------------------------------------------------------------------------

function isSameSite(href) {
  if (!href) return false;
  if (href.startsWith('//')) return false;
  if (href.startsWith('/')) return true;
  return false;
}

function targetExists(href) {
  let p = href.split('#')[0].split('?')[0];
  if (!p) return true; // pure fragment / query on the current page
  try {
    p = decodeURIComponent(p);
  } catch {
    return false;
  }
  if (EXEMPT_PREFIXES.some((pre) => p.startsWith(pre))) return true;
  const trimmed = p.replace(/\/+$/, '');
  const base = path.join(DIST, trimmed);
  if (!base.startsWith(DIST)) return false; // path traversal, treat as broken
  const candidates = [path.join(base, 'index.html'), base, `${base}.html`];
  return candidates.some((c) => {
    try {
      return fs.statSync(c).isFile();
    } catch {
      return false;
    }
  });
}

const HREF_RE = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const broken = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const seen = new Set();
  for (const m of html.matchAll(HREF_RE)) {
    const href = (m[1] ?? m[2] ?? '').trim();
    if (!isSameSite(href) || seen.has(href)) continue;
    seen.add(href);
    if (!targetExists(href)) broken.push({ file: rel(file), href });
  }
}

// ---------------------------------------------------------------------------
// 2. Draft leak
// ---------------------------------------------------------------------------

function readDraftTitles() {
  if (!fs.existsSync(CONTENT)) return [];
  const titles = [];
  for (const f of walk(CONTENT).filter((f) => f.endsWith('.md'))) {
    const src = fs.readFileSync(f, 'utf8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const isDraft = /^draft:\s*true\s*$/m.test(fm[1]);
    if (!isDraft) continue;
    const t = fm[1].match(/^title:\s*(.+)\s*$/m);
    if (!t) continue;
    let title = t[1].trim();
    if (/^".*"$/.test(title)) title = JSON.parse(title);
    else if (/^'.*'$/.test(title)) title = title.slice(1, -1).replace(/''/g, "'");
    titles.push({ title, file: rel(f) });
  }
  return titles;
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function isRedirectPage(file, text) {
  return file.endsWith('.html') && /http-equiv\s*=\s*["']?refresh/i.test(text);
}

const drafts = readDraftTitles();
const leaks = [];
const scanFiles = files.filter(
  (f) => /\.(html|xml|json|txt)$/.test(f) && !f.startsWith(path.join(DIST, 'pagefind') + path.sep),
);
for (const file of scanFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (isRedirectPage(file, text)) continue;
  for (const { title, file: src } of drafts) {
    const variants = new Set([title, escapeHtml(title), JSON.stringify(title).slice(1, -1)]);
    if ([...variants].some((v) => text.includes(v))) {
      leaks.push({ file: rel(file), title, src });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

let failed = false;
if (broken.length) {
  failed = true;
  console.error(`check-links: ${broken.length} broken internal link(s):`);
  for (const b of broken) console.error(`  ${b.file}: ${b.href}`);
}
if (leaks.length) {
  failed = true;
  console.error(`check-links: ${leaks.length} draft leak(s):`);
  for (const l of leaks) console.error(`  ${l.file}: "${l.title}" (from ${l.src})`);
}
if (failed) process.exit(1);
console.log(
  `check-links: ${htmlFiles.length} html files, ${drafts.length} draft title(s) checked across ${scanFiles.length} outputs — OK`,
);


// ---------------------------------------------------------------------------
// Wikilinks (SPEC B2/B10: "resolve or fail the build — no silent dead links").
// Astro 7's Sätteri markdown engine renders [[wikilinks]] as literal text, so a
// wikilink in source would ship as a silent non-link. The build therefore fails on
// any [[wikilink]] outside code, naming the file and — when the target matches an
// entry's slug, file stem, or title — the markdown link to use instead.
// ---------------------------------------------------------------------------
{
  const fsW = await import('node:fs');
  const pathW = await import('node:path');
  const LANES_W = ['writing', 'projects', 'notes', 'playbooks'];
  const root = pathW.join(process.cwd(), 'src', 'content');
  const index = new Map();
  const files = [];
  for (const lane of LANES_W) {
    const dir = pathW.join(root, lane);
    if (!fsW.existsSync(dir)) continue;
    for (const f of fsW.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const stem = f.slice(0, -3);
      const src = fsW.readFileSync(pathW.join(dir, f), 'utf8');
      const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let slug = stem;
      let title = null;
      if (fm) {
        const sm = fm[1].match(/^slug:\s*["']?([^"'\n]+?)["']?\s*$/m);
        if (sm) slug = sm[1].trim();
        const tm = fm[1].match(/^title:\s*["']?(.*?)["']?\s*$/m);
        if (tm) title = tm[1].trim();
      }
      const url = `/${lane}/${slug}/`;
      index.set(slug.toLowerCase(), url);
      index.set(stem.toLowerCase(), url);
      if (title) index.set(title.toLowerCase(), url);
      files.push({ rel: pathW.join('src', 'content', lane, f), src, fm: fm ? fm[0].length : 0 });
    }
  }
  const WIKILINK = /\[\[([^\[\]|#]+?)(?:#[^\[\]|]*)?(?:\|([^\[\]]+))?\]\]/g;
  const problems = [];
  for (const { rel, src, fm } of files) {
    // Drop fenced code blocks and inline code before scanning.
    const body = src.slice(fm).replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '').replace(/`[^`\n]*`/g, '');
    let m;
    WIKILINK.lastIndex = 0;
    while ((m = WIKILINK.exec(body))) {
      const target = m[1].trim();
      const label = (m[2] || m[1]).trim();
      const url = index.get(target.toLowerCase());
      problems.push(
        url
          ? `${rel}: wikilink [[${target}]] is not rendered as a link — replace it with [${label}](${url})`
          : `${rel}: unresolved wikilink [[${target}]] — no entry has that slug or title; link to /<lane>/<slug>/ instead`,
      );
    }
  }
  if (problems.length) {
    console.error(`check-links: ${problems.length} wikilink(s) in source would ship as dead text:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`check-links: wikilinks — ${files.length} source files scanned, none outside code — OK`);
}
