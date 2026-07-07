import { AxeBuilder } from "@axe-core/playwright";
import path from "node:path";
import { chromium, type Page } from "playwright";
import type { CheckResult, Scenario, ScenarioResult } from "./types.js";
import type { VisionOracle } from "./vision.js";

export interface RunOptions {
  baseUrl: string;
  outDir: string;
  oracle: VisionOracle;
  headed: boolean;
}

export async function runScenario(scenario: Scenario, opts: RunOptions): Promise<ScenarioResult> {
  const browser = await chromium.launch({ headless: !opts.headed });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const checks: CheckResult[] = [];
  let shotIndex = 0;

  const screenshot = async (): Promise<string> => {
    const file = path.join(opts.outDir, `${scenario.name}-${String(++shotIndex).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    return file;
  };

  try {
    const target = new URL(scenario.url, opts.baseUrl).toString();
    await page.goto(target, { waitUntil: "networkidle" });

    for (const step of scenario.steps) {
      if (step.observe) {
        const shot = await screenshot();
        const verdict = await opts.oracle
          .judge(shot, step.observe, page.url())
          .catch((err) => ({ verdict: "fail" as const, reason: `oracle error: ${err.message}` }));
        checks.push({
          kind: "observe",
          description: step.observe.trim(),
          status: verdict === null ? "skipped" : verdict.verdict,
          detail: verdict?.reason ?? "vision oracle unavailable",
          screenshot: path.basename(shot),
        });
      } else if (step.act) {
        checks.push(await performAct(page, step.act));
        await page.waitForLoadState("networkidle");
      } else if (step.assert_url_matches) {
        const pattern = new RegExp(step.assert_url_matches);
        const pass = pattern.test(page.url());
        checks.push({
          kind: "url",
          description: `URL matches ${step.assert_url_matches}`,
          status: pass ? "pass" : "fail",
          detail: pass ? undefined : `actual URL: ${page.url()}`,
        });
      }
    }

    for (const review of scenario.ux_review) {
      const shot = await screenshot();
      const verdict = await opts.oracle
        .judge(shot, `UX review criterion: ${review}`, page.url())
        .catch((err) => ({ verdict: "fail" as const, reason: `oracle error: ${err.message}` }));
      checks.push({
        kind: "ux_review",
        description: review,
        status: verdict === null ? "skipped" : verdict.verdict,
        detail: verdict?.reason ?? "vision oracle unavailable",
        screenshot: path.basename(shot),
      });
    }

    if (scenario.accessibility) {
      checks.push(await runAxe(page, scenario.accessibility));
    }
  } catch (err) {
    checks.push({
      kind: "act",
      description: "scenario execution",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await browser.close();
  }

  return {
    scenario: scenario.name,
    story: scenario.story,
    url: scenario.url,
    ok: checks.every((c) => c.status !== "fail"),
    checks,
  };
}

/** Deterministic act executor: quoted text -> role-based locator, no LLM. */
async function performAct(page: Page, instruction: string): Promise<CheckResult> {
  const quoted = instruction.match(/["'“”]([^"'“”]+)["'“”]/)?.[1];
  const verb = /click|press|tap/i.test(instruction) ? "click" : null;
  if (!verb || !quoted) {
    return {
      kind: "act",
      description: instruction,
      status: "fail",
      detail: 'act steps must be like: click the "Label" button (quoted label required)',
    };
  }
  const candidates = [
    page.getByRole("button", { name: quoted }),
    page.getByRole("link", { name: quoted }),
    page.getByText(quoted, { exact: true }),
  ];
  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      await locator.first().click();
      return { kind: "act", description: instruction, status: "pass" };
    }
  }
  return {
    kind: "act",
    description: instruction,
    status: "fail",
    detail: `no button/link/text matching "${quoted}"`,
  };
}

async function runAxe(
  page: Page,
  config: NonNullable<Scenario["accessibility"]>,
): Promise<CheckResult> {
  const results = await new AxeBuilder({ page }).withTags(config.rules).analyze();
  const blocking = results.violations.filter((v) =>
    config.fail_on.includes(v.impact ?? ""),
  );
  return {
    kind: "accessibility",
    description: `axe-core ${config.rules.join(",")} (fail on ${config.fail_on.join(",")})`,
    status: blocking.length === 0 ? "pass" : "fail",
    detail: blocking
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)
      .join("; ") || undefined,
  };
}
