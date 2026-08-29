/** `/og/<lane>/<slug>.png` — one card per non-draft entry (SPEC B10). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntries, type Entry } from '../../../lib/content';
import { ogSpecForEntry, pngResponse, renderOg } from '../../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getEntries();
  return entries.map((entry) => ({ params: { lane: entry.lane, slug: entry.slug }, props: { entry } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as { entry: Entry };
  return pngResponse(await renderOg(ogSpecForEntry(entry)));
};
