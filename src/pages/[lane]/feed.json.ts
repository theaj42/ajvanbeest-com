/** `/<lane>/feed.json` — JSON Feed 1.1 for one lane, newest 50, non-draft. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANES, type Lane } from '../../lib/content';
import { jsonFeed } from '../../lib/endpoints';

export const getStaticPaths: GetStaticPaths = () => LANES.map((lane) => ({ params: { lane } }));

export const GET: APIRoute = async ({ params }) =>
  new Response(await jsonFeed(params.lane as Lane), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
