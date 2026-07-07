import { z } from "zod";

/** One step in a scenarios/*.yaml file. Exactly one key per step. */
export const StepSchema = z
  .object({
    observe: z.string().optional(),
    act: z.string().optional(),
    assert_url_matches: z.string().optional(),
  })
  .refine(
    (s) => [s.observe, s.act, s.assert_url_matches].filter(Boolean).length === 1,
    { message: "each step must have exactly one of observe/act/assert_url_matches" },
  );

export const ScenarioSchema = z.object({
  name: z.string(),
  story: z.string().optional(),
  url: z.string(),
  steps: z.array(StepSchema),
  ux_review: z.array(z.string()).default([]),
  accessibility: z
    .object({
      rules: z.array(z.string()).default(["wcag2a", "wcag2aa"]),
      fail_on: z.array(z.string()).default(["serious", "critical"]),
    })
    .optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

/** Claude's verdict on one observe/ux_review assertion. */
export const VerdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  reason: z.string(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export interface CheckResult {
  kind: "observe" | "act" | "url" | "ux_review" | "accessibility";
  description: string;
  status: "pass" | "fail" | "skipped";
  detail?: string;
  screenshot?: string;
}

export interface ScenarioResult {
  scenario: string;
  story?: string;
  url: string;
  ok: boolean;
  checks: CheckResult[];
}
