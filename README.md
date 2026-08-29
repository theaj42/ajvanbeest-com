# ajvanbeest.com

Personal site of AJ Van Beest — writing, projects, notes, and playbooks on security automation and agentic systems. Built with [Astro](https://astro.build), deployed to GitHub Pages.

## Content model

Content is markdown with frontmatter under `src/content/<lane>/`, where lane is one of `writing`, `projects`, `notes`, `playbooks`. The schema lives in `src/content.config.ts` and is enforced at build time.

Every entry carries a **maturity**: `seedling` (rough), `growing` (revised), or `evergreen` (stands behind it). Default is `seedling`. `draft: true` keeps an entry out of the site, feeds, and search entirely.

Projects additionally have `status` (`live` / `in-progress` / `private` / `archived`), an optional `url`, and an optional `featured: 1–3` that places them on the home page in that order.

Old URLs live on as `aliases:` in frontmatter and in `legacy-urls.txt`; each produces a redirect page.

## For agents

Every page has machine-readable siblings — append `.md` (exact source) or `.json` to any entry URL. Site-wide: `/feed.json`, `/rss.xml`, `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap-index.xml`; per-lane feeds at `/<lane>/feed.json` and `/<lane>/rss.xml`. All static files.

## Working on it

```
npm ci
npm run dev       # local preview
npm run build     # astro build → link/draft/wikilink checks → pagefind index
npm run gate      # the full acceptance gate (needs Playwright Chromium + Lighthouse)
```

`npm run build` fails on schema violations, broken internal links, a draft leaking into any output, or a `[[wikilink]]` in source (link to `/<lane>/<slug>/` instead).

`scripts/gate.sh` and `tests/gate/` are the locked acceptance suite for the 2026 rebuild — `tests/gate/verify-lock.sh` checks nothing has been altered. Change them deliberately, re-lock, and say why.

Design tokens are in `src/styles/tokens.css`; light and dark palettes are Gruvbox Material. Fonts are self-hosted (Newsreader, Source Serif 4, JetBrains Mono).

## Deploy

Push to `main` builds and publishes to ajvanbeest.com via `.github/workflows/deploy.yml`. Pull requests get a build check only.
