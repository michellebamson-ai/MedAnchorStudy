"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/provider";
import { recordActivity } from "@/lib/mastery";
import { formatCitation, type CitationStyle } from "@/lib/citations";

/** revalidatePath throws outside a request (scripts, tests) — never break on it. */
function refresh(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    /* not in a request context */
  }
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export type SourceFilter = "pubmed" | "scholar" | "guidelines" | "news" | "textbooks" | "all";

/** Which stored types answer each filter. Honest mapping, shown in the UI. */
const FILTER_TYPES: Record<SourceFilter, string[] | null> = {
  // Until live PubMed/Scholar APIs land (Phase 6), these search the curated
  // peer-reviewed shelf of the local library and say so.
  pubmed: ["peer_reviewed", "systematic_review"],
  scholar: ["peer_reviewed", "systematic_review", "textbook"],
  guidelines: ["clinical_guideline", "public_health_guideline", "government", "organization"],
  news: ["news"],
  textbooks: ["textbook"],
  all: null,
};

export interface EvidenceHit {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  publisher: string | null;
  url: string | null;
  sourceType: string;
  snippet: string;
  saved: boolean;
  mine: boolean;
}

/** Search the curated library plus the student's own saved sources. */
export async function searchEvidence(query: string, filter: SourceFilter = "all"): Promise<{
  hits: EvidenceHit[];
  note: string;
}> {
  const user = await getCurrentUser().catch(() => null);
  const q = query.trim();
  if (!q) return { hits: [], note: "" };

  const types = FILTER_TYPES[filter];
  // Match any significant word — students type phrases, not titles.
  const words = q
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !["the", "and", "for", "with", "from"].includes(w))
    .slice(0, 6);
  if (!words.length) return { hits: [], note: "" };
  const wordOr = words.flatMap((w) => [
    { title: { contains: w, mode: "insensitive" as const } },
    { abstract: { contains: w, mode: "insensitive" as const } },
    { publisher: { contains: w, mode: "insensitive" as const } },
  ]);
  const library = await prisma.source.findMany({
    where: {
      userId: null,
      ...(types ? { sourceType: { in: types } } : {}),
      OR: wordOr,
    },
    orderBy: { year: "desc" },
    take: 20,
  });

  const mine = user
    ? await prisma.source.findMany({
        where: { userId: user.id, OR: wordOr },
        take: 10,
      })
    : [];

  const savedIds = new Set(mine.map((m) => m.identifier).filter(Boolean));
  const hits: EvidenceHit[] = [
    ...mine.map((m) => toHit(m, true, true)),
    ...library
      .filter((l) => !savedIds.has(l.identifier))
      .map((l) => toHit(l, savedIds.has(l.identifier), false)),
  ];

  if (user) {
    await recordActivity({
      userId: user.id,
      kind: "evidence",
      activity: "evidence_search",
      detail: { query: q.slice(0, 120), filter, hits: hits.length },
    }).catch(() => null);
  }

  const live =
    filter === "pubmed" || filter === "scholar"
      ? "PubMed and Scholar search the curated peer-reviewed shelf for now — live lookup arrives with connectors."
      : "Searching the curated library. Live databases arrive with connectors — everything here is labelled by source type.";
  return { hits, note: hits.length ? live : "" };
}

function toHit(
  s: {
    id: string;
    title: string;
    authors: string | null;
    year: number | null;
    publisher: string | null;
    url: string | null;
    sourceType: string;
    abstract: string | null;
  },
  saved: boolean,
  mine: boolean
): EvidenceHit {
  return {
    id: s.id,
    title: s.title,
    authors: s.authors,
    year: s.year,
    publisher: s.publisher,
    url: s.url,
    sourceType: s.sourceType,
    snippet: (s.abstract ?? "").slice(0, 220),
    saved,
    mine,
  };
}

