/** `/feed.json` — JSON Feed 1.1, all lanes, newest 50, non-draft. */
import type { APIRoute } from 'astro';
import { jsonFeed } from '../lib/endpoints';

export const GET: APIRoute = async () =>
  new Response(await jsonFeed(), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
