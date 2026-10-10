/**
 * Gemini provider (Google Generative Language API) — transport only.
 *
 * Prompts, output contracts and parsing live in `prompts.ts`, shared with
 * `claude.ts`.
 *
 * This is the free path: Google's free tier needs no credit card. It is not
 * free of consequences though — the free tier's terms state that submitted
 * content may be used to improve Google's products, which is not acceptable for
 * real student data in a health-education product. Development only; prefer
 * Claude for anything handling real users.
 *
 * Gemini can be asked for JSON directly via `responseMimeType`, which is set on
 * every call. The tolerant parsing in `prompts.ts` is still applied, because a
 * safety block or a truncated response still arrives as prose.
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

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function readGeminiConfig(env: EnvLike = process.env): ProviderConfig | null {
  const apiKey = (env.GEMINI_API_KEY ?? "").trim();
  const model = (env.GEMINI_MODEL ?? "").trim();
  if (!apiKey) return null;
  if (!model) {
    console.warn(
      "[ai] GEMINI_API_KEY is set but GEMINI_MODEL is not. Model ids are versioned and get " +
        "renamed, so no default is assumed. List what your key can use with GET /v1beta/models."
    );
    return null;
  }
  return {
    apiKey,
    model,
    timeoutMs: Number(env.GEMINI_TIMEOUT_MS ?? 45000) || 45000,
    maxRetries: Number(env.GEMINI_MAX_RETRIES ?? 2) || 2,
  };
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly isLive = true;

  constructor(
    private readonly config: ProviderConfig,
    private readonly fallback: AIProvider | null = null
  ) {}

  // ---------------------------------------------------------------- transport

  private async ask(spec: CallSpec<unknown>): Promise<string> {
    const url = `${API_BASE}/${encodeURIComponent(this.config.model)}:generateContent`;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffMs(attempt));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: spec.system }] },
            contents: [{ role: "user", parts: [{ text: spec.prompt }] }],
            generationConfig: {
              temperature: spec.temperature,
              maxOutputTokens: spec.maxTokens,
              // Ask for JSON outright; parsing stays defensive regardless.
              responseMimeType: "application/json",
            },
          }),
        });

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`Gemini ${res.status}`);
          continue;
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Gemini ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        }

        const payload = (await res.json()) as { candidates?: GeminiCandidate[] };
        const candidate = payload.candidates?.[0];
        const text = (candidate?.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (!text) {
          // A safety block or empty completion is a real outcome, not a crash.
          throw new Error(
            `Gemini returned no text (finishReason: ${candidate?.finishReason ?? "unknown"})`
          );
        }
        return text;
      } catch (e) {
        lastError = e;
        if (e instanceof Error && /Gemini 4\d\d/.test(e.message)) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
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