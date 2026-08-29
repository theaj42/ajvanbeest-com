/** `/rss.xml` — RSS 2.0, all lanes, newest 50, non-draft. */
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { feedDescription, feedTitle, rssChannelData, rssItems, RSS_XMLNS, SITE } from '../lib/endpoints';

export const GET: APIRoute = async () =>
  rss({
    title: feedTitle(),
    description: feedDescription(),
    site: SITE,
    items: await rssItems(),
    xmlns: RSS_XMLNS,
    customData: rssChannelData(),
  });
