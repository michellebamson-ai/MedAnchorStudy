import type {
  AIProvider,
  GeneratedArtifact,
  GenerateRequest,
  GradeRequest,
  GradeResult,
  TeachRequest,
  TeachTurn,
} from "./types";

/**
 * Deterministic provider — ports the prototype's simulated engines.
 * Keeps the whole learning loop testable and offline-capable, and gives the
 * UI realistic content before any model or key is chosen.
 */

const LEVEL_WORDS: Record<TeachRequest["level"], string[]> = {
  foundation: ["simple", "basic", "what is", "meaning of", "define"],
  student: ["how", "why", "compare", "calculate", "interpret"],
  advanced: ["derive", "critique", "quantify", "confounding", "implication"],
};

const STYLE_OPENER: Record<TeachRequest["teachingStyle"], string> = {
  gentle: "No rush — let's build this up gently.",
  rapid_fire: "Quick-fire round. Short answers only.",
  exam_pressure: "Exam conditions. State the answer, then justify it.",
  step_by_step: "We will take this one step at a time.",
};

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countTerms(text: string, terms: string[]): string[] {
  const hay = text.toLowerCase();
  return terms.filter((t) => hay.includes(t.toLowerCase()));
}

/** Crude but transparent misconception probes — mirrors prototype heuristics. */
const MISCONCEPTION_PROBES: { term: string; misconception: string }[] = [
  { term: "prevalence", misconception: "conflates prevalence with incidence" },
  { term: "sensitivity", misconception: "treats sensitivity as positive predictive value" },
  { term: "specificity", misconception: "mixes up specificity with negative predictive value" },
  { term: "risk", misconception: "mixes absolute risk with relative risk" },
  { term: "p value", misconception: "reads the p-value as effect size or clinical importance" },
];

export class SimulatedProvider implements AIProvider {
  readonly name = "simulated";
  readonly isLive = false;

  async teach(req: TeachRequest): Promise<TeachTurn> {
    const { topic, level, teachingStyle, turn, transcript } = req;

    // How well is the student doing? Grade their last message.
    const lastStudent = [...transcript].reverse().find((m) => m.role === "student");
    const prior = lastStudent ? splitSentences(lastStudent.text).length : 0;

    if (turn === 0) {
      return {
        text: `${STYLE_OPENER[teachingStyle]} Let's start with ${topic}.`,
        question: `Before we go further: what do you currently understand about ${topic}?`,
        expectedTerms: [],
        hints: [`Think about ${topic} in terms of what it measures or how it works.`],
      };
    }

    if (lastStudent && prior === 0) {
      return {
        text: `That was empty — let's give you a way in.`,
        question: `In one sentence, what problem does ${topic} help us with?`,
        hints: [`Start with "It helps us..."`],
        readMissedConcepts: [`no response yet for ${topic}`],
      };
    }

    // Escalate difficulty as the student shows more facility.
    const depth = Math.min(5, 2 + Math.floor(turn / 2));
    const ladder = [
      `Define ${topic} in your own words.`,
      `Explain the mechanism behind ${topic}.`,
      `Why would a clinician or public-health officer care about ${topic}?`,
      `What are the common errors when applying ${topic}?`,
      `Where does the evidence for ${topic} become uncertain, and why?`,
    ];

    const question = ladder[Math.min(depth - 1, ladder.length - 1)];
    const opener =
      prior >= 3
        ? `Good — that answer had substance. Going a level deeper.`
        : `Noted. Let's address that directly.`;

    return {
      text: `${opener} ${STYLE_OPENER[teachingStyle]}`,
      question,
      expectedTerms: LEVEL_WORDS[level].map((w) => topic.toLowerCase()),
      hints: [
        `Break ${topic} into its parts first.`,
        `Try a concrete patient or population example.`,
        `Say what it is, why it matters, and what it misses.`,
      ],
      readMissedConcepts: prior >= 3 ? [] : [`depth on ${topic}`],
    };
  }

