import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { runScenario } from "./runner.js";
import { ScenarioSchema } from "./types.js";
import { makeOracle } from "./vision.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, "..", "..", "..");
dotenv.config({ path: path.join(workspaceRoot, ".env") });

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const scenariosDir = path.resolve(arg("scenarios", path.join(workspaceRoot, "scenarios")));
const baseUrl = arg("base-url", process.env.BASE_URL ?? "http://localhost:3000");
const outDir = path.resolve(arg("out", path.join(workspaceRoot, "05_test_reports", "ui")));
const headed = process.argv.includes("--headed");

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(scenariosDir).filter((f) => /\.ya?ml$/.test(f));
  if (files.length === 0) {
    console.error(`no scenario yaml files in ${scenariosDir}`);
    process.exit(2);
  }

  const oracle = makeOracle();
  console.log(`ui-test-agent: ${files.length} scenario(s), base ${baseUrl}, oracle ${oracle.label}`);

  const results = [];
  for (const file of files) {
    const raw = YAML.parse(fs.readFileSync(path.join(scenariosDir, file), "utf-8"));
    const parsed = ScenarioSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`  ${file}: invalid scenario — ${parsed.error.issues[0]?.message}`);
      results.push({ scenario: file, url: "", ok: false, checks: [] });
      continue;
    }
    console.log(`  running ${parsed.data.name} ...`);
    const result = await runScenario(parsed.data, { baseUrl, outDir, oracle, headed });
    for (const check of result.checks) {
      const mark = check.status === "pass" ? "✓" : check.status === "skipped" ? "~" : "✗";
      console.log(`    ${mark} [${check.kind}] ${check.description.split("\n")[0].slice(0, 80)}`
        + (check.status === "fail" && check.detail ? ` — ${check.detail.slice(0, 120)}` : ""));
    }
    results.push(result);
  }

  const report = {
    base_url: baseUrl,
    oracle: oracle.label,
    ok: results.every((r) => r.ok),
    scenarios: results,
  };
  const reportPath = path.join(outDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`report: ${reportPath} — ${report.ok ? "PASS" : "FAIL"}`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
