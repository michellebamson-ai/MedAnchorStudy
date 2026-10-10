/**
 * Groq provider — transport only.
 *
 * Prompts, output contracts and parsing live in `prompts.ts`, shared with
 * `claude.ts` and `gemini.ts`.
 *
 * Groq exposes an OpenAI-compatible chat-completions API, so this is the
 * smallest of the three adapters. Its strength is latency: it runs open-weight
 * models on custom silicon at speeds far above the other providers, which is
 * exactly what an interactive tutor or a back-and-forth role-play needs. That
 * is why it is wired for chat rather than for anything that has to be clinically
 * accurate — the models it serves are weaker than Claude's, and open-weight
 * models are the ones most likely to be confidently wrong about mechanisms.
 *
 * Privacy: student questions and tutoring transcripts are sent to Groq. Same
 * educational-use-only rule applies as everywhere else — no real patient data.
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
import type { EnvLike, ProviderConfig } from "./claude";

const CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export function readGroqConfig(env: EnvLike = process.env): ProviderConfig | null {
  const apiKey = (env.GROQ_API_KEY ?? "").trim();
  const model = (env.GROQ_MODEL ?? "").trim();
  if (!apiKey) return null;
  if (!model) {
    console.warn(
      "[ai] GROQ_API_KEY is set but GROQ_MODEL is not. Model ids change often, so no default is " +
        "assumed. List what your key can use with GET /openai/v1/models."
    );
    return null;
  }
  return {
    apiKey,
    model,
    timeoutMs: Number(env.GROQ_TIMEOUT_MS ?? 30000) || 30000,
    maxRetries: Number(env.GROQ_MAX_RETRIES ?? 2) || 2,
  };
}

export class GroqProvider implements AIProvider {
  readonly name = "groq";
  readonly isLive = true;

  constructor(
    private readonly config: ProviderConfig,
    private readonly fallback: AIProvider | null = null
  ) {}

  // ---------------------------------------------------------------- transport

  private async ask(spec: CallSpec<unknown>): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffMs(attempt));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await fetch(CHAT_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: spec.maxTokens,
            temperature: spec.temperature,
            // Groq JSON mode: guarantees a parseable object.
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: spec.system },
              { role: "user", content: spec.prompt },
            ],
          }),
        });

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`Groq ${res.status}`);
          continue;
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Groq ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        }

        const payload = (await res.json()) as {
          choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        };
        const choice = payload.choices?.[0];
        const text = (choice?.message?.content ?? "").trim();
        if (!text) {
          throw new Error(`Groq returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"})`);
        }
        return text;
      } catch (e) {
        lastError = e;
        if (e instanceof Error && /Groq 4\d\d/.test(e.message)) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Groq request failed");
  }

  private async run<T>(spec: CallSpec<T>, fallbackFn: () => Promise<T>): Promise<T> {
    try {
      const value = parseWith(spec, await this.ask(spec as CallSpec<unknown>));
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