/** Save a library source into My Sources (a personal copy). */
export async function saveSource(sourceId: string): Promise<{ ok: boolean; message: string }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to save sources." };
  }
  const src = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!src) return { ok: false, message: "Source not found." };
  const existing = await prisma.source.findFirst({
    where: { userId, identifier: src.identifier },
  });
  if (existing) return { ok: true, message: "Already in your sources." };

  await prisma.source.create({
    data: {
      userId,
      title: src.title,
      authors: src.authors,
      year: src.year,
      publisher: src.publisher,
      url: src.url,
      identifier: `${src.identifier ?? src.id}#${userId.slice(0, 8)}`,
      sourceType: src.sourceType,
      abstract: src.abstract,
      scopeNote: src.scopeNote,
      quality: (src.quality ?? undefined) as never,
    },
  });
  await recordActivity({
    userId,
    kind: "evidence",
    activity: "evidence_save",
    detail: { sourceId },
  }).catch(() => null);
  refresh("/research");
  return { ok: true, message: "Added to your sources." };
}

export async function removeSource(sourceId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const userId = await requireUserId();
    await prisma.source.deleteMany({ where: { id: sourceId, userId } });
    refresh("/research");
    return { ok: true, message: "Removed." };
  } catch {
    return { ok: false, message: "Sign in to manage sources." };
  }
}

export async function markImportant(sourceId: string, important: boolean): Promise<{ ok: boolean }> {
  try {
    const userId = await requireUserId();
    await prisma.source.updateMany({ where: { id: sourceId, userId }, data: { important } });
    refresh("/research");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function moveToProject(sourceId: string, project: string): Promise<{ ok: boolean; message: string }> {
  try {
    const userId = await requireUserId();
    await prisma.source.updateMany({
      where: { id: sourceId, userId },
      data: { project: project.trim().slice(0, 80) || null },
    });
    refresh("/research");
    return { ok: true, message: project.trim() ? `Moved to ${project.trim()}.` : "Removed from project." };
  } catch {
    return { ok: false, message: "Sign in to organize sources." };
  }
}

/** One-click citation copy in three styles, from stored metadata only. */
export async function citeSource(
  sourceId: string,
  style: CitationStyle
): Promise<{ ok: boolean; citation: string }> {
  const src = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!src) return { ok: false, citation: "" };
  return {
    ok: true,
    citation: formatCitation(
      { title: src.title, authors: src.authors, year: src.year, publisher: src.publisher, url: src.url },
      style
    ),
  };
}

/**
 * Evidence summary: plain-language synthesis across the student's chosen
 * sources, with a citation after every claim group.
 */
export async function evidenceSummary(
  sourceIds: string[],
  focus: string
): Promise<{ ok: boolean; message: string; summary?: string; citations?: string[] }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to generate summaries." };
  }
  if (!sourceIds.length) return { ok: false, message: "Pick at least one source first." };
  if (!focus.trim()) return { ok: false, message: "Say what the summary should focus on." };

  const sources = await prisma.source.findMany({
    where: { id: { in: sourceIds.slice(0, 6) }, OR: [{ userId }, { userId: null }] },
  });
  if (!sources.length) return { ok: false, message: "Those sources weren't found." };

  const provider = getProvider();
  const material = sources
    .map((s) => {
      const q = (s.quality ?? {}) as { takeaways?: string[] };
      return `SOURCE: ${s.title} (${s.publisher ?? "unknown publisher"}, ${s.year ?? "no date"})\n${(q.takeaways ?? []).join("\n")}`;
    })
    .join("\n\n");

  const g = await provider.generate({
    kind: "summary",
    sourceText: material.slice(0, 5000),
    topic: focus.slice(0, 160),
    level: "student",
    detailLevel: 3,
    style: "simple",
    format: "markdown",
    difficulty: 3,
  });
  const body = g.body as { overview?: string; keyPoints?: string[] };
  const summary = [body.overview, ...(body.keyPoints ?? []).map((k) => `• ${k}`)]
    .filter(Boolean)
    .join("\n");
  const citations = sources.map((s) =>
    formatCitation({ title: s.title, authors: s.authors, year: s.year, publisher: s.publisher, url: s.url }, "apa")
  );

  await recordActivity({
    userId,
    kind: "evidence",
    activity: "evidence_summary",
    detail: { sources: sources.map((s) => s.id), focus: focus.slice(0, 120) },
  }).catch(() => null);

  // Say which engine wrote this. If Claude was unavailable the summary silently
  // becomes a deterministic template, and the student should know that (PRD §4.3).
  const engine = provider.isLive ? "Claude" : "the offline template";
  return {
    ok: true,
    message: `Summary drafted by ${engine} — check every claim against the full texts before citing.`,
    summary,
    citations,
  };
}

