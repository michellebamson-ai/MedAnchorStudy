/**
 * Provider-independent prompt construction and reply parsing.
 *
 * Both `ClaudeProvider` and `GeminiProvider` share this so the two cannot drift:
 * the safety framing, the per-kind output contracts and the tolerant coercion
 * live in one place, and each provider file contains only transport.
 *
 * Parsing is deliberately defensive. Claude asks for JSON in prose; Gemini can be
 * told to emit JSON outright but still wraps or refuses. Anything unusable is
 * reported as `null` so the caller can fall back to the deterministic provider.
 */

import { asString, asStringArray, clamp01, extractJson } from "./json";
import { kindSpec, shapeInstruction } from "./kinds";
import type {
  GenerateRequest,
  GeneratedArtifact,
  GradeRequest,
  GradeResult,
  RoleplayRequest,
  RoleplayTurn,
  TeachRequest,
  TeachTurn,
} from "./types";

/** One model's turn: what to ask for, and how to turn the reply back into shape. */
export interface CallSpec<T> {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  parse: (raw: unknown) => T | null;
}

/**
 * Framing shared by every call. The clinical-safety lines matter here more than
 * anywhere else in the codebase: this is health education, and a provider that
 * drifts into giving individual advice is the single worst failure mode.
 */
export const SAFETY = [
  "You are part of MedAnchor Study, an educational tool for healthcare and health-sciences students.",
  "You teach and revise study material. You are not a clinician and must never give individual clinical",
  "advice, diagnosis or treatment decisions.",
  "Stay faithful to established medical facts. Never invent a fact, a citation, a statistic or a source.",
  "If the source material does not contain the answer, say so plainly instead of filling the gap.",
  "Prefer plain language over jargon, and name uncertainty when it exists.",
].join(" ");

export const JSON_ONLY =
  "Reply with valid JSON and nothing else. No preamble, no markdown fences, no commentary.";

// ------------------------------------------------------------------- teach

export function buildTeach(req: TeachRequest): CallSpec<TeachTurn> {
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
    "`expectedTerms` are the anchor terms the student should use when explaining this back.",
  ].join("\n\n");

  return {
    system,
    prompt,
    maxTokens: 900,
    temperature: 0.7,
    parse: (raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const text = asString(o.text ?? o.message ?? o.reply);
      if (!text) return null;
      const question = asString(o.question ?? o.nextQuestion);
      return {
        // The question renders inside the bubble too, so avoid printing it twice.
        text: question && !text.includes(question) ? `${text}\n\n${question}` : text,
        question: question || undefined,
        expectedTerms: asStringArray(o.expectedTerms),
        hints: asStringArray(o.hints),
        readMissedConcepts: asStringArray(o.readMissedConcepts ?? o.missedConcepts),
      };
    },
  };
}

// ------------------------------------------------------------------- grade

export function buildGrade(req: GradeRequest): CallSpec<GradeResult> {
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

  return {
    system,
    prompt,
    maxTokens: 900,
    temperature: 0.2,
    parse: (raw) => {
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
  };
}

// ---------------------------------------------------------------- generate

export function buildGenerate(req: GenerateRequest): CallSpec<GeneratedArtifact> {
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

  return {
    system,
    prompt,
    maxTokens: 4000,
    temperature: 0.4,
    parse: (raw) => {
      const body = spec.coerce(raw, { difficulty: req.difficulty, detailLevel: req.detailLevel });
      return body === null ? null : { title: spec.title(req.topic), body };
    },
  };
}

// ---------------------------------------------------------------- roleplay

export function buildRoleplay(req: RoleplayRequest): CallSpec<RoleplayTurn> {
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

  return {
    system,
    prompt,
    maxTokens: 900,
    temperature: 0.85,
    parse: (raw) => {
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
  };
}

// ------------------------------------------------------------------ fallbacks

/**
 * Last-resort replies used only when no deterministic provider is wired. A
 * student should never be handed an empty turn just because a vendor is down.
 */
export const LAST_RESORT: {
  teach: (req: TeachRequest) => TeachTurn;
  grade: (req: GradeRequest) => GradeResult;
  generate: (req: GenerateRequest) => GeneratedArtifact;
  roleplay: () => RoleplayTurn;
} = {
  teach: (req) => ({
    text: `Let's work through ${req.topic}. What do you already know about it?`,
    question: `What is ${req.topic}?`,
  }),
  grade: (req) => ({
    score: 0.5,
    hit: [],
    missing: req.expectedTerms.slice(0, 3),
    misconceptions: [],
    feedback:
      "We could not grade that just now. Try saying what it is, why it matters, and its main limitation.",
  }),
  generate: (req) => ({
    title: `${req.topic} — ${req.kind.replace(/_/g, " ")}`,
    body: { points: [] },
  }),
  roleplay: () => ({
    text: "Yes, I think that's a fair question. What made you ask?",
    rapportDelta: 0,
    newlyRevealed: [],
    empathy: 0.5,
    questioning: 0.5,
    clarity: 0.5,
    notes: [],
  }),
};

/** Parse a raw model reply through a CallSpec, tolerating fences and prose. */
export function parseWith<T>(spec: CallSpec<T>, rawText: string): T | null {
  return spec.parse(extractJson<unknown>(rawText));
}

/** Shared retry/backoff so both providers behave identically under throttling. */
export function backoffMs(attempt: number): number {
  return Math.min(4000, 400 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}