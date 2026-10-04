/**
 * Output contracts for `generate()`, keyed by kind.
 *
 * The app requests ~29 distinct kinds and each feature reads a different shape
 * back out. Rather than trust the model to guess, every kind declares the schema
 * it wants plus a `coerce` that both normalises and *validates* the reply. If
 * `coerce` returns null the caller discards the model output and uses the
 * deterministic provider instead — so a malformed reply degrades quality rather
 * than breaking Materials, Practice or Research.
 *
 * Consumers in materials/actions.ts already accept either a bare array or an
 * object wrapper (e.g. `{ cards: [...] }`), so both forms are valid here.
 */

import { asObjectArray, asString, asStringArray, clamp01 } from "./json";

export type Family = "summary" | "points" | "questions" | "flashcards" | "case" | "freeform";

export interface KindSpec {
  family: Family;
  /** Plain description of what this artifact is for, fed to the model. */
  brief: string;
  /** Title for the stored artifact. */
  title: (topic: string) => string;
  /** Returns a usable body, or null when the reply cannot be trusted. */
  coerce: (raw: unknown, ctx: { difficulty: number; detailLevel: number }) => unknown | null;
}

function cap(n: number, max: number): number {
  return Math.max(1, Math.min(n, max));
}

const summary = (brief: string): KindSpec => ({
  family: "summary",
  brief,
  title: (topic) => `${topic} — high-yield summary`,
  coerce: (raw) => {
    const o = Array.isArray(raw) ? { keyPoints: raw } : (raw as Record<string, unknown> | null);
    if (!o || typeof o !== "object") return null;
    const keyPoints = asStringArray(o.keyPoints ?? o.points ?? o.summary);
    const overview = asString(o.overview ?? o.summary ?? o.text);
    if (!keyPoints.length && !overview) return null;
    return {
      overview: overview || keyPoints[0] || "No summary produced.",
      keyPoints,
      misconceptions: asStringArray(o.misconceptions),
      clinicalRelevance: asString(o.clinicalRelevance),
    };
  },
});

const points = (brief: string, label = "key points"): KindSpec => ({
  family: "points",
  brief,
  title: (topic) => `${topic} — ${label}`,
  coerce: (raw) => {
    if (Array.isArray(raw)) {
      const list = asStringArray(raw);
      return list.length ? list : null;
    }
    const o = raw as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return null;
    const list = asStringArray(o.points ?? o.keyPoints ?? o.tips ?? o.steps);
    return list.length ? list : null;
  },
});

const questions = (): KindSpec => ({
  family: "questions",
  brief:
    "Write practice multiple-choice questions grounded strictly in the source material.",
  title: (topic) => `${topic} — practice questions`,
  coerce: (raw, ctx) => {
    const src = Array.isArray(raw) ? raw : (raw as { questions?: unknown })?.questions;
    const out = asObjectArray(src)
      .map((q) => {
        const choices = Array.isArray(q.choices) ? q.choices.map(String).slice(0, 6) : [];
        const answerIndex = Number(q.answerIndex ?? q.correctIndex ?? 0);
        return {
          stem: asString(q.stem ?? q.question),
          choices,
          answerIndex: Number.isFinite(answerIndex) ? answerIndex : 0,
          explanation: asString(q.explanation ?? q.why),
        };
      })
      .filter((q) => q.stem && q.choices.length >= 2 && q.answerIndex < q.choices.length);
    return out.length ? out.slice(0, cap(ctx.difficulty * 2, 20)) : null;
  },
});

const flashcards = (): KindSpec => ({
  family: "flashcards",
  brief: "Write atomic flashcards: one idea per card, question on the front.",
  title: (topic) => `${topic} — flashcards`,
  coerce: (raw, ctx) => {
    const src = Array.isArray(raw) ? raw : (raw as { cards?: unknown })?.cards;
    const out = asObjectArray(src)
      .map((c) => ({ front: asString(c.front ?? c.q ?? c.question), back: asString(c.back ?? c.a ?? c.answer) }))
      .filter((c) => c.front && c.back);
    return out.length ? out.slice(0, cap(ctx.detailLevel * 2, 20)) : null;
  },
});

