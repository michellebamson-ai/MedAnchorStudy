/**
 * Claude provider (Anthropic Messages API).
 *
 * Implements the same `AIProvider` contract as `SimulatedProvider`, so no feature
 * code changes: Materials, Practice, Tutor and Research all call `getProvider()`
 * and are unaware of which one they got.
 *
 * Three deliberate choices:
 *
 * 1. **Fail soft.** Any transport error, timeout, refusal or unusable reply falls
 *    back to the deterministic provider for that one call. A student mid-session
 *    should never see an error because a vendor was briefly unavailable.
 * 2. **No guessed model id.** `ANTHROPIC_MODEL` must be set explicitly. Shipping a
 *    hardcoded default that has been renamed would fail every call at runtime.
 * 3. **Adapted over raw.** Personalisation depth, teaching style and the
 *    "do not change established clinical facts" instruction all come from the
 *    shared adaptation layer, so a real model cannot quietly become shallower than
 *    the product intends.
 *
 * Privacy note: student questions and the text of uploaded documents are sent to
 * Anthropic. Materials already tells students not to upload real patient data.
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
import { clamp01, asString, asStringArray, extractJson } from "./json";
import { kindSpec, shapeInstruction } from "./kinds";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

/** Anything env-shaped; tests pass partial objects. */
export type EnvLike = Record<string, string | undefined>;

/**
 * Reads configuration and refuses to guess. Returns null when the provider is not
 * fully configured, which is the signal to use the simulated one.
 */
