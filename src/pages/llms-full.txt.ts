/** `/llms-full.txt` — the full markdown body of every non-draft entry, grouped by lane. */
import type { APIRoute } from 'astro';
import { llmsFullTxt } from '../lib/endpoints';

export const GET: APIRoute = async () =>
  new Response(await llmsFullTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
