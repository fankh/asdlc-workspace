import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "node:fs/promises";
import { VerdictSchema, type Verdict } from "./types.js";

const SYSTEM_PROMPT = `You are an AI vision test oracle for web UIs.
You receive a screenshot of a page plus ONE assertion written in natural
language. Judge strictly whether the CURRENT screenshot satisfies the
assertion.

Rules:
1. Judge only what is visible in the screenshot. If the assertion mentions
   something "above the fold", it must be visible without scrolling.
2. Small wording drift is acceptable when the assertion says "containing" or
   describes intent; exact-label assertions (quoted text) must match exactly.
3. verdict is "pass" or "fail" — when genuinely ambiguous, fail with a reason
   a developer can act on.`;

export interface VisionOracle {
  /** null verdict means vision is unavailable -> caller marks SKIPPED */
  judge(screenshotPath: string, assertion: string, pageUrl: string): Promise<Verdict | null>;
  readonly available: boolean;
  readonly label: string;
}

export function makeOracle(): VisionOracle {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const key = process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
  const hasKey = key !== "" && !key.includes("REPLACE_ME");

  // Ollama path: most local models have no vision — degrade gracefully.
  // (A local vision model integration can be added here later.)
  if (provider !== "anthropic" || !hasKey) {
    return {
      available: false,
      label: `vision disabled (provider=${provider}, key=${hasKey ? "set" : "missing"})`,
      judge: async () => null,
    };
  }

  const client = new Anthropic({ apiKey: key });
  const model = process.env.LLM_MODEL ?? "claude-sonnet-4-6";
  return {
    available: true,
    label: `anthropic:${model}`,
    async judge(screenshotPath, assertion, pageUrl) {
      const screenshot = await fs.readFile(screenshotPath, { encoding: "base64" });
      const response = await client.messages.parse({
        model,
        max_tokens: 1000,
        output_config: { format: zodOutputFormat(VerdictSchema) },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: screenshot } },
              { type: "text", text: `Page URL: ${pageUrl}\n\nAssertion:\n${assertion}` },
            ],
          },
        ],
      });
      if (!response.parsed_output) {
        throw new Error(`no parsed verdict (stop_reason=${response.stop_reason})`);
      }
      return response.parsed_output;
    },
  };
}
