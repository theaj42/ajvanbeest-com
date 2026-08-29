/** `/robots.txt` — everyone is welcome, AI crawlers named explicitly so there is no ambiguity. */
import type { APIRoute } from 'astro';
import { absolute } from '../lib/endpoints';

const AI_AGENTS = [
  'GPTBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Bytespider',
];

export const GET: APIRoute = () => {
  const blocks = ['User-agent: *\nAllow: /', ...AI_AGENTS.map((ua) => `User-agent: ${ua}\nAllow: /`)];
  const body = `${blocks.join('\n\n')}\n\nSitemap: ${absolute('/sitemap-index.xml')}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
