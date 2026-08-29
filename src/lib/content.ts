/**
 * Shared content helpers — INTERFACES §5. Signatures are frozen; every page,
 * feed, and agent endpoint reads content through this module rather than
 * touching `astro:content` directly, so the lane/slug/URL rules live in one place.
 */
import path from 'node:path';
import { getCollection, render as astroRender, type CollectionEntry } from 'astro:content';

export type Lane = 'writing' | 'projects' | 'notes' | 'playbooks';
/** Lanes in nav order. */
export const LANES: Lane[] = ['writing', 'projects', 'notes', 'playbooks'];
export const LANE_LABEL: Record<Lane, string> = {
  writing: 'Writing',
  projects: 'Projects',
  notes: 'Notes',
  playbooks: 'Playbooks',
};
export type Maturity = 'seedling' | 'growing' | 'evergreen';
export type ProjectStatus = 'live' | 'in-progress' | 'private' | 'archived';

/** Lane-agnostic view of a collection entry. */
export interface Entry {
  lane: Lane;
  slug: string;
  /** Canonical site-relative URL: `/${lane}/${slug}/` */
  url: string;
  title: string;
  subtitle?: string;
  /** Frontmatter `description`, else the first paragraph of the body as plain text (≤ 200 chars). */
  description: string;
  date: Date;
  updated?: Date;
  maturity: Maturity;
  tags: string[];
  draft: boolean;
  aliases: string[];
  status?: ProjectStatus;
  externalUrl?: string;
  featured?: number;
  /** Raw markdown body, frontmatter removed. */
  body: string;
  /** Absolute path of the source `.md` file. */
  filePath: string;
  wordCount: number;
  /** words / 230, rounded up, never below 1 */
  readingMinutes: number;
  render(): Promise<{ Content: any; headings: { depth: number; slug: string; text: string }[] }>;
}

type RawEntry =
  | CollectionEntry<'writing'>
  | CollectionEntry<'projects'>
  | CollectionEntry<'notes'>
  | CollectionEntry<'playbooks'>;

const WORDS_PER_MINUTE = 230;

// ---------------------------------------------------------------------------
// Plain-text helpers
// ---------------------------------------------------------------------------

