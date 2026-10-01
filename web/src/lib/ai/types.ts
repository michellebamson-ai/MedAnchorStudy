/**
 * AI provider abstraction (ADR-4).
 *
 * Features never import an LLM SDK directly — they call this interface.
 * Today `SimulatedProvider` reproduces the prototype's deterministic engines
 * (keyword grading, scripted Socratic turns). Later a real LLM provider slots
 * in without touching feature code.
 *
 * Deliberately narrow: these are the operations the PRD's learning loop needs.
 */

export type Level = "foundation" | "student" | "advanced";

export interface TeachRequest {
  topic: string;
  level: Level;
  teachingStyle: "gentle" | "rapid_fire" | "exam_pressure" | "step_by_step";
  turn: number;
  /** Everything said so far in this tutoring session. */
  transcript: { role: "tutor" | "student"; text: string }[];
}

export interface TeachTurn {
  /** The tutor's message shown in the chat bubble. */
  text: string;
  /** Optional follow-up question; the student answers this next. */
  question?: string;
  /** Anchor terms we listen for when grading (Explain-It-Back). */
  expectedTerms?: string[];
  /** Hints the student can reveal progressively. */
  hints?: string[];
  /** Tutor's read on how the student is doing, for the learning profile. */
  readMissedConcepts?: string[];
}

export interface GradeRequest {
  prompt: string;
  answer: string;
  expectedTerms: string[];
  /** Optional context: the passage/concept the answer should reflect. */
  sourceText?: string;
}

export interface GradeResult {
  /** 0..1 */
  score: number;
  /** Which expected terms the student hit. */
  hit: string[];
  /** Which expected terms are missing — the most actionable signal. */
  missing: string[];
  /** Misconceptions detected in the wording. */
  misconceptions: string[];
  feedback: string;
  /** A stronger version to compare against, for "explain it better". */
  modelAnswer?: string;
}

export interface GenerateRequest {
  /** What to produce: breakdown, summary, revision_notes, questions, case_scenario, ... */
  kind: string;
  /** Source material — uploaded doc text or concept list. */
  sourceText: string;
  topic: string;
  level: Level;
  /** Generation controls from PRD §3.2. */
  detailLevel: number; // 1..5
  style: string;
  format: string;
  difficulty: number; // 1..5
  objective?: string;
}

export interface GeneratedArtifact {
  title: string;
  body: unknown;
}

export interface AIProvider {
  readonly name: string;
  /** True when output comes from a real model rather than rules. */
  readonly isLive: boolean;

  teach(req: TeachRequest): Promise<TeachTurn>;
  grade(req: GradeRequest): Promise<GradeResult>;
  generate(req: GenerateRequest): Promise<GeneratedArtifact>;
}
