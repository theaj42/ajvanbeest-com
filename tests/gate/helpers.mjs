// Shared helpers for the acceptance gate. Pure node (no browser deps) so the static suite can
// run without Playwright. Reads product output from DIST and product *source* from SRC_CONTENT;
// never writes to either.
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, DIST, SRC_CONTENT } from './adapter.mjs';

export { BASE_URL };
export const SITE = 'https://ajvanbeest.com';
export const LANES = ['writing', 'projects', 'notes', 'playbooks'];
export const LANE_LABEL = { writing: 'Writing', projects: 'Projects', notes: 'Notes', playbooks: 'Playbooks' };
export const MATURITIES = ['seedling', 'growing', 'evergreen'];
export const STATUS_LABEL = {
  live: /\blive\b/i,
  'in-progress': /in[\s-]?progress|\bwip\b/i,
  private: /\bprivate\b/i,
  archived: /\barchived\b/i,
};
// gate.sh runs from the repo root; mutation tests copy REPO_ROOT.
export const REPO_ROOT = process.cwd();
export const DIST_DIR = path.resolve(REPO_ROOT, DIST);
export const CONTENT_DIR = path.resolve(REPO_ROOT, SRC_CONTENT);
export const LEGACY_FILE = path.join(REPO_ROOT, 'legacy-urls.txt');

// INTERFACES §4 — hard expectations that hold regardless of what else is in src/content.
export const HARD_EXPECTED = [
  { lane: 'writing', slug: 'composable-security-investigation', maturity: 'evergreen', alias: '/posts/2026-01-01_Composable-security-investigations' },
  { lane: 'writing', slug: 'building-my-daemon', maturity: 'evergreen', alias: '/posts/2025-12-01_Building-my-daemon' },
  { lane: 'writing', slug: 'updating-my-telos-with-ai', maturity: 'growing', alias: '/posts/2025-12-01_Updating-my-telos-with-ai' },
  { lane: 'writing', slug: 'morning-pages-analysis', maturity: 'growing', alias: '/posts/2025-06-29_Morning-pages-analysis' },
  { lane: 'writing', slug: 'hello-world', maturity: 'seedling', alias: '/posts/hello-world' },
  { lane: 'playbooks', slug: 'geoip-lookup', maturity: 'evergreen', alias: '/posts/2026-01-01_Playbook-geoip-lookup' },
  { lane: 'projects', slug: 'assay', status: 'live', featured: 1 },
  { lane: 'projects', slug: 'armature', status: 'private', featured: 2 },
  { lane: 'projects', slug: 'loot-goblin', status: 'in-progress', featured: 3 },
];

// ---------- filesystem ----------
export function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...walk(p));
    else if (d.isFile()) out.push(p);
  }
  return out.sort();
}
export function distPath(rel) { return path.join(DIST_DIR, rel); }
export function distExists(rel) { return fs.existsSync(distPath(rel)); }
export function readDist(rel) { return fs.readFileSync(distPath(rel), 'utf8'); }
export function readDistBuf(rel) { return fs.readFileSync(distPath(rel)); }
export function distFiles(dir = DIST_DIR) { return walk(dir).map((p) => path.relative(dir, p)).sort(); }
const TEXT_EXT = new Set(['.html', '.xml', '.json', '.txt', '.md']);
// Text outputs that could leak content. dist/pagefind is compressed and covered by the search test.
export function distTextFiles() {
  return distFiles().filter((r) => TEXT_EXT.has(path.extname(r)) && !r.split(path.sep).includes('pagefind'));
}
// Redirect page for a legacy path may be dist/<path>/index.html (directory) or dist/<path> (file).
export function readRedirectPage(from) {
  const p = from.replace(/^\//, '');
  for (const cand of [`${p}/index.html`, p, `${p}.html`]) {
    const abs = distPath(cand);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return fs.readFileSync(abs, 'utf8');
  }
  return null;
}
export function readLegacy(file = LEGACY_FILE) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const [from, to] = l.split('\t'); return { from, to }; });
}