/** Strip inline markdown to plain text and cap at `max` characters on a word boundary. */
function plainText(md: string, max = 200): string {
  let s = md
    .replace(/\s+/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // emphasis
    .replace(/\\([*_`])/g, '$1') // escaped markers
    .trim();
  if (s.length > max) {
    s = s.slice(0, max - 1);
    const cut = s.lastIndexOf(' ');
    s = (cut > 0 ? s.slice(0, cut) : s) + '…';
  }
  return s;
}

/** First prose paragraph of a markdown body (skips headings, lists, tables, quotes, code). */
export function firstParagraph(body: string): string {
  let inFence = false;
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t) continue;
    if (t.startsWith('```') || t.startsWith('~~~')) {
      // a block that both opens and closes a fence is self-contained
      const fences = (t.match(/^(```|~~~)/gm) ?? []).length;
      if (fences % 2 === 1) inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^(#|>|[-*+]\s|\d+\.\s|\||!\[|---|<)/.test(t)) continue;
    return plainText(t);
  }
  return '';
}

function countWords(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Entry construction
// ---------------------------------------------------------------------------

function toEntry(lane: Lane, raw: RawEntry): Entry {
  const d = raw.data;
  const slug = d.slug ?? raw.id;
  const body = raw.body ?? '';
  const wordCount = countWords(body);
  const projectData = 'status' in d ? d : undefined;
  return {
    lane,
    slug,
    url: `/${lane}/${slug}/`,
    title: d.title,
    subtitle: d.subtitle,
    description: d.description ?? firstParagraph(body),
    date: d.date,
    updated: d.updated,
    maturity: d.maturity,
    tags: d.tags,
    draft: d.draft,
    aliases: d.aliases,
    status: projectData?.status,
    externalUrl: projectData?.url,
    featured: projectData?.featured,
    body,
    // Astro exposes `filePath` relative to the project root; `astro build` runs from the root.
    filePath: raw.filePath ? path.resolve(raw.filePath) : '',
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)),
    async render() {
      const { Content, headings } = await astroRender(raw);
      return { Content, headings };
    },
  };
}

/** Newest first; ties broken by title so output is deterministic. */
function byDateDesc(a: Entry, b: Entry): number {
  return b.date.getTime() - a.date.getTime() || a.title.localeCompare(b.title, 'en-US');
}

async function loadLane(lane: Lane): Promise<Entry[]> {
  const raws = (await getCollection(lane)) as RawEntry[];
  return raws.map((r) => toEntry(lane, r));
}

// Memoized only for production builds: in `astro dev` content changes must be
// picked up, and there is no build-wide cache invalidation hook for this module.
let allCache: Promise<Entry[]> | undefined;
async function loadAll(): Promise<Entry[]> {
  const load = async () => (await Promise.all(LANES.map(loadLane))).flat();
  if (!import.meta.env.PROD) return load();
  allCache ??= load();
  return allCache;
}

// ---------------------------------------------------------------------------
// Public API (INTERFACES §5)
// ---------------------------------------------------------------------------

/** Non-draft entries, newest first. Optionally restricted to one lane. */
export async function getEntries(lane?: Lane): Promise<Entry[]> {
  const all = await loadAll();
  return all
    .filter((e) => !e.draft && (lane === undefined || e.lane === lane))
    .sort(byDateDesc);
}

/** A single non-draft entry by lane + public slug. Drafts are never returned. */
export async function getEntry(lane: Lane, slug: string): Promise<Entry | undefined> {
  const entries = await getEntries(lane);
  return entries.find((e) => e.slug === slug);
}

/** Every tag across non-draft entries with its count, alphabetical. */
export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (const e of await getEntries()) {
    for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'en-US'));
}

/** Normalize a link target to a site-relative path with a trailing slash, or null if off-site. */
function normalizeSiteLink(href: string): string | null {
  let h = href.trim();
  if (!h) return null;
  const site = 'https://ajvanbeest.com';
  if (h.startsWith(site)) h = h.slice(site.length) || '/';
  if (!h.startsWith('/') || h.startsWith('//')) return null;
  h = h.split('#')[0].split('?')[0];
  if (!h) return null;
  return h.endsWith('/') ? h : `${h}/`;
}

/** Link targets found in a markdown body: `[text](target)` and raw `href="target"`. */
export function extractLinks(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  for (const m of body.matchAll(/href\s*=\s*["']([^"']+)["']/g)) out.push(m[1]);
  return out;
}

/** Non-draft entries whose body links to `entry.url` or any of its aliases. */
export async function getBacklinks(entry: Entry): Promise<Entry[]> {
  const targets = new Set(
    [entry.url, ...entry.aliases].map(normalizeSiteLink).filter((x): x is string => x !== null),
  );
  const all = await getEntries();
  return all.filter((other) => {
    if (other.lane === entry.lane && other.slug === entry.slug) return false;
    return extractLinks(other.body).some((href) => {
      const n = normalizeSiteLink(href);
      return n !== null && targets.has(n);
    });
  });
}

/** Projects with `featured` set, ascending by that number, at most 3. */
export async function getFeatured(): Promise<Entry[]> {
  const projects = await getEntries('projects');
  return projects
    .filter((p) => typeof p.featured === 'number')
    .sort((a, b) => a.featured! - b.featured! || byDateDesc(a, b))
    .slice(0, 3);
}

/** The 3 newest evergreen writing entries; if fewer than 3 exist, backfill with the newest growing. */
export async function getSelectedWriting(): Promise<Entry[]> {
  const writing = await getEntries('writing');
  const picked = writing.filter((e) => e.maturity === 'evergreen').slice(0, 3);
  if (picked.length < 3) {
    for (const e of writing.filter((e) => e.maturity === 'growing')) {
      if (picked.length >= 3) break;
      picked.push(e);
    }
  }
  return picked;
}

/** Newest notes for the "From the garden" section. */
export async function getGardenLatest(n = 4): Promise<Entry[]> {
  const notes = await getEntries('notes');
  return notes.slice(0, n);
}

// Frontmatter dates like `2026-01-01` are parsed as UTC midnight; format in UTC
// so the calendar day never shifts with the build machine's timezone.
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Jan 1, 2026" */
export function formatDate(d: Date): string {
  return dateFormat.format(d);
}
