/**
 * `/<lane>/<slug>.md` — the source file, byte for byte (frontmatter included).
 * Read straight from disk; never reconstructed from parsed frontmatter.
 */
import { readFile } from 'node:fs/promises';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntries, getEntry, type Lane } from '../../lib/content';

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getEntries(); // non-draft only
  return entries.map((e) => ({ params: { lane: e.lane, slug: e.slug } }));
};

export const GET: APIRoute = async ({ params }) => {
  const entry = await getEntry(params.lane as Lane, params.slug!);
  if (!entry) return new Response('Not found', { status: 404 });
  const bytes = await readFile(entry.filePath);
  return new Response(bytes, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
