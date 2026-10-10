"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/provider";
import { recordActivity } from "@/lib/mastery";
import { formatCitation, type CitationStyle } from "@/lib/citations";
import { searchLiterature } from "@/lib/literature";

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

/**
 * Which stored types answer each filter, and which live providers run.
 *
 * "scholar" is deliberately not labelled "Google Scholar": there is no public
 * Scholar API, so querying it is not possible. The scholarly literature is
 * searched through OpenAlex and Crossref, which index the same papers.
 */
const FILTER_TYPES: Record<SourceFilter, string[] | null> = {
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
  /** True when this hit came from PubMed/Crossref/OpenAlex rather than the shelf. */
  live?: boolean;
  provider?: string;
  doi?: string | null;
  citationCount?: number | null;
}

/** A live hit is not a database row, so it is passed whole and saved on click. */
export interface LiteratureSaveInput {
  title: string;
  authors: string | null;
  year: number | null;
  venue: string | null;
  url: string | null;
  doi: string | null;
  abstract: string | null;
  sourceType: string;
  provider: string;
}

/**
 * Search live bibliographic APIs, plus the curated library and the student's
 * own saved sources.
 *
 * Live results come first — a student asking about this year's evidence wants
 * this year's papers. The curated shelf still appears underneath, because those
 * entries carry the quality notes the APIs cannot supply.
 *
 * The note always states which providers actually answered. If PubMed timed
 * out, the student is told rather than shown a quietly smaller result set.
 */
export async function searchEvidence(query: string, filter: SourceFilter = "all"): Promise<{
  hits: EvidenceHit[];
  note: string;
  liveAvailable: boolean;
}> {
  const user = await getCurrentUser().catch(() => null);
  const q = query.trim();
  if (!q) return { hits: [], note: "", liveAvailable: false };

  const types = FILTER_TYPES[filter];
  // Match any significant word — students type phrases, not titles.
  const words = q
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !["the", "and", "for", "with", "from"].includes(w))
    .slice(0, 6);
  if (!words.length) return { hits: [], note: "", liveAvailable: false };
  const wordOr = words.flatMap((w) => [
    { title: { contains: w, mode: "insensitive" as const } },
    { abstract: { contains: w, mode: "insensitive" as const } },
    { publisher: { contains: w, mode: "insensitive" as const } },
  ]);

  // Textbooks are not indexed by the live APIs in a useful way.
  const wantLive = filter !== "textbooks";

  const [library, mine, live] = await Promise.all([
    prisma.source.findMany({
      where: {
        userId: null,
        ...(types ? { sourceType: { in: types } } : {}),
        OR: wordOr,
      },
      orderBy: { year: "desc" },
      take: 20,
    }),
    user
      ? prisma.source.findMany({
          where: { userId: user.id, OR: wordOr },
          take: 10,
        })
      : Promise.resolve([]),
    wantLive ? searchLiterature(q, 12) : Promise.resolve(null),
  ]);

  const savedIds = new Set(mine.map((m) => m.identifier).filter(Boolean));

  const liveHits: EvidenceHit[] = (live?.hits ?? []).map((h) => ({
    id: `live:${h.provider}:${h.identifier}`,
    title: h.title,
    authors: h.authors,
    year: h.year,
    publisher: h.venue,
    sourceType: h.sourceType,
    snippet: h.abstract ?? "",
    saved: false,
    mine: false,
    live: true,
    provider: h.provider,
    url: h.url,
    doi: h.doi,
    citationCount: h.citationCount,
  }));

  // Don't show a live hit the student has already saved under a different id.
  const liveKeys = new Set(
    (live?.hits ?? [])
      .map((h) => (h.doi ?? h.title).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 60))
      .filter(Boolean)
  );

  const hits: EvidenceHit[] = [
    ...mine.map((m) => toHit(m, true, true)),
    ...liveHits,
    ...library
      .filter((l) => !savedIds.has(l.identifier))
      .filter((l) => !liveKeys.has((l.url ?? "").replace(/^https?:\/\/doi\.org\//, "").toLowerCase()))
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

  return { hits, note: buildNote(live), liveAvailable: !!live?.hits.length };
}

function buildNote(live: Awaited<ReturnType<typeof searchLiterature>> | null): string {
  if (!live) {
    return "Searching the curated library — it is a small shelf of well-annotated sources, not a full database.";
  }
  if (!live.ok.length) {
    return "Live databases could not be reached just now, so these are from the curated library. Try again in a moment.";
  }
  const names = live.ok.map((p) => (p === "pubmed" ? "PubMed" : p === "crossref" ? "Crossref" : "OpenAlex"));
  const base = `Live results from ${names.join(" and ")}, plus the curated shelf.`;
  if (!live.failed.length) return base;
  const down = live.failed.map((f) => `${f.provider} (${f.reason})`).join(", ");
  return `${base} Not reachable this time: ${down}.`;
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

/**
 * Save a live hit from PubMed/Crossref/OpenAlex into My Sources.
 *
 * These arrive as search results, not database rows, so the metadata travels
 * with the request. The provider and "metadata only, not full text" scope note
 * are persisted, because a student citing this later needs to know where the
 * record came from and that the app never read the paper.
 */
export async function saveLiteratureHit(input: LiteratureSaveInput): Promise<{ ok: boolean; message: string }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to save sources." };
  }

  const title = String(input.title ?? "").trim().slice(0, 500);
  if (!title) return { ok: false, message: "That result has no title, so it cannot be saved." };

  const provider = String(input.provider ?? "live").slice(0, 20);
  const identifier = `live:${provider}:${(input.doi ?? title).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 80)}#${userId.slice(0, 8)}`;

  const existing = await prisma.source.findFirst({ where: { userId, identifier } });
  if (existing) return { ok: true, message: "Already in your sources." };

  await prisma.source.create({
    data: {
      userId,
      title,
      authors: input.authors?.slice(0, 500) ?? null,
      year: typeof input.year === "number" ? input.year : null,
      publisher: input.venue?.slice(0, 300) ?? null,
      url: input.url?.slice(0, 500) ?? null,
      identifier,
      sourceType: String(input.sourceType ?? "peer_reviewed").slice(0, 40),
      abstract: input.abstract?.slice(0, 4000) ?? null,
      scopeNote: `Saved from ${provider} search on ${new Date().toLocaleDateString("en-GB")}. Bibliographic metadata and abstract only — the full text was not retrieved or read.`,
      quality: {
        provider,
        doi: input.doi ?? null,
      } as never,
    },
  });

  await recordActivity({
    userId,
    kind: "evidence",
    activity: "evidence_save",
    detail: { provider, title: title.slice(0, 80) },
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
  const engine = provider.isLive ? provider.name : "the offline template";
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
