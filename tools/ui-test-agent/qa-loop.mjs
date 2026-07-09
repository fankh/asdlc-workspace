// 10-iteration pipeline + development-lifecycle stress suite (live server).
// Per iteration: build a branching flow on the canvas (UI), run it (odd = ✓
// agent/LLM path, even = ✗ path with the LLM node skipped), fire its webhook,
// verify history, delete via UI. Finale: interval trigger fires by itself.
// Usage: HEADED=1 node qa-loop.mjs   (visible browser; headless without)

import { chromium } from 'playwright';

const BASE = 'https://edim.seekerslab.com/agents';
const AUTH = 'Basic ' + Buffer.from('edim:edim').toString('base64');
const ITERATIONS = Number(process.env.ITERS || 10);
const DEBUG = !!process.env.DEBUG;

// API calls go through Playwright's request context (shares the browser's
// warm connection pool to the host).
const api = async (method, path, body) => {
  const t0 = Date.now();
  const res = await ctx.request.fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: AUTH },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (DEBUG) console.log(`      api ${method} ${path.slice(0, 40)} -> ${res.status()} in ${Date.now() - t0}ms`);
  return { status: res.status(), json: text ? JSON.parse(text) : {} };
};

const b = await chromium.launch(
  process.env.HEADED ? { headless: false, slowMo: 120 } : {});
const ctx = await b.newContext({
  viewport: { width: 1400, height: 900 },
  httpCredentials: { username: 'edim', password: 'edim' },
});
const p = await ctx.newPage();

const addNode = async (text) => {
  await p.getByRole('button', { name: 'Add node' }).click();
  await p.locator('.ant-dropdown-menu-item', { hasText: text }).click();
  await p.waitForTimeout(80);
};
const setAgent = async (name) => {
  await p.locator('.canvas-panel .ant-select-selector').first().click();
  await p.locator('.canvas-panel .ant-select input').fill(name);
  await p.locator(`.ant-select-item-option[title="${name}"]`).first().click();
};
const center = async (sel, i = 0) => {
  const bb = await p.locator(sel).nth(i).boundingBox();
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
};
const drag = async (f, t) => {
  await p.mouse.move(f.x, f.y); await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(f.x+(t.x-f.x)*i/6, f.y+(t.y-f.y)*i/6); await p.waitForTimeout(12); }
  await p.mouse.up(); await p.waitForTimeout(120);
};
const plainOut = '[data-port^="out-"]:not([data-port*="out-true"]):not([data-port*="out-false"])';
const HEALTH = 'http://localhost:3001/api/health';

const results = [];
let totalChecks = 0, failedChecks = 0;
const cleanupIds = [];