  async grade(req: GradeRequest): Promise<GradeResult> {
    const { answer, expectedTerms } = req;
    const hit = countTerms(answer, expectedTerms);
    const missing = expectedTerms.filter((t) => !hit.includes(t));

    const misconceptions = MISCONCEPTION_PROBES.filter((p) =>
      answer.toLowerCase().includes(p.term)
    )
      .filter((p) => !answer.toLowerCase().includes("not") && !answer.toLowerCase().includes("unlike"))
      .map((p) => p.misconception);

    const sentences = splitSentences(answer);
    // Coverage of expected terms drives the score; length is a weak proxy for
    // reasoning, so it only nudges upward.
    const coverage = expectedTerms.length ? hit.length / expectedTerms.length : 0.5;
    const elaboration = Math.min(sentences.length / 6, 1) * 0.2;
    const penalty = misconceptions.length * 0.12;
    const score = Math.max(0, Math.min(1, coverage * 0.8 + elaboration - penalty));

    const lines: string[] = [];
    if (hit.length) lines.push(`You covered: ${hit.join(", ")}.`);
    if (missing.length) lines.push(`Not yet addressed: ${missing.join(", ")}.`);
    if (misconceptions.length) lines.push(`Watch out — this reads as ${misconceptions.join("; ")}.`);
    if (sentences.length <= 1) lines.push("One sentence is not enough to show your reasoning — expand it.");
    if (!lines.length) lines.push("Say what it is, why it matters, and what it cannot tell you.");

    return {
      score: Number(score.toFixed(2)),
      hit,
      missing,
      misconceptions,
      feedback: lines.join(" "),
      modelAnswer:
        `A strong answer would define ${expectedTerms[0] ?? req.prompt} precisely, explain the ` +
        `mechanism in steps, give one concrete example, and name its main limitation.`,
    };
  }

  async generate(req: GenerateRequest): Promise<GeneratedArtifact> {
    const sentences = splitSentences(req.sourceText).filter((s) => s.length > 40);
    const points = (sentences.length ? sentences : [req.sourceText]).slice(0, req.detailLevel * 2);
    const topic = req.topic;

    switch (req.kind) {
      case "summary":
        return {
          title: `${topic} — high-yield summary`,
          body: {
            overview: points[0] ?? `No extractable text for ${topic} yet.`,
            keyPoints: points,
            misconceptions: ["Commonly reversed or conflated in student recall."],
            clinicalRelevance: `Where ${topic} changes what you would actually do.`,
          },
        };
      case "questions":
        return {
          title: `${topic} — practice questions`,
          body: points.slice(0, req.difficulty * 2).map((p, i) => ({
            stem: `Regarding ${topic}: ${p}`,
            choices: ["Option A", "Option B", "Option C", "Option D"],
            answerIndex: i % 4,
            explanation: `Derived from your material: ${p.slice(0, 80)}…`,
          })),
        };
      case "flashcards":
        return {
          title: `${topic} — flashcards`,
          body: points.slice(0, 10).map((p) => ({
            front: `What is the key idea in ${topic}: "${p.slice(0, 60)}…"?`,
            back: p,
          })),
        };
      case "case_scenario":
        return {
          title: `${topic} — case scenario`,
          body: {
            opening: `A patient/community presents with features relevant to ${topic}.`,
            steps: points.slice(0, 4).map((p) => ({
              prompt: `Given: ${p.slice(0, 90)}… what do you conclude next?`,
              choices: ["Investigate", "Treat", "Refer", "No action"],
              answerIndex: 0,
              feedback: p,
            })),
          },
        };
      default:
        return {
          title: `${topic} — ${req.kind.replace(/_/g, " ")}`,
          body: { detailLevel: req.detailLevel, style: req.style, points },
        };
    }
  }
}

/** Chosen at runtime; defaults to simulated until a provider/key exists. */
export function getProvider(): AIProvider {
  return new SimulatedProvider();
}
