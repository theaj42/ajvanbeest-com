/** `/<lane>/<slug>.json` — the JSON twin (INTERFACES §8). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntries, getEntry, type Lane } from '../../lib/content';
import { jsonTwin } from '../../lib/endpoints';

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getEntries(); // non-draft only
  return entries.map((e) => ({ params: { lane: e.lane, slug: e.slug } }));
};

export const GET: APIRoute = async ({ params }) => {
  const entry = await getEntry(params.lane as Lane, params.slug!);
  if (!entry) return new Response('Not found', { status: 404 });
  const body = JSON.stringify(await jsonTwin(entry), null, 2) + '\n';
  return new Response(body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
