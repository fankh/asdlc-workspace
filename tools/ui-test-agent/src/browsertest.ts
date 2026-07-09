/**
 * Real-browser acceptance test runner for the ASDLC pipeline.
 *
 * Executes an LLM-authored test plan (JSON) against a running app with a real
 * Chromium browser and reports the actual outcome of each step. Deterministic:
 * the plan says what to do and expect; this only drives the browser and judges
 * literal outcomes (visible text, URL, element count, axe) — no per-step LLM.
 *
 * HEADED=1 opens a visible slow-motion browser (the standing "watch the test"
 * rule). A screenshot per case is captured for the report.
 *
 * Usage:
 *   npm run browsertest -- --base-url http://localhost:8088 \
 *     --plan plan.json --out results.json --shots ./shots
 *
 * Plan shape:
 *   { cases: [ { id, title, steps: [ Step, ... ] } ] }
 * Step (one key each):
 *   { goto: "/path" }
 *   { click: "Button text" }                 // by accessible name / text
 *   { fill: { selector|label: "...", value: "..." } }
 *   { expectText: "visible text" }            // present anywhere on the page
 *   { expectUrl: "/path" }                    // current path contains this
 *   { expectCount: { selector: "css", min?: n, max?: n } }
 *   { expectNoAxe: true }                     // no serious/critical violations
 */

import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "fs";
import * as path from "path";

interface Step { [k: string]: any }
interface Case { id: string; title: string; steps: Step[] }
interface StepResult { step: string; ok: boolean; detail: string }
interface CaseResult {
  id: string; title: string; ok: boolean; screenshot: string; steps: StepResult[];
}

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
const planFile = arg("plan");
const outFile = arg("out", "browsertest-results.json");
const shotsDir = arg("shots", "shots");
const headed = !!process.env.HEADED;

const label = (step: Step): string => JSON.stringify(step).slice(0, 120);

async function runStep(page: Page, step: Step): Promise<StepResult> {
  const key = Object.keys(step)[0];
  try {
    if ("goto" in step) {
      await page.goto(baseUrl + step.goto, { waitUntil: "networkidle" });
    } else if ("click" in step) {
      await page.getByText(step.click, { exact: false }).first().click({ timeout: 8000 });
    } else if ("fill" in step) {
      const f = step.fill;
      const loc = f.label
        ? page.getByLabel(f.label, { exact: false })
        : page.locator(f.selector);
      await loc.first().fill(String(f.value), { timeout: 8000 });
    } else if ("expectText" in step) {
      await page.getByText(step.expectText, { exact: false }).first()
        .waitFor({ state: "visible", timeout: 8000 });
    } else if ("expectUrl" in step) {
      await page.waitForTimeout(300);
      const u = new URL(page.url());
      if (!(u.pathname + u.hash).includes(step.expectUrl)) {
        return { step: label(step), ok: false, detail: `url is ${u.pathname + u.hash}` };
      }
    } else if ("expectCount" in step) {
      const c = step.expectCount;
      const n = await page.locator(c.selector).count();
      if (c.min != null && n < c.min) return { step: label(step), ok: false, detail: `count ${n} < min ${c.min}` };
      if (c.max != null && n > c.max) return { step: label(step), ok: false, detail: `count ${n} > max ${c.max}` };
    } else if ("expectNoAxe" in step) {
      const res = await new AxeBuilder({ page }).analyze();
      const serious = res.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      if (serious.length) return { step: label(step), ok: false, detail: `axe: ${serious.map((v) => v.id).join(", ")}` };
    } else {
      return { step: label(step), ok: false, detail: `unknown step key "${key}"` };
    }
    return { step: label(step), ok: true, detail: "" };
  } catch (e: any) {
    return { step: label(step), ok: false, detail: (e?.message ?? String(e)).slice(0, 160) };
  }
}

async function main(): Promise<void> {
  const plan = JSON.parse(fs.readFileSync(planFile, "utf-8"));
  const cases: Case[] = plan.cases ?? [];
  fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await chromium.launch(headed ? { headless: false, slowMo: 300 } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results: CaseResult[] = [];

  for (const c of cases) {
    const page = await ctx.newPage();
    const steps: StepResult[] = [];
    for (const step of c.steps) {
      const r = await runStep(page, step);
      steps.push(r);
      if (!r.ok) break; // stop the case at first failing step
    }
    const shot = path.join(shotsDir, `${c.id}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    results.push({
      id: c.id, title: c.title, ok: steps.every((s) => s.ok),
      screenshot: shot, steps,
    });
    await page.close();
  }

  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  fs.writeFileSync(outFile,
    JSON.stringify({ base_url: baseUrl, total: results.length, passed, cases: results }, null, 2) + "\n");
  console.log(`browsertest: ${passed}/${results.length} cases passed`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
