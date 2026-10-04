"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/provider";
import { recordActivity } from "@/lib/mastery";

/** revalidatePath throws outside a request (scripts, tests) — never break on it. */
function refresh(): void {
  try {
    revalidatePath("/practice");
  } catch {
    /* not in a request context */
  }
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export interface CommScenarioInfo {
  id: string;
  slug: string;
  title: string;
  character: string;
  kind: string;
  difficulty: number;
  brief: string;
  attempts: number;
  avgScore: number | null;
}

const CHARACTER_LABEL: Record<string, string> = {
  patient: "Patient",
  caregiver: "Caregiver",
  community_member: "Community member",
  colleague: "Colleague",
  community_leader: "Community leader",
};

const KIND_LABEL: Record<string, string> = {
  "history-taking": "History-taking",
  interview: "Patient interview",
  "health-education": "Health education",
  "motivational-interviewing": "Motivational interviewing",
  "bad-news": "Breaking bad news",
  "public-health": "Public-health communication",
  "community-engagement": "Community engagement",
  "outbreak-explaining": "Explaining an outbreak",
  "measure-explaining": "Explaining a health measure",
};

/** Generic facts when the student builds a custom scenario (not a seed one). */
const DEFAULT_FACTS: Record<string, string[]> = {
  "history-taking": [
    "The main symptom started three days ago and is getting worse.",
    "Something in the family history is relevant but undisclosed.",
    "A medication was stopped recently without telling any clinician.",
    "There is one associated symptom the student has not asked about.",
  ],
  "bad-news": [
    "The patient already suspects bad news.",
    "There is little support at home right now.",
    "The biggest fear is about the future, not the diagnosis word itself.",
    "They want to know what happens next.",
  ],
  default: [
    "There is an unspoken worry behind the visit.",
    "Daily habits matter more than the student has explored.",
    "A misconception is shaping every answer.",
    "Cost or access is a hidden barrier.",
  ],
};

export async function listScenarios(): Promise<{
  scenarios: CommScenarioInfo[];
  suggested: CommScenarioInfo[];
}> {
  const userId = await requireUserId();
  const [scenarios, attempts] = await Promise.all([
    prisma.commScenario.findMany({ orderBy: { difficulty: "asc" } }),
    prisma.commAttempt.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const byScenario = new Map<string, { n: number; sum: number }>();
  for (const a of attempts) {
    const scores = (a.scores ?? {}) as { overall?: number };
    const b = byScenario.get(a.scenarioId) ?? { n: 0, sum: 0 };
    b.n += 1;
    if (typeof scores.overall === "number") b.sum += scores.overall;
    byScenario.set(a.scenarioId, b);
  }

  const infos: CommScenarioInfo[] = scenarios.map((s) => {
    const b = byScenario.get(s.id);
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      character: s.character,
      kind: s.kind,
      difficulty: s.difficulty,
      brief: s.brief,
      attempts: b?.n ?? 0,
      avgScore: b && b.n ? Number((b.sum / b.n).toFixed(2)) : null,
    };
  });

  const suggested = [...infos].sort((a, b) => {
    const aw = a.avgScore == null ? 0.4 : a.avgScore < 0.6 ? 0 : 1;
    const bw = b.avgScore == null ? 0.4 : b.avgScore < 0.6 ? 0 : 1;
    return aw - bw;
  });

  return { scenarios: infos, suggested: suggested.slice(0, 3) };
}

export interface StartCommInput {
  scenarioId?: string;
  character?: string;
  kind?: string;
  personality?: string;
  challenge?: string;
  difficulty?: number;
  mode?: "text" | "voice";
  documentId?: string;
}

export interface StartCommResult {
  ok: boolean;
  message: string;
  session?: {
    scenarioId: string;
    title: string;
    character: string;
    characterLabel: string;
    kind: string;
    kindLabel: string;
    personality: string;
    challenge?: string;
    difficulty: number;
    mode: "text" | "voice";
    brief: string;
    opening: string;
    hiddenFacts: string[];
    generated: boolean;
  };
}

/** Open a session: a seed scenario, or a custom build from the student's picks. */
export async function startComm(input: StartCommInput): Promise<StartCommResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to practise communication." };
  }

  const provider = getProvider();

  if (input.scenarioId) {
    const s = await prisma.commScenario.findUnique({ where: { id: input.scenarioId } });
    if (!s) return { ok: false, message: "Scenario not found." };
    const rubric = (s.rubric ?? {}) as { hiddenFacts?: string[] };
    const opening = await provider.roleplay({
      character: s.character,
      personality: (rubric as { personality?: string }).personality ?? "anxious",
      scenario: s.kind,
      brief: s.brief,
      hiddenFacts: rubric.hiddenFacts ?? [],
      alreadyRevealed: [],
      rapport: 0,
      transcript: [],
      level: "student",
      examMode: false,
    });
    return {
      ok: true,
      message: "Scenario ready.",
      session: {
        scenarioId: s.id,
        title: s.title,
        character: s.character,
        characterLabel: CHARACTER_LABEL[s.character] ?? s.character,
        kind: s.kind,
        kindLabel: KIND_LABEL[s.kind] ?? s.kind,
        personality: (rubric as { personality?: string }).personality ?? "anxious",
        difficulty: s.difficulty,
        mode: input.mode ?? "text",
        brief: s.brief,
        opening: opening.text,
        hiddenFacts: rubric.hiddenFacts ?? [],
        generated: false,
      },
    };
  }

  // Custom build from the student's picks.
  const character = input.character ?? "patient";
  const kind = input.kind ?? "history-taking";
  const personality = input.personality ?? (Math.random() < 0.2 ? "quiet" : "anxious");
  void userId;

  let brief = `You are meeting a ${CHARACTER_LABEL[character]?.toLowerCase() ?? character} for ${
    KIND_LABEL[kind]?.toLowerCase() ?? kind
  }.`;
  let materialTitle: string | null = null;
  if (input.documentId) {
    const doc = await prisma.document.findFirst({
      where: { id: input.documentId, userId: await requireUserId() },
    });
    if (doc?.extractedText) {
      materialTitle = doc.title;
      brief += ` It relates to their material "${doc.title}".`;
    }
  }

  const facts = DEFAULT_FACTS[kind] ?? DEFAULT_FACTS.default;
  const opening = await provider.roleplay({
    character,
    personality,
    scenario: kind,
    brief,
    hiddenFacts: facts,
    alreadyRevealed: [],
    rapport: 0,
    challenge: input.challenge,
    transcript: [],
    level: "student",
    examMode: (input.difficulty ?? 2) >= 4,
  });

  // Persist the custom build so attempts, feedback and history attach to it.
  const saved = await prisma.commScenario.create({
    data: {
      slug: `gen-${randomUUID().slice(0, 8)}`,
      title: `${KIND_LABEL[kind] ?? kind} with ${CHARACTER_LABEL[character] ?? character}${materialTitle ? ` (${materialTitle})` : ""}`,
      character,
      kind,
      difficulty: input.difficulty ?? 2,
      brief,
      opening: personality,
      rubric: { hiddenFacts: facts, personality, challenge: input.challenge } as never,
      soapRubric: null as never,
    },
  });

  return {
    ok: true,
    message: "Scenario ready.",
    session: {
      scenarioId: saved.id,
      title: saved.title,
      character,
      characterLabel: CHARACTER_LABEL[character] ?? character,
      kind,
      kindLabel: KIND_LABEL[kind] ?? kind,
      personality,
      challenge: input.challenge,
      difficulty: input.difficulty ?? 2,
      mode: input.mode ?? "text",
      brief,
      opening: opening.text,
      hiddenFacts: facts,
      generated: true,
    },
  };
}

