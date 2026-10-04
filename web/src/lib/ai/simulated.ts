import type {
  AIProvider,
  GeneratedArtifact,
  GenerateRequest,
  GradeRequest,
  GradeResult,
  RoleplayRequest,
  RoleplayTurn,
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

  async roleplay(req: RoleplayRequest): Promise<RoleplayTurn> {
    return roleplayTurn(req);
  }
}

/**
 * The deterministic provider. Kept as the safety net for `ClaudeProvider` and as
 * the offline mode for tests and demos.
 *
 * `getProvider` lives in `@/lib/ai/provider` — import it from there, not here,
 * so the two modules do not form a cycle.
 */

const EMPATHY_WORDS = [
  "sorry", "understand", "difficult", "hard", "worried", "worry", "scared",
  "afraid", "feel", "feeling", "hear", "listening", "help", "together",
  "comfort", "reassure", "thank", "appreciate", "concern",
];

const OPEN_STARTERS = [
  "tell me", "describe", "explain", "walk me through", "what happened",
  "how did", "how does", "how do you feel", "what worries", "what concerns",
  "help me understand",
];

const JARGON = [
  "myocardial", "infarction", "hypertension", "hyperlipidemia", "etiology",
  "pathophysiology", "differential", "prognosis", "idiopathic", "benign",
  "malignant", "tachycardia", "bradycardia", "dyspnea", "orthopnea",
];

