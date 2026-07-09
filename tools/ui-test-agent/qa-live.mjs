// Live-deployment Playwright suite for https://edim.seekerslab.com/agents/
// (TLS + basic auth + subpath). Creates only "QA Live *" data and cleans up.
// Usage: cd tools/ui-test-agent && node qa-live.mjs

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = 'https://edim.seekerslab.com/agents';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1400, height: 900 },
  httpCredentials: { username: 'edim', password: 'edim' },
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 120)));

const PASS = [], FAIL = [];
const check = (name, cond, detail = '') =>
  (cond ? PASS : FAIL).push(name + (detail && !cond ? ` -- ${detail}` : ''));

const addNode = async (text) => {
  await p.getByRole('button', { name: 'Add node' }).click();
  await p.locator('.ant-dropdown-menu-item', { hasText: text }).click();
  await p.waitForTimeout(150);
};
const center = async (sel, i = 0) => {
  const bb = await p.locator(sel).nth(i).boundingBox();
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
};
const drag = async (f, t) => {
  await p.mouse.move(f.x, f.y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(f.x+(t.x-f.x)*i/8, f.y+(t.y-f.y)*i/8); await p.waitForTimeout(20); }
  await p.mouse.up(); await p.waitForTimeout(200);
};
const edgeCount = () => p.locator('.pedge:not(.pedge-temp):not(.ptrig-edge)').count();
const QA_NAME = `QA Live ${Date.now() % 1000000}`;

// ---- 1. routing & auth under the subpath ----
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
check('landing page title', (await p.title()).includes('Agent'), await p.title());
await p.goto(`${BASE}/agents`, { waitUntil: 'networkidle' });
await p.waitForSelector('tr.ant-table-row');
const rows = await p.locator('tr.ant-table-row').count();
check('agents table populated', rows >= 10, rows);

// status filter narrows the table (client-side)
await p.locator('.control-bar .ant-select-selector').click();
await p.locator('.ant-select-item-option[title="active"]').click();
await p.waitForTimeout(300);
const activeRows = await p.locator('tr.ant-table-row').count();
check('status filter narrows list', activeRows > 0 && activeRows < rows, `${activeRows} of ${rows}`);
await p.locator('.control-bar .ant-select-selector').click();
await p.locator('.ant-select-item-option[title="All"]').click();

// ---- 2. real agent run through the UI (CPU model) ----
const row = p.locator('tr.ant-table-row', { hasText: 'Cleanup Worker' }).first();
await row.getByRole('button', { name: 'Run' }).click();
await p.waitForSelector('textarea[aria-label="Task"]');
await p.fill('textarea[aria-label="Task"]', 'Reply with exactly: LIVE-QA-OK');
await p.getByRole('button', { name: 'Run agent' }).click();
let agentStatus = 'running';
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(2000);
  const t = await p.locator('.run-result .ant-tag').first().textContent().catch(() => null);
  if (t && t.trim() !== 'running') { agentStatus = t.trim(); break; }
}
const agentOut = (await p.locator('.run-output').first().textContent().catch(() => '')).trim();
check('agent run via UI succeeds on live LLM', agentStatus === 'succeeded', agentStatus);
check('agent output correct', agentOut.includes('LIVE-QA-OK'), agentOut.slice(0, 40));
await p.screenshot({ path: 'C:/repos/asdlc-workspace/.pipeline/live-agent-run.png' });
await p.locator('.ant-modal-footer button', { hasText: 'Close' }).click();

// ---- 3. canvas: build a branching flow, run it (zero-LLM) ----
await p.goto(`${BASE}/pipelines/new`, { waitUntil: 'networkidle' });
await p.fill('input[aria-label="Pipeline name"]', QA_NAME);
await addNode('HTTP'); await p.fill('#node-url', 'http://localhost:3001/api/health');
await addNode('Logic'); await p.fill('#node-value', 'ok');
await addNode('HTTP'); await p.fill('#node-url', 'http://localhost:3001/api/health');
await addNode('HTTP'); await p.fill('#node-url', 'http://localhost:3001/api/health');
// move node4 below for the false branch
await drag(await center('.pnode', 3), { x: 700, y: 640 });
const plainOut = '[data-port^="out-"]:not([data-port*="out-true"]):not([data-port*="out-false"])';
await drag(await center(plainOut, 0), await center('.pnode', 1));
await drag(await center('[data-port^="out-true-"]'), await center('.pnode', 2));
await drag(await center('[data-port^="out-false-"]'), await center('.pnode', 3));
check('canvas wiring on live (3 edges)', await edgeCount() === 3, await edgeCount());
await p.getByRole('button', { name: 'Save', exact: true }).click();
await p.waitForSelector('.canvas-msg-ok, .canvas-msg-err');
check('pipeline saved', await p.locator('.canvas-msg-ok').count() === 1,
  await p.locator('.canvas-msg-err').textContent().catch(() => ''));

await p.getByRole('button', { name: 'Run', exact: true }).click();
await p.waitForSelector('textarea[aria-label="Pipeline task"]');
await p.fill('textarea[aria-label="Pipeline task"]', 'go');
await p.locator('.ant-modal .ant-btn-primary', { hasText: 'Run' }).click();
await p.waitForSelector('.canvas-runbar');
let pipeStatus = 'running';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(1500);
  const t = await p.locator('.canvas-runbar .ant-tag').first().textContent().catch(() => null);
  if (t && t.trim() !== 'running') { pipeStatus = t.trim(); break; }
}
check('branch pipeline run succeeds', pipeStatus === 'succeeded', pipeStatus);
const statuses = await p.locator('.pnode-status').allTextContents();
check('true path ran, false path skipped',
  statuses.filter(s => s === 'succeeded').length === 3 && statuses.includes('skipped'),
  JSON.stringify(statuses));
await p.waitForTimeout(300);
await p.screenshot({ path: 'C:/repos/asdlc-workspace/.pipeline/live-branch-run.png' });

// ---- 4. persistence: reload restores graph ----
const beforeEdges = await edgeCount();
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('.pnode');
check('reload restores nodes', await p.locator('.pnode').count() === 4, await p.locator('.pnode').count());
check('reload restores edges', await edgeCount() === beforeEdges, `${await edgeCount()} vs ${beforeEdges}`);

// ---- 5. pipelines list shows the QA pipeline with trigger tag ----
await p.goto(`${BASE}/pipelines`, { waitUntil: 'networkidle' });
await p.waitForSelector('tr.ant-table-row');
const qaRow = p.locator('tr.ant-table-row', { hasText: QA_NAME });
check('list shows new pipeline', await qaRow.count() === 1, await qaRow.count());
check('list shows last-run succeeded', (await qaRow.textContent()).includes('succeeded'));

// ---- 6. axe on live pages ----
const axe1 = await new AxeBuilder({ page: p }).analyze();
const serious = axe1.violations.filter(v => ['serious', 'critical'].includes(v.impact));
check('axe (pipelines list): no serious/critical', serious.length === 0, serious.map(v => v.id).join(','));

// ---- cleanup: delete the QA pipeline via UI ----
await qaRow.getByRole('button', { name: 'Delete' }).click();
await p.waitForTimeout(400);
check('QA pipeline deleted', await p.locator('tr.ant-table-row', { hasText: QA_NAME }).count() === 0);

check('no page errors during the whole session', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(`\n=== LIVE SUITE: ${PASS.length} passed, ${FAIL.length} failed ===`);
for (const f of FAIL) console.log('FAIL:', f);
await b.close();
process.exit(FAIL.length ? 1 : 0);