export interface ReplyInput {
  scenarioId: string;
  personality: string;
  character: string;
  kind: string;
  brief: string;
  hiddenFacts: string[];
  revealed: string[];
  rapport: number;
  challenge?: string;
  examMode: boolean;
  transcript: Array<{ role: "student" | "character"; text: string }>;
  answer: string;
}

export interface ReplyResult {
  text: string;
  rapport: number;
  revealed: string[];
  empathy: number;
  questioning: number;
  clarity: number;
  notes: string[];
}

/** One conversational turn with the character. */
export async function replyComm(input: ReplyInput): Promise<ReplyResult> {
  await requireUserId();
  const provider = getProvider();
  const turn = await provider.roleplay({
    character: input.character,
    personality: input.personality,
    scenario: input.kind,
    brief: input.brief,
    hiddenFacts: input.hiddenFacts,
    alreadyRevealed: input.revealed,
    rapport: input.rapport,
    challenge: input.challenge,
    transcript: [...input.transcript, { role: "student" as const, text: input.answer.slice(0, 1500) }],
    level: "student",
    examMode: input.examMode,
  });
  return {
    text: turn.text,
    rapport: Math.max(-2, Math.min(2, input.rapport + turn.rapportDelta)),
    revealed: [...input.revealed, ...turn.newlyRevealed.filter((f) => !input.revealed.includes(f))],
    empathy: turn.empathy,
    questioning: turn.questioning,
    clarity: turn.clarity,
    notes: turn.notes,
  };
}

