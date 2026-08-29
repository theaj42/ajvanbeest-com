/** `/og/<lane>.png` — one card per lane index page (SPEC B10). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANES, type Lane } from '../../lib/content';
import { ogSpecForLane, pngResponse, renderOg } from '../../lib/og';

export const getStaticPaths: GetStaticPaths = () => LANES.map((lane) => ({ params: { lane } }));

export const GET: APIRoute = async ({ params }) => {
  return pngResponse(await renderOg(ogSpecForLane(params.lane as Lane)));
};