// ---------- frontmatter (YAML subset: enough for INTERFACES §3) ----------
function scalar(v) {
  v = v.trim();
  if (v === '') return '';
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) return v.slice(1, -1).replace(/''/g, "'");
  v = v.replace(/\s+#.*$/, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}
function inlineArray(v) {
  const inner = v.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return [];
  const out = []; let cur = ''; let q = null;
  for (const ch of inner) {
    if (q) { cur += ch; if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ',') { out.push(scalar(cur)); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(scalar(cur));
  return out;
}
export function parseYamlSubset(src) {
  const data = {}; const lines = src.split(/\r?\n/); let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const km = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (!km) { i++; continue; }
    const key = km[1]; const rest = km[2].trim();
    if (rest === '') {
      const items = []; i++;
      while (i < lines.length && /^\s+-\s*/.test(lines[i])) { items.push(scalar(lines[i].replace(/^\s+-\s*/, ''))); i++; }
      data[key] = items; continue;
    }
    if (rest.startsWith('[')) { data[key] = inlineArray(rest); i++; continue; }
    if (rest === '|' || rest === '>') {
      const buf = []; i++;
      while (i < lines.length && /^\s+\S/.test(lines[i])) { buf.push(lines[i].trim()); i++; }
      data[key] = buf.join(rest === '|' ? '\n' : ' '); continue;
    }
    data[key] = scalar(rest); i++;
  }
  return data;
}
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text, raw: '' };
  return { data: parseYamlSubset(m[1]), body: m[2], raw: m[1] };
}

// ---------- content model ----------
export function loadContent(contentDir = CONTENT_DIR) {
  const entries = [];
  for (const lane of LANES) {
    const dir = path.join(contentDir, lane);
    for (const file of walk(dir).filter((p) => p.endsWith('.md'))) {
      const text = fs.readFileSync(file, 'utf8');
      const { data, body } = parseFrontmatter(text);
      const id = path.relative(dir, file).replace(/\.md$/, '').split(path.sep).join('/');
      const slug = typeof data.slug === 'string' && data.slug ? data.slug : id;
      entries.push({
        lane, file, id, slug, url: `/${lane}/${slug}/`,
        title: String(data.title ?? ''), data, body,
        draft: data.draft === true,
        maturity: typeof data.maturity === 'string' && data.maturity ? data.maturity : 'seedling',
        date: new Date(String(data.date ?? '')),
        featured: data.featured, status: data.status,
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
      });
    }
  }
  return entries;
}
export const published = (es) => es.filter((e) => !e.draft);
export const drafts = (es) => es.filter((e) => e.draft);
export const byDateDesc = (a, b) => (b.date - a.date) || a.slug.localeCompare(b.slug);
export function expectedFeatured(es) {
  return published(es).filter((e) => e.lane === 'projects' && Number.isInteger(e.featured))
    .sort((a, b) => a.featured - b.featured).slice(0, 3);
}
export function expectedSelectedWriting(es) {
  const w = published(es).filter((e) => e.lane === 'writing');
  const ever = w.filter((e) => e.maturity === 'evergreen').sort(byDateDesc).slice(0, 3);
  if (ever.length >= 3) return ever;
  const grow = w.filter((e) => e.maturity === 'growing').sort(byDateDesc);
  return ever.concat(grow.slice(0, 3 - ever.length));
}
export function expectedGarden(es, n = 4) {
  return published(es).filter((e) => e.lane === 'notes').sort(byDateDesc).slice(0, n);
}
// Ordered comparison that tolerates ties: at position i the actual slug must be expected[i] or
// another pool entry with the same date and maturity (the builder's tiebreak is unspecified).
export function sameOrderModuloTies(actualSlugs, expected, pool) {
  if (actualSlugs.length !== expected.length) return `expected ${expected.length} items [${expected.map((e) => e.slug)}], got ${actualSlugs.length} [${actualSlugs}]`;
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i]; const act = actualSlugs[i];
    if (act === exp.slug) continue;
    const alt = pool.find((e) => e.slug === act);
    if (alt && alt.maturity === exp.maturity && fmtISO(alt.date) === fmtISO(exp.date)) continue;
    return `position ${i}: expected ${exp.slug}, got ${act} (full actual order: [${actualSlugs}])`;
  }
  return null;
}
export const fmtISO = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : String(d));
export function isNonIncreasing(nums) { for (let i = 1; i < nums.length; i++) if (nums[i] > nums[i - 1]) return false; return true; }

