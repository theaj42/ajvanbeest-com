/**
 * Redirect table — SPEC B8, INTERFACES §2/§7.
 *
 * Sources, in order:
 *   1. every non-draft entry's `aliases[]` → its canonical `url`
 *   2. `legacy-urls.txt` at the repo root (evaluator-owned) when it exists:
 *      one redirect per line, `from<TAB>to`; blank lines and `#` comments ignored.
 *      A line with only a `from` column asserts "this old URL must still land
 *      somewhere" and the destination must come from an alias — if none does,
 *      the build fails (B8: "fails if any old URL … has no destination").
 *   3. only when that file is absent: a hard-coded fallback for the old Quartz
 *      `/about/*` pages, which no entry can claim via `aliases`.
 *
 * Output is deduplicated, `from` is normalised without a trailing slash, and
 * a `from` that is also a real page is dropped (with a warning) so a redirect
 * can never shadow content. Destination *existence* is verified after the
 * build by `scripts/check-links.mjs`, which follows the visible link every
 * redirect page carries.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LANES, getAllTags, getEntries } from './content';

export interface Redirect {
  /** Site-relative old path, no trailing slash, e.g. `/posts/2026-01-01_Composable-security-investigations` */
  from: string;
  /** Destination: site-relative canonical URL (trailing slash) or an absolute URL */
  to: string;
}

const LEGACY_FILE = 'legacy-urls.txt';

/** Old Quartz about-pages, all collapsed into `/about/` (SPEC B2). Used only when legacy-urls.txt is absent. */
const FALLBACK_LEGACY: Redirect[] = [
  { from: '/about/aj', to: '/about/' },
  { from: '/about/claude', to: '/about/' },
  { from: '/about/ai-collaboration', to: '/about/' },
  { from: '/about/our-process', to: '/about/' },
];

/** Paths whose redirect is emitted by another packet as a real file (P3 owns `/index.xml`). */
const HANDLED_ELSEWHERE = new Set(['/index.xml']);

const MATURITIES = ['seedling', 'growing', 'evergreen'];

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** `/Foo/bar/` → `/Foo/bar` (case preserved); `/` stays `/`. */
export function normalizeFrom(p: string): string {
  let s = p.trim().split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

/** Site-relative directory paths get a trailing slash; file-like paths and absolute URLs pass through. */
export function normalizeTo(p: string): string {
  const s = p.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s; // absolute URL
  let out = s.startsWith('/') ? s : `/${s}`;
  out = out.replace(/\/{2,}/g, '/');
  const last = out.split('/').pop() ?? '';
  const fileLike = last.includes('.');
  if (!fileLike && !out.endsWith('/')) out += '/';
  return out;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

interface LegacyRow {
  from: string;
  to?: string;
  line: number;
}

/** Parse legacy-urls.txt; `undefined` when the file does not exist. Throws on a malformed row. */
function readLegacyFile(): LegacyRow[] | undefined {
  const file = path.resolve(process.cwd(), LEGACY_FILE);
  if (!fs.existsSync(file)) return undefined;
  const rows: LegacyRow[] = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, '').trim(); // trailing comments
    if (!line || line.startsWith('#')) return;
    // Contract is tab-separated; paths never contain whitespace, so any run of
    // whitespace is accepted as the separator without ambiguity.
    const cols = line.split(/\s+/);
    if (cols.length > 2) {
      throw new Error(`${LEGACY_FILE}:${i + 1}: expected "<from>\t<to>" (at most two columns), got: ${raw}`);
    }
    const [from, to] = cols;
    if (!from.startsWith('/')) {
      throw new Error(`${LEGACY_FILE}:${i + 1}: "from" must be a site-relative path starting with "/", got: ${from}`);
    }
    rows.push({ from: normalizeFrom(from), to: to ? normalizeTo(to) : undefined, line: i + 1 });
  });
  return rows;
}

/** Every path that is (or will be, once all packets merge) a real page. Compared without trailing slash. */
async function realPages(): Promise<Set<string>> {
  const pages = new Set<string>(['/', '/about', '/tags', '/404']);
  for (const lane of LANES) {
    pages.add(`/${lane}`);
    for (const m of MATURITIES) pages.add(`/${lane}/maturity/${m}`);
  }
  for (const e of await getEntries()) pages.add(normalizeFrom(e.url));
  for (const { tag } of await getAllTags()) pages.add(`/tags/${tag}`);
  return pages;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cache: Promise<Redirect[]> | undefined;

export async function getRedirects(): Promise<Redirect[]> {
  if (!import.meta.env.PROD) return build();
  cache ??= build();
  return cache;
}

async function build(): Promise<Redirect[]> {
  const table = new Map<string, { to: string; source: string }>();
  const conflicts: string[] = [];

  const add = (from: string, to: string, source: string) => {
    const existing = table.get(from);
    if (!existing) {
      table.set(from, { to, source });
    } else if (existing.to !== to) {
      conflicts.push(`${from} → ${existing.to} (${existing.source}) vs → ${to} (${source})`);
    }
  };

  // 1. aliases
  for (const e of await getEntries()) {
    for (const alias of e.aliases) add(normalizeFrom(alias), normalizeTo(e.url), `${e.lane}/${e.slug} aliases`);
  }

  // 2. legacy-urls.txt, else 3. fallback
  const legacy = readLegacyFile();
  if (legacy) {
    const missing: string[] = [];
    for (const row of legacy) {
      if (row.to) add(row.from, row.to, `${LEGACY_FILE}:${row.line}`);
      else if (!table.has(row.from)) missing.push(`${LEGACY_FILE}:${row.line}: ${row.from}`);
    }
    if (missing.length) {
      throw new Error(
        `redirects: ${missing.length} legacy URL(s) have no destination — add a "to" column or an alias on the target entry:\n  ${missing.join('\n  ')}`,
      );
    }
  } else {
    for (const r of FALLBACK_LEGACY) add(normalizeFrom(r.from), normalizeTo(r.to), 'built-in fallback');
  }

  if (conflicts.length) {
    throw new Error(`redirects: conflicting destinations for the same old URL:\n  ${conflicts.join('\n  ')}`);
  }

  // Never shadow a real page or another packet's output.
  const pages = await realPages();
  const out: Redirect[] = [];
  for (const [from, { to, source }] of table) {
    if (from === '/' || HANDLED_ELSEWHERE.has(from)) continue;
    if (pages.has(from)) {
      console.warn(`redirects: skipping ${from} → ${to} (${source}) — it is a real page`);
      continue;
    }
    if (normalizeFrom(to) === from) {
      console.warn(`redirects: skipping ${from} → ${to} (${source}) — redirects to itself`);
      continue;
    }
    out.push({ from, to });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from, 'en-US'));
}