async function iteration(i) {
  const t0 = Date.now();
  let tPrev = t0;
  const phase = (label) => {
    if (DEBUG) console.log(`    [${i}] ${label}: ${((Date.now() - tPrev) / 1000).toFixed(1)}s`);
    tPrev = Date.now();
  };
  const name = `QA Loop ${Date.now() % 1000000}-${i}`;
  const truePath = i % 2 === 1; // odd -> condition matches -> agent/LLM path
  const notes = [];
  const expect = (label, cond, detail = '') => {
    totalChecks++;
    if (!cond) { failedChecks++; notes.push(`${label}: ${detail}`); }
  };

  // -- build on the canvas --
  try {
    await p.goto(`${BASE}/pipelines/new`, { waitUntil: 'networkidle' });
  } catch {
    await p.waitForTimeout(800); // transient auth-challenge abort — retry once
    await p.goto(`${BASE}/pipelines/new`, { waitUntil: 'networkidle' });
  }
  await p.fill('input[aria-label="Pipeline name"]', name);
  await addNode('HTTP'); await p.fill('#node-url', HEALTH);
  await addNode('Logic'); await p.fill('#node-value', truePath ? 'ok' : 'NOPE_NEVER');
  await addNode('Agent'); await setAgent('Cleanup Worker');
  await p.fill('#node-instr', `Reply with exactly: LOOP-${i}-OK`);
  await addNode('HTTP'); await p.fill('#node-url', HEALTH);
  await drag(await center('.pnode', 3), { x: 700, y: 620 }); // false branch below
  await drag(await center(plainOut, 0), await center('.pnode', 1));
  await drag(await center('[data-port^="out-true-"]'), await center('.pnode', 2));
  await drag(await center('[data-port^="out-false-"]'), await center('.pnode', 3));
  phase('build');
  const edges = await p.locator('.pedge:not(.pedge-temp):not(.ptrig-edge)').count();
  expect('wired 3 edges', edges === 3, edges);

  await p.getByRole('button', { name: 'Save', exact: true }).click();
  phase('save-click');
  await p.waitForSelector('.canvas-msg-ok, .canvas-msg-err');
  phase('save-msg');
  const saved = await p.locator('.canvas-msg-ok').count() === 1;
  // fetch the error text ONLY on failure: locator.textContent() on a missing
  // element waits the full 30s default timeout, and JS evaluates args eagerly
  const saveErr = saved ? '' : await p.locator('.canvas-msg-err').textContent().catch(() => '');
  expect('saved', saved, saveErr);
  const pipe = (await api('GET', '/api/pipelines')).json.find(x => x.name === name);
  expect('pipeline exists via API', !!pipe);
  phase('save');
  if (pipe) cleanupIds.push(pipe.id);
  if (!saved || !pipe) return { i, ok: false, ms: Date.now() - t0, notes };

  // -- run from the canvas, watch statuses --
  await p.getByRole('button', { name: 'Run', exact: true }).click();
  await p.waitForSelector('textarea[aria-label="Pipeline task"]');
  await p.fill('textarea[aria-label="Pipeline task"]', 'go');
  await p.locator('.ant-modal .ant-btn-primary', { hasText: 'Run' }).click();
  await p.waitForSelector('.canvas-runbar');
  let status = 'running';
  for (let k = 0; k < 90; k++) {
    await p.waitForTimeout(1000);
    const t = await p.locator('.canvas-runbar .ant-tag').first().textContent().catch(() => null);
    if (t && t.trim() !== 'running') { status = t.trim(); break; }
  }
  phase('canvas-run');
  expect('run succeeded', status === 'succeeded', status);
  const badges = await p.locator('.pnode-status').allTextContents();
  const succ = badges.filter(s => s === 'succeeded').length;
  const skip = badges.filter(s => s === 'skipped').length;
  expect('branch semantics', succ === 3 && skip === 1, JSON.stringify(badges));
  if (truePath) {
    const out = (await p.locator('.canvas-runbar .run-output').textContent().catch(() => '')).trim();
    expect('LLM output exact', out.includes(`LOOP-${i}-OK`), out.slice(0, 40));
  }

  // -- fire the webhook (ADLC entry point), verify provenance --
  const hook = await api('POST', pipe.webhookPath.replace('/api', '/api'), { task: 'ok webhook' });
  expect('webhook 202', hook.status === 202, hook.status);
  let wrun = hook.json;
  for (let k = 0; k < 60; k++) {
    await new Promise(r => setTimeout(r, 1000));
    wrun = (await api('GET', `/api/pipeline-runs/${wrun.id}`)).json;
    if (wrun.status !== 'running') break;
  }
  expect('webhook run terminal+tagged', wrun.status === 'succeeded' && wrun.trigger === 'webhook',
    `${wrun.status}/${wrun.trigger}`);
  phase('webhook');
  const hist = (await api('GET', `/api/pipelines/${pipe.id}/runs`)).json;
  expect('history has 2 runs', hist.length === 2, hist.length);

  // -- delete via list UI --
  await p.goto(`${BASE}/pipelines`, { waitUntil: 'networkidle' });
  const row = p.locator('tr.ant-table-row', { hasText: name });
  await row.getByRole('button', { name: 'Delete' }).click();
  await p.waitForTimeout(300);
  expect('deleted via UI', await p.locator('tr.ant-table-row', { hasText: name }).count() === 0);

  phase('delete');
  return { i, ok: notes.length === 0, path: truePath ? 'true(LLM)' : 'false(skip)', ms: Date.now() - t0, notes };
}

try {
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' }); // warm up auth once
  for (let i = 1; i <= ITERATIONS; i++) {
    const r = await iteration(i);
    results.push(r);
    console.log(`iter ${String(r.i).padStart(2)} [${r.path ?? '-'}] ${r.ok ? 'PASS' : 'FAIL'} ${(r.ms / 1000).toFixed(1)}s${r.notes.length ? ' :: ' + r.notes.join('; ') : ''}`);
  }

  // -- finale: the scheduler fires an interval trigger on its own --
  console.log('scheduler: arming a 15s interval pipeline, waiting for it to fire itself...');
  const sched = (await api('POST', '/api/pipelines', {
    name: `QA Loop sched ${Date.now() % 1000000}`,
    triggerType: 'interval', intervalSec: 15, defaultTask: 'go', enabled: true,
    steps: [
      { nodeType: 'http', config: { method: 'GET', url: HEALTH } },
      { nodeType: 'logic', config: { op: 'contains', value: 'ok' } },
    ],
    edges: [{ from: 0, to: 1 }],
  })).json;
  cleanupIds.push(sched.id);
  let fired = [];
  for (let k = 0; k < 50; k++) {
    await new Promise(r => setTimeout(r, 2000));
    const runs = (await api('GET', `/api/pipelines/${sched.id}/runs`)).json;
    fired = runs.filter(r => r.trigger === 'interval' && r.status === 'succeeded');
    if (fired.length >= 2) break;
  }
  totalChecks++;
  const schedOk = fired.length >= 2;
  if (!schedOk) failedChecks++;
  console.log(`scheduler: ${fired.length} self-fired interval run(s) ${schedOk ? 'PASS' : 'FAIL'}`);
} finally {
  for (const id of cleanupIds) await api('DELETE', `/api/pipelines/${id}`).catch(() => {});
  await b.close();
}

const passIters = results.filter(r => r.ok).length;
const avg = results.reduce((a, r) => a + r.ms, 0) / (results.length || 1) / 1000;
console.log(`\n=== LOOP SUITE: ${passIters}/${results.length} iterations clean, `
  + `${totalChecks - failedChecks}/${totalChecks} checks, avg ${avg.toFixed(1)}s/iteration ===`);
process.exit(failedChecks ? 1 : 0);