export interface TraceEntry {
  empathy: number;
  questioning: number;
  clarity: number;
  notes: string[];
  text: string;
}

export interface EndCommResult {
  wentWell: string[];
  missed: string[];
  rephrases: Array<{ said: string; better: string }>;
  nextSteps: string[];
  scores: { clarity: number; questioning: number; empathy: number; overall: number };
  orderNote: string | null;
  checklist: Array<{ label: string; done: boolean }>;
}

/** End of session: four-part feedback, scores, order check, OSCE checklist. */
export async function endComm(input: {
  scenarioId: string;
  transcript: Array<{ role: "student" | "character"; text: string }>;
  revealed: string[];
  trace: TraceEntry[];
  examMode: boolean;
  soapNote?: string | null;
}): Promise<EndCommResult> {
  const userId = await requireUserId();
  const scenario = await prisma.commScenario.findUnique({ where: { id: input.scenarioId } });
  if (!scenario) throw new Error("Scenario not found.");

  const rubric = (scenario.rubric ?? {}) as { hiddenFacts?: string[]; osce?: string[] };
  const hidden = rubric.hiddenFacts ?? [];
  const studentLines = input.transcript.filter((m) => m.role === "student").map((m) => m.text);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const clarity = mean(input.trace.map((t) => t.clarity));
  const questioning = mean(input.trace.map((t) => t.questioning));
  const empathy = mean(input.trace.map((t) => t.empathy));
  const overall = mean([clarity, questioning, empathy]);
  const pct = (x: number) => Math.round(x * 100);

  // What went well: best observed behaviors.
  const wentWell: string[] = [];
  if (empathy >= 0.4) wentWell.push("Kind words that acknowledged feelings");
  if (questioning >= 0.6) wentWell.push("Open questions that invited the full story");
  else if (questioning >= 0.35) wentWell.push("Direct questions that kept things moving");
  if (clarity >= 0.6) wentWell.push("Clear explanations in plain words");
  if (!wentWell.length) wentWell.push("Stayed with a difficult conversation to the end");

  // What was missed: facts never elicited.
  const missed = hidden.filter((f) => !input.revealed.includes(f)).slice(0, 4);

  // Rephrases: up to two concrete better-ways from the student's own words.
  const rephrases: Array<{ said: string; better: string }> = [];
  for (const line of studentLines) {
    if (rephrases.length >= 2) break;
    const low = line.toLowerCase();
    if (low.length < 12) continue;
    if (/\b(myocardial|infarction|hypertension|etiology|pathophysiology|differential|prognosis)\b/.test(low)) {
      rephrases.push({
        said: line.slice(0, 90),
        better: "Say the same thing in the words the patient uses — e.g. “heart attack” instead of “myocardial infarction”.",
      });
    } else if (/^(do you|are you|have you|did you|is there|can you)[^?]*\?$/.test(low.trim()) && low.length < 60) {
      rephrases.push({
        said: line.slice(0, 90),
        better: `Open it up instead — e.g. “Tell me more about that” rather than “${line.trim().slice(0, 50)}”.`,
      });
    }
  }

  // Question order: broad before drill-down.
  let orderNote: string | null = null;
  const drillRe = /\b(how long|how often|where|scale|rate|score|worse|better|onset)\b/i;
  const firstOpen = studentLines.findIndex((l) => /tell me|describe|explain|what happened|how do you feel/i.test(l));
  const firstDrill = studentLines.findIndex((l) => drillRe.test(l));
  if (firstDrill !== -1 && (firstOpen === -1 || firstDrill < firstOpen)) {
    orderNote = "You drilled into detail before opening broadly — start wide (“tell me what happened”), then narrow down.";
  } else if (firstOpen !== -1) {
    orderNote = "Good order — you opened broadly before narrowing down.";
  }

  // OSCE checklist: each criterion matched against the transcript by keyword overlap.
  const checklist = (rubric.osce ?? []).map((criterion) => {
    const keys = (criterion.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(
      (w) => !["with", "what", "that", "from", "your", "about", "into", "over", "they", "them", "then", "than"].includes(w)
    );
    const hay = studentLines.join(" ").toLowerCase();
    const hits = keys.filter((k) => hay.includes(k)).length;
    return { label: criterion, done: keys.length > 0 && hits >= Math.min(2, keys.length) };
  });

  const nextSteps = [
    missed.length ? `Practise eliciting: ${missed[0].slice(0, 70)}` : "Try a harder personality next time",
    questioning < 0.5 ? "Ask one more open question per session" : "Keep leading with open questions",
  ];

  await prisma.commAttempt.create({
    data: {
      userId,
      scenarioId: scenario.id,
      transcript: input.transcript as never,
      scores: {
        clarity: Number(clarity.toFixed(2)),
        questioning: Number(questioning.toFixed(2)),
        empathy: Number(empathy.toFixed(2)),
        overall: Number(overall.toFixed(2)),
      } as never,
      feedback: [
        `Went well: ${wentWell.join("; ")}`,
        missed.length ? `Missed: ${missed.join("; ")}` : "Nothing important missed.",
        orderNote ?? "",
      ]
        .filter(Boolean)
        .join("\n"),
      soapNote: input.soapNote ?? null,
    },
  });

  await recordActivity({
    userId,
    kind: "communicate",
    activity: "comm_session",
    score: Number(overall.toFixed(2)),
    maxScore: 1,
    detail: { scenarioId: scenario.id, scenario: scenario.title },
  });

  // Practice times go to Study Plan and Home.
  await prisma.planItem.create({
    data: {
      userId,
      title: `Communication practice: ${scenario.title}`,
      mode: "deep",
      activity: "communicate",
      scheduledFor: new Date(Date.now() + 3 * 86_400_000),
      estMinutes: 20,
      priority: overall < 0.5 ? 1 : 3,
      origin: "communicate",
    },
  });

  refresh();
  return {
    wentWell,
    missed,
    rephrases,
    nextSteps,
    scores: { clarity: pct(clarity), questioning: pct(questioning), empathy: pct(empathy), overall: pct(overall) },
    orderNote,
    checklist,
  };
}

/** SOAP-note check: sections present, unclear writing flagged, model shown. */
export async function checkSoap(input: {
  scenarioId: string;
  sections: { subjective: string; objective: string; assessment: string; plan: string };
}): Promise<{
  checks: Array<{ section: string; ok: boolean; note: string }>;
  model: string[];
}> {
  await requireUserId();
  const scenario = await prisma.commScenario.findUnique({ where: { id: input.scenarioId } });
  const model = (scenario?.soapRubric ?? {}) as Record<string, string[]>;

  const checks = (Object.keys(input.sections) as Array<keyof typeof input.sections>).map((key) => {
    const text = input.sections[key].trim();
    if (text.length < 20) {
      return { section: key, ok: false, note: "Too thin — add what you actually learned, not just a heading." };
    }
    const vague = (text.match(/\b(normal|okay|fine|unremarkable|nad)\b/gi) ?? []).length;
    if (vague >= 3) {
      return { section: key, ok: true, note: "Present, but vague words do the work — name findings specifically." };
    }
    return { section: key, ok: true, note: "Present and specific." };
  });

  const modelNote = ["subjective", "objective", "assessment", "plan"].flatMap((k) => [
    `${k.toUpperCase()}:`,
    ...((model[k] as string[] | undefined) ?? ["(No model note for this scenario — your tutor's feedback above is the guide.)"]),
  ]);

  return { checks, model: modelNote };
}
