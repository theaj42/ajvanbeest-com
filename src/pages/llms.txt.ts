/** `/llms.txt` — site description plus every non-draft entry as a link to its .md twin, grouped by lane. */
import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/endpoints';

export const GET: APIRoute = async () =>
  new Response(await llmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
