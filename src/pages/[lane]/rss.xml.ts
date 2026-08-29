/** `/<lane>/rss.xml` — RSS 2.0 for one lane, newest 50, non-draft. */
import rss from '@astrojs/rss';
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANES, type Lane } from '../../lib/content';
import { feedDescription, feedTitle, rssChannelData, rssItems, RSS_XMLNS, SITE } from '../../lib/endpoints';

export const getStaticPaths: GetStaticPaths = () => LANES.map((lane) => ({ params: { lane } }));

export const GET: APIRoute = async ({ params }) => {
  const lane = params.lane as Lane;
  return rss({
    title: feedTitle(lane),
    description: feedDescription(lane),
    site: SITE,
    items: await rssItems(lane),
    xmlns: RSS_XMLNS,
    customData: rssChannelData(lane),
  });
};