const caseScenario = (): KindSpec => ({
  family: "case",
  brief:
    "Write a progressive-disclosure clinical or public-health case with decision steps.",
  title: (topic) => `${topic} — case scenario`,
  coerce: (raw, ctx) => {
    const o = (Array.isArray(raw) ? null : raw) as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return null;
    const steps = asObjectArray(o.steps ?? o.questions)
      .map((s) => {
        const choices = Array.isArray(s.choices) ? s.choices.map(String).slice(0, 6) : [];
        const answerIndex = Number(s.answerIndex ?? 0);
        return {
          prompt: asString(s.prompt ?? s.question ?? s.text),
          choices,
          answerIndex: Number.isFinite(answerIndex) ? answerIndex : 0,
          feedback: asString(s.feedback ?? s.explanation),
        };
      })
      .filter((s) => s.prompt && s.choices.length >= 2 && s.answerIndex < s.choices.length);
    const opening = asString(o.opening ?? o.brief);
    if (!steps.length && !opening) return null;
    return { opening, steps: steps.slice(0, cap(ctx.detailLevel, 8)) };
  },
});

const freeform = (brief: string, label: string): KindSpec => ({
  family: "freeform",
  brief,
  title: (topic) => `${topic} — ${label}`,
  // Any object or array survives flattenBody(); only a total non-object fails.
  coerce: (raw) => {
    if (typeof raw === "string" && raw.trim()) return { content: raw.trim() };
    if (Array.isArray(raw)) return raw.length ? raw : null;
    if (raw && typeof raw === "object") return raw;
    return null;
  },
});

/**
 * Every kind the app requests. Unknown kinds fall back to a generic points
 * contract, so a new caller still works before its spec is written down.
 */
export const KINDS: Record<string, KindSpec> = {
  // --- summaries and notes ---
  summary: summary("Write a high-yield summary of the material with key points, common misconceptions and clinical relevance."),
  revision_notes: summary("Write revision notes: the facts a student must be able to recall cold."),
  quick_review: points("Write a fast revision checklist."),
  explain_it_back: freeform("Turn the concept into prompts a student can explain back from memory.", "explain-back prompts"),
  formula_walkthrough: freeform("Walk through the formula or process step by step, with a worked example.", "formula walkthrough"),
  diagram_labeling: freeform("Describe what a labelled diagram of this concept should show, part by part.", "diagram labels"),
  application: points("List concrete clinical or public-health applications."),
  analysis: points("List the analytic findings worth remembering.", "analysis"),
  breakdown: points("Break the material into its component ideas.", "breakdown"),
  generate: freeform("Produce the requested study resource.", "generated resource"),
  notes: freeform("Write tidy study notes.", "notes"),
  interpret: freeform("Explain what the material means clinically.", "interpretation"),
  study_plan_doc: freeform("Write a study-plan document with headings and paragraphs.", "study plan"),
  assignment: freeform("Break the assignment into a working plan the student can follow.", "assignment plan"),
  plan: freeform("Write a structured study plan.", "plan"),
  methodology: freeform("Explain the methodology in plain language, flagging strengths and threats to validity.", "methodology"),
  explanation: freeform("Explain the concept clearly, with its main limitation stated.", "explanation"),
  evidence: summary("Summarise what the cited evidence supports and where it is limited."),
  research_question: freeform("Draft answerable research questions with the reasoning behind each.", "research questions"),
  biostat: freeform("Explain the statistical concept, when to use it, and a worked example.", "biostatistics"),
  case: caseScenario(),
  teach_me: freeform("Explain the concept as a tutor would, without giving the whole answer away.", "teaching notes"),
  // --- question banks ---
  questions: questions(),
  quiz: questions(),
  exam: questions(),
  test: questions(),
  multiple_choice: questions(),
  // --- flashcards ---
  flashcards: flashcards(),
  flashcard: flashcards(),
  // --- cases ---
  case_scenario: caseScenario(),
  // --- communication / free text ---
  communicate: freeform("Write the communication exercise content: scenario brief and opening line.", "communication exercise"),
};

export function kindSpec(kind: string): KindSpec {
  return (
    KINDS[kind] ??
    points(`Produce the "${kind.replace(/_/g, " ")}" artifact from the source material.`)
  );
}

/** Instruction appended to every generate prompt, describing the exact shape. */
export function shapeInstruction(spec: KindSpec): string {
  switch (spec.family) {
    case "summary":
      return 'Reply with JSON: {"overview": string, "keyPoints": string[], "misconceptions": string[], "clinicalRelevance": string}';
    case "points":
      return 'Reply with JSON: an array of short strings';
    case "questions":
      return 'Reply with JSON: an array of {"stem": string, "choices": string[], "answerIndex": number, "explanation": string}';
    case "flashcards":
      return 'Reply with JSON: an array of {"front": string, "back": string}';
    case "case":
      return 'Reply with JSON: {"opening": string, "steps": [{"prompt": string, "choices": string[], "answerIndex": number, "feedback": string}]}';
    default:
      return "Reply with a single JSON object using short, descriptive keys.";
  }
}

export { clamp01 };