// ---------- HTTP ----------
export async function get(p) {
  const res = await fetch(BASE_URL + p, { redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, url: res.url, buf, text: buf.toString('utf8'), headers: res.headers };
}

// ---------- HTML (regex-level; good enough for static output) ----------
export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function textVariants(s) {
  const e = escapeHtml(s);
  return [...new Set([s, e, e.replace(/&#39;/g, '&#x27;'), e.replace(/&#39;/g, '&apos;'), e.replace(/&#39;/g, "'").replace(/&quot;/g, '"'), s.replace(/&/g, '&amp;')])];
}
export function containsText(hay, s) { return textVariants(s).some((v) => hay.includes(v)); }
export function tagsOf(html, tag) { return html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || []; }
export function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}
export function blocks(html, tag) {
  const out = []; const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'); let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}
export function hrefs(html) { return tagsOf(html, 'a').map((t) => attr(t, 'href')).filter((h) => h !== null); }
export function pathnameOf(href) {
  if (!href || href.startsWith('#')) return null;
  try {
    const u = new URL(href, SITE);
    if (u.origin !== new URL(SITE).origin && u.origin !== new URL(BASE_URL).origin) return null;
    return u.pathname;
  } catch { return null; }
}
export function entryLinks(html, lane) {
  const re = new RegExp(`^/${lane}/([^/]+)/$`); const out = [];
  for (const h of hrefs(html)) { const p = pathnameOf(h); const m = p && re.exec(p); if (m && !out.includes(m[1])) out.push(m[1]); }
  return out;
}
export function metaRefreshTarget(html) {
  for (const t of tagsOf(html, 'meta')) {
    const he = attr(t, 'http-equiv'); if (!he || he.toLowerCase() !== 'refresh') continue;
    const m = /^\s*\d+\s*;\s*url\s*=\s*['"]?([^'"\s]+)/i.exec(attr(t, 'content') || '');
    if (m) return m[1];
  }
  return null;
}
export function linkTags(html) {
  return tagsOf(html, 'link').map((t) => ({ rel: (attr(t, 'rel') || '').toLowerCase().split(/\s+/), href: attr(t, 'href'), type: attr(t, 'type'), title: attr(t, 'title') }));
}
export function canonicalHref(html) { return (linkTags(html).find((l) => l.rel.includes('canonical')) || {}).href ?? null; }
export function alternateHrefs(html) { return linkTags(html).filter((l) => l.rel.includes('alternate')).map((l) => l.href); }
export function headOf(html) { const m = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html); return m ? m[1] : ''; }
export function stripTags(s) { return s.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
export function titleOf(html) { const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html); return m ? m[1].trim() : ''; }
export function h1Of(html) { return blocks(html, 'h1').map(stripTags).join(' | '); }
export function metaContent(html, key) {
  for (const t of tagsOf(html, 'meta')) { if ((attr(t, 'property') || attr(t, 'name') || '').toLowerCase() === key) return attr(t, 'content'); }
  return null;
}

// ---------- feeds ----------
export function rssItems(xml) {
  return blocks(xml, 'item').map((it) => {
    const g = (tag) => { const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(it); return m ? m[1].trim() : null; };
    return { title: g('title'), link: g('link'), guid: g('guid'), pubDate: g('pubDate'), description: g('description') };
  });
}
export const RFC822 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} (GMT|UT|Z|[+-]\d{4})$/;
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
