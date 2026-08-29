/**
 * Shared plumbing for the agent-facing endpoints (SPEC B6, INTERFACES §7–§8):
 * markdown/JSON twins, feeds, llms.txt. Every URL that leaves the site is built
 * here so the absolute-URL rule lives in exactly one place.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { LANES, LANE_LABEL, getEntries, type Entry, type Lane } from './content';

/** Site origin from `astro.config.mjs` (`site`), exposed by Astro as `import.meta.env.SITE`. */
export const SITE: string = (import.meta.env.SITE ?? 'https://ajvanbeest.com').replace(/\/+$/, '');

export const SITE_TITLE = 'AJ Van Beest';
export const SITE_DESCRIPTION =
  'I build robots to fight cybercrime. Writing, projects, notes and playbooks on security automation and agentic systems; every page is also available as markdown (.md) and JSON (.json).';
export const FEED_LIMIT = 50;

/** Absolute URL for a site-relative path. */
export function absolute(path: string): string {
  return new URL(path, `${SITE}/`).href;
}

/** `/writing/slug/` → `/writing/slug.md` */
export function markdownPath(entry: Entry): string {
  return `/${entry.lane}/${entry.slug}.md`;
}
/** `/writing/slug/` → `/writing/slug.json` */
export function jsonPath(entry: Entry): string {
  return `/${entry.lane}/${entry.slug}.json`;
}

/** Frontmatter dates are UTC midnight; format in UTC so the day never shifts with the build machine. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Entries for a feed: all lanes or one lane, newest first, capped. */
export async function feedEntries(lane?: Lane): Promise<Entry[]> {
  return (await getEntries(lane)).slice(0, FEED_LIMIT);
}