/** Deterministic character engine (PRACTICE_SPEC.md Communication). */
export function roleplayTurn(req: RoleplayRequest): RoleplayTurn {
  const last = [...req.transcript].reverse().find((m) => m.role === "student");
  const said = (last?.text ?? "").trim();
  const low = said.toLowerCase();
  const notes: string[] = [];

  // --- Read the student's message ---
  const empathyHits = EMPATHY_WORDS.filter((w) => low.includes(w));
  const empathy = Math.min(1, empathyHits.length / 2 + (/\b(please|kindly)\b/.test(low) ? 0.2 : 0));
  const isQuestion = /\?/.test(said);
  const open = OPEN_STARTERS.some((s) => low.includes(s));
  const questioning = !said ? 0 : isQuestion ? (open ? 1 : 0.55) : 0.25;
  const jargonHits = JARGON.filter((w) => low.includes(w));
  const clarity = !said
    ? 0
    : Math.max(0.15, Math.min(1, 0.55 + said.split(/\s+/).length / 60 - jargonHits.length * 0.25));
  const rushed = said.length > 0 && said.length < 20 && !isQuestion;
  const cold =
    /^(answer|tell me now|hurry|quick|just tell)/.test(low) || (said.length < 40 && !isQuestion && empathy === 0);

  if (open) notes.push("Used an open question — the character opened up.");
  if (empathyHits.length) notes.push(`Showed empathy (“${empathyHits.slice(0, 2).join("”, “")}”).`);
  if (jargonHits.length) notes.push(`Used jargon (${jargonHits.slice(0, 2).join(", ")}) — plain words land better.`);
  if (rushed) notes.push("Very short non-question — the character felt rushed.");
  if (cold) notes.push("The approach felt cold — the character pulled back.");

  // --- Rapport movement, shaped by personality ---
  let delta = 0;
  if (empathy >= 0.5) delta += 1;
  else if (empathy > 0) delta += 0.5;
  if (open) delta += 0.5;
  if (cold) delta -= 1;
  if (rushed) delta -= 0.5;

  switch (req.personality) {
    case "angry":
      // Needs to feel heard first: empathy counts double, questions alone don't.
      delta = empathy >= 0.5 ? 1 : cold || !isQuestion ? -1 : 0;
      break;
    case "quiet":
      // Only patient open questions move them; closed questions stall.
      delta = open ? 1 : isQuestion ? 0 : -0.5;
      break;
    case "skeptical":
      // Trust builds slowly; jargon or rushing resets it.
      delta = Math.max(-1, Math.min(0.5, delta - (jargonHits.length ? 0.5 : 0)));
      break;
    case "confused":
      // Plain words help; jargon confuses further.
      delta = jargonHits.length ? -0.5 : open || empathy > 0 ? 0.5 : 0;
      break;
    case "anxious":
      // Calm, clear words; rushing frightens.
      delta = rushed ? -1 : empathy > 0 || open ? 0.5 : 0;
      break;
    case "talkative":
      // Easy to open, but needs steering: reward focused follow-ups.
      delta = open ? 0.5 : 0.25;
      break;
    case "cost_worried":
      delta = /cost|price|pay|money|afford|insurance|bill/.test(low) ? 1 : open ? 0.5 : 0;
      break;
    default:
      break;
  }

  const rapport = Math.max(-2, Math.min(2, req.rapport + delta));

  // --- Reveal hidden facts the student earned ---
  const newlyRevealed: string[] = [];
  const gate = req.personality === "angry" || req.personality === "quiet" || req.personality === "skeptical" ? 0.5 : -0.5;
  for (const fact of req.hiddenFacts) {
    if (req.alreadyRevealed.includes(fact)) continue;
    const keywords = fact.toLowerCase().match(/[a-z][a-z\-']{3,}/g) ?? [];
    const asked = keywords.some((k) => k.length > 4 && low.includes(k));
    if ((asked && rapport >= gate) || (open && rapport >= 1 && newlyRevealed.length === 0)) {
      newlyRevealed.push(fact);
      if (newlyRevealed.length >= 2) break;
    }
  }

  // --- The character's voice ---
  const firstName = { patient: "I", caregiver: "We", community_member: "We", colleague: "I", community_leader: "We" }[
    req.character
  ] ?? "I";

  let text: string;
  if (!said) {
    text = openingLine(req);
  } else if (newlyRevealed.length) {
    text = revealLine(req, newlyRevealed[0]);
  } else if (rapport <= -1.5) {
    text = shutdownLine(req);
  } else if (cold || rushed) {
    text = deflectLine(req);
  } else if (!isQuestion) {
    text = acknowledgeLine(req, firstName);
  } else {
    text = parryLine(req, firstName);
  }

  if (req.challenge === "refuses_exam" && /examin|check|listen|look/.test(low) && rapport < 1) {
    text = "No — I don't want to be examined right now. Nobody asked me properly first.";
  }

  return { text, rapportDelta: delta, newlyRevealed, empathy, questioning, clarity, notes };
}

function openingLine(req: RoleplayRequest): string {
  const openers: Record<string, string> = {
    anxious: "Sorry — I'm probably worrying over nothing… it's just, the pain hasn't gone, and I keep thinking the worst.",
    angry: "Finally. I've been waiting over an hour. Let's get this over with — what do you want?",
    confused: "The doctor used so many big words last time. I didn't understand half of it. Can you… say it simply?",
    quiet: "…Yes. I'm here.",
    talkative: "Oh good, you're here! So it started on Tuesday — no wait, Monday — after lunch, well, actually after my walk…",
    skeptical: "Look, I don't usually trust hospitals. My neighbour told me to come, that's the only reason I'm here.",
    cost_worried: "Before we start — how much is this going to cost me? I can't afford another big bill.",
  };
  return openers[req.personality] ?? "Hello… what do you need to know?";
}

function revealLine(req: RoleplayRequest, fact: string): string {
  const wrappers: Record<string, (f: string) => string> = {
    anxious: (f) => `Okay… since you're asking properly — ${f} I've been too scared to say it out loud.`,
    angry: (f) => `Fine. ${f} There — now do something useful with it.`,
    confused: (f) => `Ohh… I think I get it now. So ${f} Is that right?`,
    quiet: (f) => `…${f}`,
    talkative: (f) => `Yes! And there's more — ${f} Oh, and did I mention…`,
    skeptical: (f) => `Hmm. I'll tell you this much: ${f} Don't make me regret trusting you.`,
    cost_worried: (f) => `${f} …Please tell me fixing it won't cost a fortune.`,
  };
  return (wrappers[req.personality] ?? ((f: string) => f))(fact);
}

function shutdownLine(req: RoleplayRequest): string {
  const lines: Record<string, string> = {
    angry: "You know what, forget it. I'd rather wait for someone who actually listens.",
    quiet: "…I'd rather not say.",
    skeptical: "This is exactly why I don't come here. You're not hearing me.",
    anxious: "I'm sorry, I can't — this is too much. Can we stop?",
    confused: "No, no — you've lost me completely now.",
    talkative: "…Sorry, you seem busy. I'll stop talking.",
    cost_worried: "If it's going to be like this, I'll just go home and hope for the best.",
  };
  return lines[req.personality] ?? "I'd rather not continue like this.";
}

function deflectLine(req: RoleplayRequest): string {
  const lines: Record<string, string> = {
    angry: "Don't rush me. Ask like you actually care.",
    quiet: "…Could you ask me properly? One thing at a time?",
    anxious: "Please slow down — you're scaring me more.",
    confused: "That's too fast for me. One simple question, please.",
    talkative: "Whoa, slow down! Let me finish telling you first.",
    skeptical: "See? Nobody here has time for people like me.",
    cost_worried: "Just answer me straight — what will it cost?",
  };
  return lines[req.personality] ?? "Could you slow down and ask me properly?";
}

function acknowledgeLine(req: RoleplayRequest, firstName: string): string {
  const lines: Record<string, string> = {
    talkative: "Right, right — and then what happened was… oh sorry, you were saying?",
    quiet: "…Okay.",
    angry: "Hmph. Go on then.",
    anxious: "Okay… okay, I'm listening. Please keep explaining.",
    confused: "I'm trying to follow… could you use smaller words?",
    skeptical: "Hmm. Maybe. What else?",
    cost_worried: "Alright… but the cost — you haven't said about the cost.",
  };
  return `${firstName === "We" ? "We'll listen. " : ""}${lines[req.personality] ?? "I see. What would you like to know?"}`;
}

function parryLine(req: RoleplayRequest, firstName: string): string {
  const lines: Record<string, string> = {
    quiet: "…Yes. That's all.",
    angry: "Why do you need to know that? …Fine, ask your next question then.",
    anxious: "Do you think it's serious? Please be honest with me.",
    confused: "Is that important? I don't really know…",
    talkative: "Good question! Well — it depends, because on Monday… no wait…",
    skeptical: "Why should I answer that? What's it got to do with anything?",
    cost_worried: "Will answering that change what I have to pay?",
  };
  void firstName;
  return lines[req.personality] ?? "Hmm… can you ask that a different way?";
}
