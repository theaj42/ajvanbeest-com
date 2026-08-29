/** `/og/index.png` — the site-wide card used by the home page and anything without its own (SPEC B10). */
import type { APIRoute } from 'astro';
import { ogSpecForSite, pngResponse, renderOg } from '../../lib/og';

export const GET: APIRoute = async () => pngResponse(await renderOg(ogSpecForSite()));