export function readClaudeConfig(env: EnvLike = process.env): ClaudeConfig | null {
  const apiKey = (env.ANTHROPIC_API_KEY ?? "").trim();
  const model = (env.ANTHROPIC_MODEL ?? "").trim();
  if (!apiKey) return null;
  if (!model) {
    console.warn(
      "[ai] ANTHROPIC_API_KEY is set but ANTHROPIC_MODEL is not. Model ids are versioned and get " +
        "renamed, so no default is assumed. Falling back to the deterministic provider."
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

const SAFETY = [
  "You are part of MedAnchor Study, an educational tool for healthcare and health-sciences students.",
  "You teach and revise study material. You are not a clinician and must never give individual clinical",
  "advice, diagnosis or treatment decisions.",
  "Stay faithful to established medical facts. Never invent a fact, a citation, a statistic or a source.",
  "If the source material does not contain the answer, say so plainly instead of filling the gap.",
  "Prefer plain language over jargon, and name uncertainty when it exists.",
].join(" ");

const JSON_ONLY = "Reply with valid JSON and nothing else. No preamble, no markdown fences, no commentary.";

export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  readonly isLive = true;

  constructor(
    private readonly config: ClaudeConfig,
    /** Injected so the fallback path is testable without network access. */
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
          // 4xx other than 429 will not fix itself by retrying.
          const detail = await res.text().catch(() => "");
          throw new Error(`Anthropic ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        }

        const payload = (await res.json()) as {
          content?: Array<{ type?: string; text?: string }>;
          stop_reason?: string;
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
        // Aborts and 4xx are not worth retrying.
        if (e instanceof Error && /Anthropic 4\d\d/.test(e.message)) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Anthropic request failed");
  }

  /** Ask, parse, coerce — and degrade to the deterministic provider on any doubt. */
  private async askJson<T>(
    system: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    coerce: (raw: unknown) => T | null,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    try {
      const raw = await extractJson<unknown>(await this.ask(system, prompt, maxTokens, temperature));
      const value = coerce(raw);
      if (value !== null) return value;
      if (raw !== null) {
        console.warn(`[ai] ${this.name} reply did not match the expected shape; using the fallback.`);
      }
    } catch (e) {
      console.warn(`[ai] ${this.name} call failed, using the fallback:`, (e as Error).message);
    }
    return fallbackFn();
  }

  private degrade<T>(fallbackFn: () => Promise<T>): Promise<T> {
    return fallbackFn();
  }

  // ------------------------------------------------------------------- teach

  async teach(req: TeachRequest): Promise<TeachTurn> {
    const styleNote: Record<TeachRequest["teachingStyle"], string> = {
      gentle: "patient and encouraging, one idea at a time",
      rapid_fire: "quick, focused questions that keep moving",
      exam_pressure: "pressuring, exam-condition questioning that expects precision",
      step_by_step: "explicitly sequenced, never skipping a step",
    };
    const system = [
      SAFETY,
      "You are the tutor in a Socratic session. You guide the student to the answer; you do not hand it over.",
      `Your style is ${styleNote[req.teachingStyle]}. Academic level: ${req.level}.`,
      "End every message with one question the student must answer next.",
      JSON_ONLY,
    ].join(" ");

    const transcript = req.transcript
      .slice(-12)
      .map((m) => `${m.role === "tutor" ? "Tutor" : "Student"}: ${m.text}`)
      .join("\n");

    const prompt = [
      `Topic: ${req.topic}`,
      `Turn: ${req.turn}`,
      transcript ? `So far:\n${transcript}` : "This is the opening turn.",
      "Reply with JSON:",
      '{"text": string, "question": string, "expectedTerms": string[], "hints": string[], "readMissedConcepts": string[]}',
      '`expectedTerms` are the anchor terms the student should use when explaining this back.',
    ].join("\n\n");

    return this.askJson<TeachTurn>(
      system,
      prompt,
      900,
      0.7,
      (raw) => {
        const o = (raw ?? {}) as Record<string, unknown>;
        const text = asString(o.text ?? o.message ?? o.reply);
        if (!text) return null;
        const question = asString(o.question ?? o.nextQuestion);
        return {
          // The question is shown inside the bubble as well, so keep it there only
          // when the model separated it out.
          text: question && !text.includes(question) ? `${text}\n\n${question}` : text,
          question: question || undefined,
          expectedTerms: asStringArray(o.expectedTerms),
          hints: asStringArray(o.hints),
          readMissedConcepts: asStringArray(o.readMissedConcepts ?? o.missedConcepts),
        };
      },
      () => this.degradeTeach(req)
    );
  }

  private async degradeTeach(req: TeachRequest): Promise<TeachTurn> {
    if (this.fallback) return this.fallback.teach(req);
    // Last resort: never leave a student without a tutor turn.
    return {
      text: `Let's work through ${req.topic}. What do you already know about it?`,
      question: `What is ${req.topic}?`,
    };
  }

  // ------------------------------------------------------------------- grade

  async grade(req: GradeRequest): Promise<GradeResult> {
    const system = [
      SAFETY,
      "You grade a student's explanation of health-science material.",
      "Be specific and actionable. Name what was missing rather than just lowering a score.",
      "Encouraging in tone; never shaming. This is a learning tool, not an exam invigilator.",
      JSON_ONLY,
    ].join(" ");

    const prompt = [
      `Prompt: ${req.prompt}`,
      `Expected anchor terms: ${req.expectedTerms.join(", ") || "(none supplied)"}`,
      req.sourceText ? `Source material:\n${req.sourceText.slice(0, 3000)}` : "",
      `Student's explanation:\n${req.answer}`,
      "Reply with JSON:",
      '{"score": number, "hit": string[], "missing": string[], "misconceptions": string[], "feedback": string, "modelAnswer": string}',
      "`score` is 0..1. `misconceptions` must be empty if the reasoning is simply incomplete.",
    ]
      .filter(Boolean)
      .join("\n\n");

    return this.askJson<GradeResult>(
      system,
      prompt,
      900,
      0.2,
      (raw) => {
        const o = (raw ?? {}) as Record<string, unknown>;
        const feedback = asString(o.feedback);
        if (!feedback) return null;
        return {
          score: clamp01(o.score, 0.5),
          hit: asStringArray(o.hit ?? o.covered),
          missing: asStringArray(o.missing ?? o.gaps),
          misconceptions: asStringArray(o.misconceptions),
          feedback,
          modelAnswer: asString(o.modelAnswer) || undefined,
        };
      },
      () => this.degradeGrade(req)
    );
  }

  private async degradeGrade(req: GradeRequest): Promise<GradeResult> {
    if (this.fallback) return this.fallback.grade(req);
    return {
      score: 0.5,
      hit: [],
      missing: req.expectedTerms.slice(0, 3),
      misconceptions: [],
      feedback: "We could not grade that just now. Try saying what it is, why it matters, and its main limitation.",
    };
  }

  // ---------------------------------------------------------------- generate

  async generate(req: GenerateRequest): Promise<GeneratedArtifact> {
    const spec = kindSpec(req.kind);
    const system = [
      SAFETY,
      spec.brief,
      "Ground every claim in the supplied source material. Do not add outside facts.",
      `Target academic level: ${req.level}. Detail level 1-5: ${req.detailLevel}. Difficulty 1-5: ${req.difficulty}.`,
      shapeInstruction(spec),
    ].join(" ");

    const prompt = [
      `Artifact kind: ${req.kind.replace(/_/g, " ")}`,
      `Topic: ${req.topic}`,
      req.objective ? `Objective: ${req.objective}` : "",
      `Source material:\n${(req.sourceText || "(none)").slice(0, 12000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return this.askJson<GeneratedArtifact>(
      system,
      prompt,
      4000,
      0.4,
      (raw) => {
        const body = spec.coerce(raw, { difficulty: req.difficulty, detailLevel: req.detailLevel });
        return body === null ? null : { title: spec.title(req.topic), body };
      },
      () => this.degradeGenerate(req)
    );
  }

  private async degradeGenerate(req: GenerateRequest): Promise<GeneratedArtifact> {
    if (this.fallback) return this.fallback.generate(req);
    return { title: `${req.topic} — ${req.kind.replace(/_/g, " ")}`, body: { points: [] } };
  }

  // ---------------------------------------------------------------- roleplay

  async roleplay(req: RoleplayRequest): Promise<RoleplayTurn> {
    const system = [
      SAFETY,
      "You are playing a patient, caregiver or colleague inside a communication exercise.",
      "Stay in character and never break the fourth wall. Reveal facts only when the student earns them.",
      "Give concrete, realistic replies — not coaching. The student's feedback comes from the separate fields.",
      JSON_ONLY,
    ].join(" ");

    const transcript = req.transcript
      .slice(-14)
      .map((m) => `${m.role === "student" ? "Student" : "Character"}: ${m.text}`)
      .join("\n");

    const prompt = [
      `Character: ${req.character} (${req.personality})`,
      `Scenario: ${req.scenario}`,
      `Brief: ${req.brief}`,
      `Rapport: ${req.rapport} (-2 shut down to +2 fully open).`,
      `Facts the student has already uncovered: ${req.alreadyRevealed.join("; ") || "none yet"}`,
      req.challenge ? `Current complication: ${req.challenge}` : "",
      transcript ? `So far:\n${transcript}` : "The student has not spoken yet — open the conversation.",
      req.examMode ? "Exam mode: be less forgiving than in practice." : "",
      "Reply with JSON:",
      '{"text": string, "rapportDelta": number, "newlyRevealed": string[], "empathy": number, "questioning": number, "clarity": number, "notes": string[]}',
      "empathy/questioning/clarity are 0..1 and describe the student's last message.",
    ]
      .filter(Boolean)
      .join("\n\n");

    return this.askJson<RoleplayTurn>(
      system,
      prompt,
      900,
      0.85,
      (raw) => {
        const o = (raw ?? {}) as Record<string, unknown>;
        const text = asString(o.text ?? o.reply);
        if (!text) return null;
        const delta = Number(o.rapportDelta ?? 0);
        return {
          text,
          rapportDelta: Number.isFinite(delta) ? Math.max(-2, Math.min(2, delta)) : 0,
          newlyRevealed: asStringArray(o.newlyRevealed),
          empathy: clamp01(o.empathy, 0.5),
          questioning: clamp01(o.questioning, 0.5),
          clarity: clamp01(o.clarity, 0.5),
          notes: asStringArray(o.notes),
        };
      },
      () => this.degradeRoleplay(req)
    );
  }

  private async degradeRoleplay(req: RoleplayRequest): Promise<RoleplayTurn> {
    if (this.fallback) return this.fallback.roleplay(req);
    return {
      text: "Yes, I think that's a fair question. What made you ask?",
      rapportDelta: 0,
      newlyRevealed: [],
      empathy: 0.5,
      questioning: 0.5,
      clarity: 0.5,
      notes: [],
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(4000, 400 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
}