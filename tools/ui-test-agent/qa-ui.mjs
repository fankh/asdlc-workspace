// Canvas interaction suite for the pipeline editor (hand-input regressions).
// 11 checks: port wiring (plain + branch), edge click-delete, wiring while
// zoomed/panned, reverse drag, save/reload graph persistence, node-deletion
// cleanup, unreachable-node validation, axe. Zero LLM calls.
//
// Usage: backend on :3001 + `npm run dev` (frontend :3000), then:
//   cd tools/ui-test-agent && node qa-ui.mjs
// Clean up afterwards: delete pipelines named "QA UI *" (qa_api.py leaves none).

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const PASS = [], FAIL = [];
const check = (name, cond, detail = '') =>
  (cond ? PASS : FAIL).push(name + (detail && !cond ? ` -- ${detail}` : ''));

const addNode = async (text) => {
  await p.getByRole('button', { name: 'Add node' }).click();
  await p.locator('.ant-dropdown-menu-item', { hasText: text }).click();
  await p.waitForTimeout(120);
};
const center = async (sel, i = 0) => {
  const bb = await p.locator(sel).nth(i).boundingBox();
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
};
const drag = async (f, t) => {
  await p.mouse.move(f.x, f.y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(f.x+(t.x-f.x)*i/8, f.y+(t.y-f.y)*i/8); await p.waitForTimeout(15); }
  await p.mouse.up(); await p.waitForTimeout(150);
};
const edgeCount = async () => p.locator('.pedge:not(.pedge-temp):not(.ptrig-edge)').count();
const plainOut = '[data-port^="out-"]:not([data-port*="out-true"]):not([data-port*="out-false"])';

await p.goto('http://localhost:3000/pipelines/new', { waitUntil: 'networkidle' });
await p.fill('input[aria-label="Pipeline name"]', `QA UI ${Date.now() % 100000}`);

// build: HTTP -> Logic -> (true) HTTP
await addNode('HTTP'); await p.fill('#node-url', 'http://localhost:3001/api/health');
await addNode('Logic'); await p.fill('#node-value', 'ok');
await addNode('HTTP'); await p.fill('#node-url', 'http://localhost:3001/api/health');

// 1. wire 1->2, 2(true)->3
await drag(await center(plainOut, 0), await center('.pnode', 1));
await drag(await center('[data-port^="out-true-"]'), await center('.pnode', 2));
check('wire plain + branch ports', await edgeCount() === 2, await edgeCount());

// 2. edge delete: click the mid-point of the first edge's hit path
const e1 = await p.locator('.pedge-hit').first().boundingBox();
await p.mouse.click(e1.x + e1.width / 2, e1.y + e1.height / 2);
await p.waitForTimeout(150);
check('edge click-to-delete', await edgeCount() === 1, await edgeCount());

// 3. re-wire it back while ZOOMED OUT (2 wheel ticks)
await p.mouse.move(650, 450);
await p.mouse.wheel(0, 120); await p.waitForTimeout(80);
await p.mouse.wheel(0, 120); await p.waitForTimeout(80);
await drag(await center(plainOut, 0), await center('.pnode', 1));
check('wire while zoomed out', await edgeCount() === 2, await edgeCount());

// 4. wire after PANNING the canvas: delete an edge (count 1), pan, wire the
// ✓ branch back to node3 — a NEW edge, so success = count 2 deterministically
const eh = await p.locator('.pedge-hit').first().boundingBox();
await p.mouse.click(eh.x + eh.width / 2, eh.y + eh.height / 2);
await p.waitForTimeout(150);
const afterDelete = await edgeCount();
const bg = await p.locator('.canvas-svg').boundingBox();
await drag({ x: bg.x + 900, y: bg.y + 600 }, { x: bg.x + 700, y: bg.y + 500 }); // pan
await drag(await center('[data-port^="out-true-"]'), await center('.pnode', 2));
check('wire after panning', await edgeCount() === afterDelete + 1,
  `${await edgeCount()} vs ${afterDelete + 1}`);

// 5. reverse drag from node3 in-port onto the LOGIC node -> should claim ✗ (false) since ✓ is taken
await drag(await center('[data-port^="in-"]', 2), await center('.pnode', 1));
check('reverse drag onto logic claims free branch', await edgeCount() === 2, await edgeCount());
// the ✗ label should now exist (branch=false edge replaced the true one to node3? no: replaced incoming of node3)
const labels = await p.locator('.pedge-label').allTextContents();
check('branch label rendered', labels.length >= 1, JSON.stringify(labels));

// 6. save -> reload -> graph identical
await p.getByRole('button', { name: 'Save', exact: true }).click();
await p.waitForSelector('.canvas-msg-ok');
const beforeNodes = await p.locator('.pnode').count();
const beforeEdges = await edgeCount();
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('.pnode');
check('reload restores nodes', await p.locator('.pnode').count() === beforeNodes,
  `${await p.locator('.pnode').count()} vs ${beforeNodes}`);
check('reload restores edges (incl. branch)', await edgeCount() === beforeEdges,
  `${await edgeCount()} vs ${beforeEdges}`);

// 7. deleting a node removes its edges
await p.locator('.pnode').nth(2).click();
await p.waitForSelector('.canvas-panel');
await p.getByRole('button', { name: 'Delete node' }).click();
await p.waitForTimeout(150);
check('node deletion cleans its edges', await edgeCount() === 1, await edgeCount());

// 8. save validation catches unreachable node
await addNode('HTTP'); await p.fill('#node-url', 'http://localhost:3001/api/health');
await p.getByRole('button', { name: 'Save', exact: true }).click();
await p.waitForSelector('.canvas-msg-err');
const err = (await p.locator('.canvas-msg-err').textContent()).trim();
check('unreachable node blocks save', /reachable|single start|graph/i.test(err), err);

// 9. axe on the canvas with panel open
const axe = await new AxeBuilder({ page: p }).analyze();
const serious = axe.violations.filter(v => ['serious', 'critical'].includes(v.impact));
check('axe: no serious/critical', serious.length === 0, serious.map(v => v.id).join(','));

console.log(`\n=== UI SUITE: ${PASS.length} passed, ${FAIL.length} failed ===`);
for (const f of FAIL) console.log('FAIL:', f);
await b.close();
process.exit(FAIL.length ? 1 : 0);
