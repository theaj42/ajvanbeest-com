/**
 * `<link rel="alternate">` sets for every page kind (INTERFACES §5). P2's
 * `Base.astro` renders the returned list verbatim. Hrefs are absolute so feed
 * readers and agents can follow them from any context.
 */
import { LANE_LABEL, type Entry, type Lane } from './content';
import { absolute, jsonPath, markdownPath } from './endpoints';

export type AlternatesPage =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'lane'; lane: Lane }
  | { kind: 'site' };

export interface Alternate {
  rel: 'alternate';
  type: string;
  href: string;
  title: string;
}

const alt = (type: string, href: string, title: string): Alternate => ({
  rel: 'alternate',
  type,
  href: absolute(href),
  title,
});

function siteFeeds(): Alternate[] {
  return [
    alt('application/rss+xml', '/rss.xml', 'AJ Van Beest — RSS (all lanes)'),
    alt('application/feed+json', '/feed.json', 'AJ Van Beest — JSON Feed (all lanes)'),
  ];
}

function laneFeeds(lane: Lane): Alternate[] {
  const label = LANE_LABEL[lane];
  return [
    alt('application/rss+xml', `/${lane}/rss.xml`, `AJ Van Beest — RSS (${label})`),
    alt('application/feed+json', `/${lane}/feed.json`, `AJ Van Beest — JSON Feed (${label})`),
  ];
}

export function getAlternates(page: AlternatesPage): Alternate[] {
  switch (page.kind) {
    case 'entry':
      return [
        alt('text/markdown', markdownPath(page.entry), 'This page as Markdown'),
        alt('application/json', jsonPath(page.entry), 'This page as JSON'),
        ...laneFeeds(page.entry.lane),
        ...siteFeeds(),
      ];
    case 'lane':
      return [...laneFeeds(page.lane), ...siteFeeds()];
    case 'site':
      return siteFeeds();
  }
}