export function feedTitle(lane?: Lane): string {
  return lane ? `${SITE_TITLE} — ${LANE_LABEL[lane]}` : SITE_TITLE;
}
export function feedDescription(lane?: Lane): string {
  return lane ? `${LANE_LABEL[lane]} from ajvanbeest.com. ${SITE_DESCRIPTION}` : SITE_DESCRIPTION;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

let containerPromise: Promise<AstroContainer> | undefined;

/**
 * Render an entry's markdown body to HTML using Astro's own pipeline (the same
 * `Content` component the HTML page renders), via the container API. One
 * container is shared across the build; creating it per call is slow.
 */
export async function renderHtml(entry: Entry): Promise<string> {
  containerPromise ??= AstroContainer.create();
  const container = await containerPromise;
  const { Content } = await entry.render();
  return (await container.renderToString(Content)).trim();
}

/**
 * Feed readers do not reliably resolve site-relative URLs, so feed HTML gets
 * `href="/…"` and `src="/…"` rewritten to absolute. The JSON twin keeps the
 * HTML exactly as the site renders it.
 */
export function absolutizeHtml(html: string): string {
  return html.replace(/\b(href|src)=("|')\/(?!\/)([^"']*)\2/g, (_m, attr, q, rest) => `${attr}=${q}${absolute('/' + rest)}${q}`);
}

// ---------------------------------------------------------------------------
// Links in a markdown body
// ---------------------------------------------------------------------------

/**
 * Every href in a markdown body, in document order, de-duplicated:
 * `[text](href)`, reference definitions `[id]: href`, autolinks `<https://…>`,
 * raw `http(s)://` URLs, and `href="…"` in inline HTML. Images are `src`, not
 * hrefs, and are skipped; so is anything inside code. Site-relative targets
 * are kept as written.
 */
export function bodyLinks(markdown: string): string[] {
  // Code is not a link, whatever it contains. Blank out fences and inline
  // spans (preserving length so match indexes stay in document order).
  const body = markdown
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, (m) => ' '.repeat(m.length))
    .replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length));
  const found: { index: number; href: string }[] = [];
  const push = (index: number, href: string) => {
    const h = href.trim();
    if (h && !h.startsWith('#')) found.push({ index, href: h });
  };

  // [text](href "title") — but not ![alt](src)
  for (const m of body.matchAll(/(!?)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    if (m[1] !== '!') push(m.index ?? 0, m[2]);
  }
  // [id]: href
  for (const m of body.matchAll(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+"[^"]*")?\s*$/gm)) push(m.index ?? 0, m[1]);
  // <https://example.com>
  for (const m of body.matchAll(/<(https?:\/\/[^\s>]+)>/g)) push(m.index ?? 0, m[1]);
  // href="…"
  for (const m of body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) push(m.index ?? 0, m[1]);
  // bare URLs (not already inside one of the forms above)
  for (const m of body.matchAll(/(?<![("'<=\/])https?:\/\/[^\s<>)"'\]]+/g)) {
    push(m.index ?? 0, m[0].replace(/[.,;:!?]+$/, ''));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const { href } of found.sort((a, b) => a.index - b.index)) {
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }
  return out;
}

// ---------------------------------------------------------------------------
// JSON twin (INTERFACES §8)
// ---------------------------------------------------------------------------

export interface JsonTwin {
  title: string;
  subtitle: string | null;
  description: string;
  lane: Lane;
  slug: string;
  url: string;
  maturity: Entry['maturity'];
  date: string;
  updated: string | null;
  tags: string[];
  wordCount: number;
  readingMinutes: number;
  markdown: string;
  html: string;
  links: string[];
  alternates: { html: string; markdown: string; json: string };
  status?: Entry['status'];
  externalUrl?: string | null;
  featured?: number | null;
}

export async function jsonTwin(entry: Entry): Promise<JsonTwin> {
  const twin: JsonTwin = {
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    description: entry.description,
    lane: entry.lane,
    slug: entry.slug,
    url: absolute(entry.url),
    maturity: entry.maturity,
    date: isoDate(entry.date),
    updated: entry.updated ? isoDate(entry.updated) : null,
    tags: entry.tags,
    wordCount: entry.wordCount,
    readingMinutes: entry.readingMinutes,
    markdown: entry.body,
    html: await renderHtml(entry),
    links: bodyLinks(entry.body),
    alternates: {
      html: absolute(entry.url),
      markdown: absolute(markdownPath(entry)),
      json: absolute(jsonPath(entry)),
    },
  };
  if (entry.lane === 'projects') {
    twin.status = entry.status;
    twin.externalUrl = entry.externalUrl ?? null;
    twin.featured = entry.featured ?? null;
  }
  return twin;
}

// ---------------------------------------------------------------------------
// JSON Feed 1.1
// ---------------------------------------------------------------------------

export async function jsonFeed(lane?: Lane): Promise<string> {
  const entries = await feedEntries(lane);
  const feedPath = lane ? `/${lane}/feed.json` : '/feed.json';
  const items = [];
  for (const e of entries) {
    items.push({
      id: absolute(e.url),
      url: absolute(e.url),
      title: e.title,
      summary: e.description,
      content_html: absolutizeHtml(await renderHtml(e)),
      date_published: e.date.toISOString(),
      ...(e.updated ? { date_modified: e.updated.toISOString() } : {}),
      tags: e.tags,
      _ajvanbeest: {
        lane: e.lane,
        maturity: e.maturity,
        markdown_url: absolute(markdownPath(e)),
        json_url: absolute(jsonPath(e)),
      },
    });
  }
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: feedTitle(lane),
    home_page_url: lane ? absolute(`/${lane}/`) : absolute('/'),
    feed_url: absolute(feedPath),
    description: feedDescription(lane),
    language: 'en-US',
    authors: [{ name: SITE_TITLE, url: absolute('/') }],
    items,
  };
  return JSON.stringify(feed, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// RSS 2.0 (item list; the XML itself comes from @astrojs/rss)
// ---------------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Namespaces declared on `<rss>`; extension elements must be namespaced to validate as RSS 2.0. */
export const RSS_XMLNS = {
  atom: 'http://www.w3.org/2005/Atom',
  ajvb: 'https://ajvanbeest.com/ns/feed',
};

/** Channel-level extras: language + the `atom:link rel="self"` the W3C validator asks for. */
export function rssChannelData(lane?: Lane): string {
  const self = absolute(lane ? `/${lane}/rss.xml` : '/rss.xml');
  return `<language>en-us</language><atom:link href="${self}" rel="self" type="application/rss+xml"/>`;
}

export async function rssItems(lane?: Lane) {
  const entries = await feedEntries(lane);
  const items = [];
  for (const e of entries) {
    items.push({
      title: e.title,
      pubDate: e.date,
      description: e.description,
      link: absolute(e.url),
      categories: e.tags,
      content: absolutizeHtml(await renderHtml(e)),
      customData:
        `<ajvb:lane>${xmlEscape(e.lane)}</ajvb:lane>` +
        `<ajvb:maturity>${xmlEscape(e.maturity)}</ajvb:maturity>` +
        `<ajvb:markdown>${xmlEscape(absolute(markdownPath(e)))}</ajvb:markdown>` +
        `<ajvb:json>${xmlEscape(absolute(jsonPath(e)))}</ajvb:json>`,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// llms.txt / llms-full.txt (INTERFACES §8)
// ---------------------------------------------------------------------------

/** Lanes in nav order with their non-draft entries (newest first); empty lanes omitted. */
export async function lanesWithEntries(): Promise<{ lane: Lane; entries: Entry[] }[]> {
  const out: { lane: Lane; entries: Entry[] }[] = [];
  for (const lane of LANES) {
    const entries = await getEntries(lane);
    if (entries.length) out.push({ lane, entries });
  }
  return out;
}

export async function llmsTxt(): Promise<string> {
  const lines = [`# ${SITE_TITLE} — ajvanbeest.com`, `> ${SITE_DESCRIPTION}`, ''];
  const byLane = new Map((await lanesWithEntries()).map((l) => [l.lane, l.entries] as const));
  for (const lane of LANES) {
    const entries = byLane.get(lane) ?? []; // spec B6: one H2 per lane, even when nothing is published yet
    lines.push(`## ${LANE_LABEL[lane]}`);
    for (const e of entries) {
      const desc = e.description ? `: ${e.description.replace(/\s+/g, ' ').trim()}` : '';
      lines.push(`- [${e.title}](${absolute(markdownPath(e))})${desc}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export async function llmsFullTxt(): Promise<string> {
  const sections: string[] = [];
  for (const { entries } of await lanesWithEntries()) {
    for (const e of entries) {
      sections.push(`# ${e.title}\nSource: ${absolute(markdownPath(e))}\n\n${e.body.trim()}`);
    }
  }
  return sections.join('\n\n---\n\n') + '\n';
}