/** Develop a research question: topic in, evidence-based questions out. */
export async function suggestQuestions(
  topic: string
): Promise<{ ok: boolean; message: string; questions?: string[] }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to develop questions." };
  }
  const t = topic.trim().slice(0, 160);
  if (t.length < 3) return { ok: false, message: "Say the topic in a few words first." };

  const provider = getProvider();
  const g = await provider.generate({
    kind: "questions",
    sourceText: `Research gaps and open questions around: ${t}. Consider population, intervention, comparison and outcome framings.`,
    topic: t,
    level: "student",
    detailLevel: 4,
    style: "examples",
    format: "markdown",
    difficulty: 3,
  });
  const list = (g.body ?? []) as Array<{ stem?: string; explanation?: string }>;
  const questions = (Array.isArray(list) ? list : []).map((q) => String(q.stem ?? "")).filter(Boolean).slice(0, 5);

  await recordActivity({ userId, kind: "evidence", activity: "research_question", detail: { topic: t } }).catch(
    () => null
  );
  if (!questions.length) return { ok: false, message: "We couldn't draft questions. Try again." };
  return { ok: true, message: "Here are some starting points — refine one, then save it.", questions };
}

/** Save a research question into Biostatistics (project area). */
export async function saveResearchQuestion(
  text: string,
  topic: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const userId = await requireUserId();
    const clean = text.trim().slice(0, 500);
    if (!clean) return { ok: false, message: "Nothing to save." };
    await prisma.artifact.create({
      data: {
        userId,
        kind: "research_question",
        title: `Research question — ${topic.slice(0, 60)}`,
        body: { question: clean, topic, status: "draft" },
        detailLevel: 3,
        style: "simple",
        format: "markdown",
        difficulty: 3,
      },
    });
    refresh("/research");
    return { ok: true, message: "Saved — find it under Biostatistics." };
  } catch {
    return { ok: false, message: "Sign in to save questions." };
  }
}

/** Side-by-side comparison with agreement/disagreement explained. */
export async function compareSources(
  ids: string[]
): Promise<{ ok: boolean; message: string; comparison?: string }> {
  try {
    await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to compare sources." };
  }
  if (ids.length < 2) return { ok: false, message: "Pick two sources to compare." };
  const sources = await prisma.source.findMany({ where: { id: { in: ids.slice(0, 3) } } });
  if (sources.length < 2) return { ok: false, message: "Those sources weren't found." };

  const provider = getProvider();
  const material = sources
    .map((s) => {
      const q = (s.quality ?? {}) as { takeaways?: string[]; agreement?: string; limitations?: string };
      return `SOURCE: ${s.title} (${s.publisher}, ${s.year})\nTakeaways: ${(q.takeaways ?? []).join("; ")}\nStance: ${q.agreement ?? ""}\nLimits: ${q.limitations ?? ""}`;
    })
    .join("\n\n");
  const g = await provider.generate({
    kind: "explanation",
    sourceText: `Compare these sources: where do they agree, where do they disagree, and why?\n\n${material}`.slice(0, 4500),
    topic: "source comparison",
    level: "student",
    detailLevel: 4,
    style: "simple",
    format: "markdown",
    difficulty: 3,
  });
  const body = g.body as { points?: string[]; overview?: string };
  const comparison = [body.overview, ...((body.points ?? []).map((p) => `• ${p}`))].filter(Boolean).join("\n");
  return { ok: true, message: "Comparison ready.", comparison };
}
