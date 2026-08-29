// Playwright helpers. Imported only by tests that need a browser.
import { chromium } from 'playwright';
import { BASE_URL } from './helpers.mjs';

export const ORIGIN = new URL(BASE_URL).origin;
export const DARK_BG = [29, 32, 33];     // #1d2021 (INTERFACES §6 dark --bg)
export const LIGHT_BG = [249, 245, 215]; // #f9f5d7 (INTERFACES §6 light --bg)

export async function launch() { return chromium.launch({ headless: true }); }

// New context + page. Hermetic by default: every request is recorded, and requests to any
// origin other than the gate server are aborted so the suite never depends on the internet.
export async function open(browser, ctxOpts = {}, { hermetic = true } = {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, ...ctxOpts });
  const requests = [];
  if (hermetic) {
    await context.route('**/*', (route) => {
      const url = route.request().url();
      requests.push(url);
      if (new URL(url).origin === ORIGIN) return route.continue();
      return route.abort('blockedbyclient');
    });
  }
  const page = await context.newPage();
  return { context, page, requests, close: () => context.close() };
}

export function rgb(str) { const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(str || ''); return m ? [+m[1], +m[2], +m[3]] : null; }
export function luminance([r, g, b]) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

// DOM tools evaluated inside the page. Self-contained: no closures over module scope.
// Maturity-marker contract (public, generous): an element "carries" a maturity value when the
// value appears in its data-maturity / class / aria-label / title attribute, in an inner SVG
// <title>, or as its own text content (e.g. <span>Evergreen</span>).
export const TOOLS_SRC = `
const MATS = ['seedling', 'growing', 'evergreen'];
function markerValue(el) {
  if (!el.getAttribute) return null;
  const attrs = ['data-maturity', 'class', 'aria-label', 'title'].map((a) => el.getAttribute(a)).filter(Boolean).join(' ').toLowerCase();
  let hit = MATS.find((m) => attrs.includes(m));
  if (!hit && el.tagName.toLowerCase() === 'svg') { const t = el.querySelector(':scope > title'); if (t) hit = MATS.find((m) => t.textContent.toLowerCase().includes(m)); }
  if (!hit) { const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim().toLowerCase(); if (MATS.includes(own)) hit = own; }
  return hit || null;
}
function findMarkers(root) {
  const out = [];
  for (const el of root.querySelectorAll('*')) { const v = markerValue(el); if (v) out.push({ value: v, html: el.outerHTML.slice(0, 160) }); }
  return out;
}
function pathOf(href) { try { return new URL(href, location.href).pathname; } catch { return null; } }
function entryAnchors(root, urls) { return Array.from(root.querySelectorAll('a[href]')).filter((a) => urls.includes(pathOf(a.getAttribute('href')))); }
function distinctEntryUrls(el, urls) { return Array.from(new Set(entryAnchors(el, urls).map((a) => pathOf(a.getAttribute('href'))))); }
function mainOr(root) { return root || document.querySelector('main') || document.body; }
function clean(s) { return s.replace(/\\s+/g, ' ').trim(); }
// The list row for an entry: nearest ancestor of the entry link that carries a marker and no other entry.
function rowFor(url, urls, root) {
  root = mainOr(root);
  const a = entryAnchors(root, [url])[0];
  if (!a) return { error: 'no link to ' + url + ' inside ' + root.tagName.toLowerCase() };
  let el = a;
  while (el && el !== document.body) {
    const marks = findMarkers(el);
    if (marks.length) {
      const others = distinctEntryUrls(el, urls).filter((u) => u !== url);
      if (others.length) return { error: 'marker for ' + url + ' is not inside its own row (nearest marked ancestor also contains ' + others.slice(0, 3).join(', ') + ')', html: el.outerHTML.slice(0, 300) };
      return { markers: marks.map((m) => m.value), text: clean(el.textContent), html: el.outerHTML.slice(0, 400) };
    }
    el = el.parentElement;
  }
  return { error: 'no maturity marker in any ancestor of the link to ' + url, html: a.outerHTML.slice(0, 300) };
}
// Largest ancestor of the entry link that contains no other entry link (a card / result item).
function isolate(url, urls, root) {
  root = mainOr(root);
  const a = entryAnchors(root, [url])[0];
  if (!a) return { error: 'no link to ' + url };
  let el = a;
  while (el.parentElement && el.parentElement !== root && el.parentElement !== document.body && distinctEntryUrls(el.parentElement, urls).filter((u) => u !== url).length === 0) el = el.parentElement;
  return { text: clean(el.textContent), markers: findMarkers(el).map((m) => m.value), html: el.outerHTML.slice(0, 400) };
}
function listedEntryUrls(urls, root) { return distinctEntryUrls(mainOr(root), urls); }
function headingsInOrder() {
  return Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => ({ tag: h.tagName.toLowerCase(), text: clean(h.textContent), top: h.getBoundingClientRect().top + window.scrollY }));
}
const __tools = { MATS, markerValue, findMarkers, pathOf, entryAnchors, distinctEntryUrls, rowFor, isolate, listedEntryUrls, headingsInOrder, clean };
`;

export async function evalWithTools(page, fn, arg = null) {
  return page.evaluate(`((arg) => { ${TOOLS_SRC}\nreturn (${fn.toString()})(arg, __tools); })(${JSON.stringify(arg)})`);
}
