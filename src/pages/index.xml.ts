/**
 * `/index.xml` — where the Quartz-era RSS feed lived. Emits a redirect page to
 * `/rss.xml`. Static hosts serve `.xml` as XML regardless of the header set
 * here, so the page is well-formed XHTML: browsers render it and honour the
 * meta refresh either way, and feed readers get the visible link.
 */
import type { APIRoute } from 'astro';
import { absolute } from '../lib/endpoints';

export const GET: APIRoute = () => {
  const target = absolute('/rss.xml');
  const body = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${target}" />
    <link rel="canonical" href="${target}" />
    <link rel="alternate" type="application/rss+xml" href="${target}" title="AJ Van Beest — RSS" />
    <title>Moved to ${target}</title>
  </head>
  <body>
    <p>The feed has moved to <a href="${target}">${target}</a>.</p>
  </body>
</html>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
