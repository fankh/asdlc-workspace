import { AxeBuilder } from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

/** Exploratory UI prober: unlike the scenario runner (which verifies the
 * contract), this hunts for problems — console errors, failed requests,
 * every axe violation at any impact, broken internal links. */

interface UiFinding {
  kind: "console-error" | "page-error" | "failed-request" | "axe" | "broken-link";
  route: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  detail: string;
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baseUrl = arg("base-url", "http://localhost:3000");
const routes = arg("routes", "/").split(",").map((r) => r.trim()).filter(Boolean);
const outFile = path.resolve(arg("out", "audit-ui-findings.json"));

const AXE_SEVERITY: Record<string, UiFinding["severity"]> = {
  critical: "critical",
  serious: "serious",
  moderate: "moderate",
  minor: "minor",
};

async function auditRoute(page: Page, route: string): Promise<UiFinding[]> {
  const findings: UiFinding[] = [];

  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === "error") {
      findings.push({ kind: "console-error", route, severity: "serious",
        detail: msg.text().slice(0, 300) });
    }
  };
  const onPageError = (err: Error) => {
    findings.push({ kind: "page-error", route, severity: "critical",
      detail: err.message.slice(0, 300) });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      findings.push({ kind: "failed-request", route, severity: "serious",
        detail: `${resp.request().method()} ${resp.url()} -> ${resp.status()}` });
    }
  });

  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });

  // full axe sweep — all impacts, not just the contract's serious/critical
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "best-practice"])
    .analyze();
  for (const violation of axe.violations) {
    findings.push({
      kind: "axe", route,
      severity: AXE_SEVERITY[violation.impact ?? "minor"] ?? "minor",
      detail: `${violation.id}: ${violation.description} (${violation.nodes.length} node(s))`,
    });
  }

  // internal links must resolve
  const hrefs: string[] = await page.$$eval("a[href^='/']",
    (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
  for (const href of [...new Set(hrefs)].filter(Boolean)) {
    const resp = await page.request.get(new URL(href, baseUrl).toString());
    if (resp.status() >= 400) {
      findings.push({ kind: "broken-link", route, severity: "serious",
        detail: `link ${href} -> ${resp.status()}` });
    }
  }

  page.removeListener("console", onConsole);
  page.removeListener("pageerror", onPageError);
  return findings;
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const all: UiFinding[] = [];
  try {
    for (const route of routes) {
      console.log(`auditing ${route} ...`);
      const page = await context.newPage();
      try {
        all.push(...(await auditRoute(page, route)));
      } catch (err) {
        all.push({ kind: "page-error", route, severity: "critical",
          detail: `audit crashed: ${err instanceof Error ? err.message : String(err)}` });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ base_url: baseUrl, findings: all }, null, 2) + "\n");
  console.log(`${all.length} finding(s) -> ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
