// Mutation tests: copy the repo (node_modules symlinked), change src/content, run `npm run build`
// there, assert the outcome. Scenarios S04 S05 S06(invalid maturity) S18, plus recovery R01
// (rebuild idempotence). If the harness cannot build the unmodified copy, every test here FAILS
// (never a silent skip).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as H from './helpers.mjs';

const BUILD_MS = 8 * 60 * 1000;
const T = (ms) => ({ timeout: ms });
const content = H.loadContent();
const pub = H.published(content);
let harnessError = null;
let baseline = null; // { dir, out } of an unmodified copy that built successfully

const EXCLUDE = new Set(['node_modules', 'dist', '.git', '.astro']);
function copyRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-mut-'));
  fs.cpSync(H.REPO_ROOT, tmp, { recursive: true, filter: (src) => { const rel = path.relative(H.REPO_ROOT, src); return !EXCLUDE.has(rel.split(path.sep)[0]); } });
  fs.symlinkSync(path.join(H.REPO_ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  return tmp;
}
function build(dir) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: dir, encoding: 'utf8', timeout: BUILD_MS, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' } });
  return { status: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}`, error: r.error };
}
function cleanup(dir) { if (dir) fs.rmSync(dir, { recursive: true, force: true }); }
const inCopy = (dir, e) => path.join(dir, path.relative(H.REPO_ROOT, e.file));
function setField(text, key, value) {
  const m = /^(---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(text);
  assert.ok(m, 'file has no frontmatter block');
  let fm = m[2];
  const re = new RegExp(`^${key}:.*(?:\\r?\\n(?:[ \\t]+-.*|[ \\t]+\\S.*))*$`, 'm');
  if (value === null) fm = fm.replace(re, '').replace(/\n{2,}/g, '\n');
  else if (re.test(fm)) fm = fm.replace(re, `${key}: ${value}`);
  else fm = `${fm}\n${key}: ${value}`;
  return text.slice(0, m[1].length) + fm.replace(/^\n+|\n+$/g, '') + m[3] + text.slice(m[0].length);
}
function mutate(dir, e, fn) { const p = inCopy(dir, e); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
function homeLists(dir) {
  const html = fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8');
  return { html, projects: H.entryLinks(html, 'projects'), writing: H.entryLinks(html, 'writing'), notes: H.entryLinks(html, 'notes') };
}
function requireHarness() { assert.equal(harnessError, null, `mutation harness unavailable: ${harnessError}`); }
function stem(e) { return path.basename(e.file, '.md'); }

before(async () => {
  try {
    assert.ok(fs.existsSync(path.join(H.REPO_ROOT, 'package.json')), 'no package.json at repo root');
    assert.ok(fs.existsSync(path.join(H.REPO_ROOT, 'node_modules')), 'node_modules missing (gate.sh runs npm ci first)');
    assert.ok(fs.existsSync(H.DIST_DIR), 'dist/ missing (gate.sh runs npm run build first)');
    const dir = copyRepo();
    const r = build(dir);
    if (r.status !== 0) { harnessError = `unmodified copy failed to build (exit ${r.status}${r.error ? ', ' + r.error.message : ''}):\n${r.out.slice(-3000)}`; cleanup(dir); }
    else baseline = { dir, out: r.out };
  } catch (err) { harnessError = err.message; }
}, T(BUILD_MS + 60000));

test('R01 recovery: rebuilding from a clean copy is idempotent (identical dist file list and identical markdown/JSON twins)', T(60000), () => {
  requireHarness();
  const a = H.distFiles(H.DIST_DIR);
  const b = H.distFiles(path.join(baseline.dir, 'dist'));
  const onlyA = a.filter((f) => !b.includes(f)); const onlyB = b.filter((f) => !a.includes(f));
  assert.deepEqual({ onlyInGateBuild: onlyA.slice(0, 20), onlyInRebuild: onlyB.slice(0, 20) }, { onlyInGateBuild: [], onlyInRebuild: [] }, 'dist file lists differ between two builds of the same source');
  for (const f of a.filter((x) => /\.(md|json)$/.test(x) && !x.startsWith('pagefind'))) {
    assert.ok(fs.readFileSync(H.distPath(f)).equals(fs.readFileSync(path.join(baseline.dir, 'dist', f))), `dist/${f} differs between two builds`);
  }
});

test('S04 featured projects (mutation): removing `featured` from one project removes its card and leaves the other cards, selected writing, and garden unchanged', T(BUILD_MS + 60000), () => {
  requireHarness();
  const feat = H.expectedFeatured(content);
  assert.ok(feat.length >= 2, `precondition: need >= 2 featured projects, have ${feat.length}`);
  const victim = feat[feat.length - 1];
  const before_ = homeLists(H.REPO_ROOT);
  const dir = copyRepo();
  try {
    mutate(dir, victim, (t) => setField(t, 'featured', null));
    const r = build(dir);
    assert.equal(r.status, 0, `build failed after removing featured from ${stem(victim)}:\n${r.out.slice(-2000)}`);
    const after_ = homeLists(dir);
    assert.deepEqual(after_.projects, feat.filter((e) => e !== victim).map((e) => e.slug), `home cards after removing featured from ${victim.slug}`);
    assert.deepEqual(after_.writing, before_.writing, 'selected writing must be unchanged');
    assert.deepEqual(after_.notes, before_.notes, 'garden must be unchanged');
    assert.match(H.stripTags(after_.html), /featured projects/i, 'section still shown while featured projects remain');
  } finally { cleanup(dir); }
});

test('S04 (supporting, B3) zero featured projects hides the Featured projects section rather than rendering it empty', T(BUILD_MS + 60000), () => {
  requireHarness();
  const feat = H.expectedFeatured(content);
  const dir = copyRepo();
  try {
    for (const e of feat) mutate(dir, e, (t) => setField(t, 'featured', null));
    const r = build(dir);
    assert.equal(r.status, 0, `build failed with zero featured projects:\n${r.out.slice(-2000)}`);
    const after_ = homeLists(dir);
    assert.deepEqual(after_.projects, [], 'no project cards on home');
    assert.doesNotMatch(H.stripTags(after_.html), /featured projects/i, 'Featured projects section must be hidden when nothing is featured');
  } finally { cleanup(dir); }
});

test('S05 selected writing rule (mutation): flipping the evergreen count across the 3-threshold changes the home selection exactly per the rule', T(BUILD_MS + 60000), () => {
  requireHarness();
  const w = pub.filter((e) => e.lane === 'writing');
  const ever = w.filter((e) => e.maturity === 'evergreen').sort(H.byDateDesc);
  const dir = copyRepo();
  try {
    let expectedKind;
    if (ever.length >= 3) {
      // demote everything but the two newest evergreen -> backfill branch must engage
      for (const e of ever.slice(2)) mutate(dir, e, (t) => setField(t, 'maturity', 'growing'));
      expectedKind = 'backfill';
    } else {
      // promote newest growing (then seedling) entries until 3 evergreen exist -> all-evergreen branch
      const pool = w.filter((e) => e.maturity !== 'evergreen').sort((a, b) => (a.maturity === 'growing' ? -1 : 1) - (b.maturity === 'growing' ? -1 : 1) || H.byDateDesc(a, b));
      const need = 3 - ever.length;
      assert.ok(pool.length >= need, `precondition: need ${need} more writing entries to promote, have ${pool.length}`);
      for (const e of pool.slice(0, need)) mutate(dir, e, (t) => setField(t, 'maturity', 'evergreen'));
      expectedKind = 'all-evergreen';
    }
    const r = build(dir);
    assert.equal(r.status, 0, `build failed after maturity mutation:\n${r.out.slice(-2000)}`);
    const mutated = H.loadContent(path.join(dir, 'src', 'content'));
    const exp = H.expectedSelectedWriting(mutated);
    assert.equal(exp.length, 3);
    if (expectedKind === 'all-evergreen') assert.ok(exp.every((e) => e.maturity === 'evergreen'));
    else assert.ok(exp.filter((e) => e.maturity === 'evergreen').length === 2 && exp[2].maturity === 'growing');
    const err = H.sameOrderModuloTies(homeLists(dir).writing, exp, H.published(mutated).filter((e) => e.lane === 'writing'));
    assert.equal(err, null, `after mutation (${expectedKind} branch): ${err}`);
  } finally { cleanup(dir); }
});

test('S06 maturity marker (mutation, negative): `maturity: mature` fails the build and names the file', T(BUILD_MS + 60000), () => {
  requireHarness();
  const victim = pub.find((e) => e.lane === 'writing') || pub[0];
  const dir = copyRepo();
  try {
    mutate(dir, victim, (t) => setField(t, 'maturity', 'mature'));
    const r = build(dir);
    assert.notEqual(r.status, 0, `build must fail with an invalid maturity value in ${stem(victim)}.md, but exited 0`);
    assert.ok(r.out.includes(stem(victim)), `build output must name the offending file (${stem(victim)}). Output tail:\n${r.out.slice(-1500)}`);
    assert.match(r.out, /maturity/i, `build output must mention the maturity field. Output tail:\n${r.out.slice(-1500)}`);
  } finally { cleanup(dir); }
});

test('S18 build gate (mutation, negative): a wikilink to a nonexistent page fails `npm run build` and names the offending file', T(BUILD_MS + 60000), () => {
  requireHarness();
  const victim = pub.find((e) => e.lane === 'writing') || pub[0];
  const dir = copyRepo();
  try {
    mutate(dir, victim, (t) => `${t.replace(/\s+$/, '')}\n\nGate probe: see [[this-page-does-not-exist-gate-probe]] for details.\n`);
    const r = build(dir);
    assert.notEqual(r.status, 0, `build must fail on a wikilink to a nonexistent page in ${stem(victim)}.md, but exited 0`);
    assert.ok(r.out.includes(stem(victim)), `build output must name the offending file (${stem(victim)}). Output tail:\n${r.out.slice(-1500)}`);
  } finally { cleanup(dir); }
});

test('R01 (cleanup) remove baseline copy', () => { cleanup(baseline && baseline.dir); });
