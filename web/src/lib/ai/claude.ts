/**
 * Claude provider (Anthropic Messages API) — transport only.
 *
 * Prompts, output contracts and parsing live in `prompts.ts` so this file and
 * `gemini.ts` cannot drift apart.
 *
 * Three deliberate choices:
 *
 * 1. **Fail soft.** Any transport error, timeout, refusal or unusable reply falls
 *    back to the deterministic provider for that one call. A student mid-session
 *    should never see an error because a vendor was briefly unavailable.
 * 2. **No guessed model id.** `ANTHROPIC_MODEL` must be set explicitly. Model ids
 *    are versioned and get renamed, and a wrong default fails every call.
 * 3. **Adapted over raw.** Personalisation depth, teaching style and the
 *    "do not change established clinical facts" instruction come from the shared
 *    adaptation layer, so a real model cannot quietly become shallower than the
 *    product intends.
 *
 * Privacy: student questions and uploaded document text are sent to Anthropic.
 * Materials already tells students not to upload real patient data.
 */

import type {
  AIProvider,
  GradeRequest,
  GradeResult,
  GenerateRequest,
  GeneratedArtifact,
  RoleplayRequest,
  RoleplayTurn,
  TeachRequest,
  TeachTurn,
} from "./types";
import {
  LAST_RESORT,
  backoffMs,
  buildGenerate,
  buildGrade,
  buildRoleplay,
  buildTeach,
  parseWith,
  sleep,
  type CallSpec,
} from "./prompts";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Anything env-shaped; tests pass partial objects. */
export type EnvLike = Record<string, string | undefined>;

export interface ProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

export function readClaudeConfig(env: EnvLike = process.env): ProviderConfig | null {
  const apiKey = (env.ANTHROPIC_API_KEY ?? "").trim();
  const model = (env.ANTHROPIC_MODEL ?? "").trim();
  if (!apiKey) return null;
  if (!model) {
    console.warn(
      "[ai] ANTHROPIC_API_KEY is set but ANTHROPIC_MODEL is not. Model ids are versioned and get " +
        "renamed, so no default is assumed. Set ANTHROPIC_MODEL to the current id."
    );
    return null;
  }
  return {
    apiKey,
    model,
    timeoutMs: Number(env.ANTHROPIC_TIMEOUT_MS ?? 45000) || 45000,
    maxRetries: Number(env.ANTHROPIC_MAX_RETRIES ?? 2) || 2,
  };
}

export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  readonly isLive = true;

  constructor(
    private readonly config: ProviderConfig,
    private readonly fallback: AIProvider | null = null
  ) {}

  // ---------------------------------------------------------------- transport

  private async ask(system: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffMs(attempt));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature,
            system,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`Anthropic ${res.status}`);
          continue;
        }
        if (!res.ok) {
          // Other 4xx will not fix themselves by retrying.
          const detail = await res.text().catch(() => "");
          throw new Error(`Anthropic ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        }

        const payload = (await res.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const text = (payload.content ?? [])
          .filter((c) => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text as string)
          .join("")
          .trim();
        if (!text) throw new Error("Anthropic returned no text content");
        return text;
      } catch (e) {
        lastError = e;
        if (e instanceof Error && /Anthropic 4\d\d/.test(e.message)) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Anthropic request failed");
  }

  /** Ask, parse, coerce — and degrade to the deterministic provider on any doubt. */
  private async run<T>(
    spec: CallSpec<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    try {
      const value = parseWith(spec, await this.ask(spec.system, spec.prompt, spec.maxTokens, spec.temperature));
      if (value !== null) return value;
      console.warn(`[ai] ${this.name} reply did not match the expected shape; using the fallback.`);
    } catch (e) {
      console.warn(`[ai] ${this.name} call failed, using the fallback:`, (e as Error).message);
    }
    return fallbackFn();
  }

  // ------------------------------------------------------------------- calls

  async teach(req: TeachRequest): Promise<TeachTurn> {
    return this.run(buildTeach(req), () =>
      this.fallback ? this.fallback.teach(req) : Promise.resolve(LAST_RESORT.teach(req))
    );
  }

  async grade(req: GradeRequest): Promise<GradeResult> {
    return this.run(buildGrade(req), () =>
      this.fallback ? this.fallback.grade(req) : Promise.resolve(LAST_RESORT.grade(req))
    );
  }

  async generate(req: GenerateRequest): Promise<GeneratedArtifact> {
    return this.run(buildGenerate(req), () =>
      this.fallback ? this.fallback.generate(req) : Promise.resolve(LAST_RESORT.generate(req))
    );
  }

  async roleplay(req: RoleplayRequest): Promise<RoleplayTurn> {
    return this.run(buildRoleplay(req), () =>
      this.fallback ? this.fallback.roleplay(req) : Promise.resolve(LAST_RESORT.roleplay())
    );
  }
}