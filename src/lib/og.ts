/**
 * Open Graph images — SPEC B10, INTERFACES §7 (`/og/<lane>/<slug>.png`,
 * `/og/<lane>.png`, `/og/index.png`; 1200×630 PNG).
 *
 * Pipeline: a plain-object element tree → satori (HTML/CSS subset → SVG) →
 * @resvg/resvg-js (SVG → PNG). No browser, no external service.
 *
 * Fonts: satori needs TTF/OTF/WOFF (not woff2), and the @fontsource-variable
 * packages ship woff2 only. Satori's opentype.js fork also fails to parse the
 * `fvar` table of the google/fonts variable TTFs, so two OFL-licensed *static*
 * instances from the upstream projects are vendored in `src/assets/fonts/`
 * (licences alongside): Newsreader 72pt Medium (display size, weight 500 — the
 * title weight from INTERFACES §6) and JetBrains Mono Regular. The site itself
 * never requests these files; they exist only for build-time image rendering.
 *
 * Colours are the light-theme tokens from INTERFACES §6, inlined because an
 * image cannot read CSS variables.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import satori, { type Font } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { LANE_LABEL, type Entry, type Lane, type Maturity } from './content';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const COLOR = {
  bg: '#f9f5d7',
  accent: '#af3a03',
  heading: '#3c3836',
  fg: '#4f3829',
  muted: '#7c6f64',
  seed: '#79740e',
  grow: '#b57614',
  ever: '#427b58',
} as const;

const FONT_DIR = path.resolve(process.cwd(), 'src', 'assets', 'fonts');
const NEWSREADER = 'Newsreader';
const MONO = 'JetBrains Mono';

export interface OgSpec {
  /** Big Newsreader headline; clamped to three lines. */
  title: string;
  /** Mono label line above the title, e.g. "Writing · Evergreen" or "ajvanbeest.com". */
  label: string;
  /** When set, the maturity mark is drawn before the label. */
  maturity?: Maturity;
}

// ---------------------------------------------------------------------------
// Spec builders
// ---------------------------------------------------------------------------

const MATURITY_LABEL: Record<Maturity, string> = {
  seedling: 'Seedling',
  growing: 'Growing',
  evergreen: 'Evergreen',
};

export function ogSpecForEntry(entry: Entry): OgSpec {
  return {
    title: entry.title,
    label: `${LANE_LABEL[entry.lane]} · ${MATURITY_LABEL[entry.maturity]}`,
    maturity: entry.maturity,
  };
}

/** Lane index card: the lane name is the headline, the domain is the label. */
export function ogSpecForLane(lane: Lane): OgSpec {
  return { title: LANE_LABEL[lane], label: 'ajvanbeest.com' };
}

/** Site card: the approved hero line (SPEC B3) as the headline. */
export function ogSpecForSite(): OgSpec {
  return { title: 'I build robots to fight cybercrime.', label: 'ajvanbeest.com' };
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

let fontsPromise: Promise<Font[]> | undefined;

async function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    const [newsreader, mono] = await Promise.all([
      fs.readFile(path.join(FONT_DIR, 'Newsreader72pt-Medium.ttf')),
      fs.readFile(path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf')),
    ]);
    return [
      { name: NEWSREADER, data: newsreader, weight: 500, style: 'normal' },
      { name: MONO, data: mono, weight: 400, style: 'normal' },
    ];
  })();
  return fontsPromise;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Font size that keeps titles inside three lines at 1072px of width. */
function titleSize(title: string): number {
  const n = title.length;
  if (n <= 32) return 84;
  if (n <= 56) return 70;
  if (n <= 84) return 58;
  return 48;
}

/** The maturity mark from INTERFACES §6 (12×12 viewBox), scaled for the card. */
function maturityMark(m: Maturity) {
  const size = 22;
  const children: unknown[] = [];
  if (m === 'evergreen') {
    children.push({ type: 'circle', props: { cx: 6, cy: 6, r: 5, fill: COLOR.ever } });
  } else {
    const stroke = m === 'growing' ? COLOR.grow : COLOR.seed;
    children.push({ type: 'circle', props: { cx: 6, cy: 6, r: 4.75, fill: 'none', stroke, strokeWidth: 1.5 } });
    if (m === 'growing') {
      // right half filled
      children.push({ type: 'path', props: { d: 'M6 1.25 A4.75 4.75 0 0 1 6 10.75 Z', fill: COLOR.grow } });
    }
  }
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 12 12',
      style: { marginRight: 14 },
      children,
    },
  };
}

function tree(spec: OgSpec) {
  const pad = 64;
  return {
    type: 'div',
    props: {
      style: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLOR.bg,
        color: COLOR.fg,
        fontFamily: NEWSREADER,
      },
      children: [
        // burnt-orange bar
        { type: 'div', props: { style: { width: OG_WIDTH, height: 12, backgroundColor: COLOR.accent, flexShrink: 0 } } },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              padding: `${pad - 12}px ${pad}px ${pad - 8}px`,
            },
            children: [
              // label line
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: MONO,
                    fontSize: 22,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: COLOR.muted,
                    flexShrink: 0,
                  },
                  children: [
                    ...(spec.maturity ? [maturityMark(spec.maturity)] : []),
                    { type: 'span', props: { children: spec.label } },
                  ],
                },
              },
              // title
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexGrow: 1,
                    alignItems: 'center',
                    paddingTop: 16,
                    paddingBottom: 16,
                  },
                  children: {
                    type: 'div',
                    props: {
                      style: {
                        fontFamily: NEWSREADER,
                        fontWeight: 500,
                        fontSize: titleSize(spec.title),
                        lineHeight: 1.08,
                        letterSpacing: '-0.01em',
                        color: COLOR.heading,
                        lineClamp: 3,
                      },
                      children: spec.title,
                    },
                  },
                },
              },
              // footer row
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    fontFamily: MONO,
                    fontSize: 24,
                    color: COLOR.fg,
                    flexShrink: 0,
                  },
                  children: [
                    { type: 'span', props: { children: 'AJ Van Beest' } },
                    { type: 'span', props: { style: { color: COLOR.muted, fontSize: 20 }, children: 'ajvanbeest.com' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export async function renderOgSvg(spec: OgSpec): Promise<string> {
  const fonts = await loadFonts();
  // satori's element type is React-shaped; a plain object tree satisfies it at runtime.
  return satori(tree(spec) as any, { width: OG_WIDTH, height: OG_HEIGHT, fonts });
}

/** 1200×630 PNG bytes. */
export async function renderOg(spec: OgSpec): Promise<Uint8Array> {
  const svg = await renderOgSvg(spec);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    background: COLOR.bg,
  });
  return resvg.render().asPng();
}

export function pngResponse(png: Uint8Array): Response {
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
