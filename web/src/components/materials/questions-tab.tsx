import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { masteryOverview } from "@/lib/mastery";
import { QuestionsClient, type BankQuestion, type PastSet } from "@/components/materials/questions-client";

/**
 * Practice Questions tab (MATERIALS_SPEC.md §6): setup (material, topics with
 * Needs-review marks, type, difficulty, count), runner with hints and
 * annotated answers, results with wrong-to-flashcards, and past sets.
 */
export async function QuestionsTab({
  userId,
  documents,
  topics,
}: {
  userId: string | null;
  documents: Array<{ id: string; title: string; kind: string; subject: string | null }>;
  topics: Array<{ slug: string; title: string }>;
}) {
  if (!userId) {
    return (
      <div className="surface" style={{ maxWidth: 560 }}>
        <h2 className="display-lg">Questions live here</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Sign in to build practice sets from your materials — and to keep your scores.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <a className="btn btn-primary" href="/login">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const [bank, attempts, mastery, imageDocs] = await Promise.all([
    prisma.question.findMany({
      where: { OR: [{ document: { userId } }, { documentId: null }] },
      include: { topic: { select: { slug: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.quizAttempt.findMany({
      where: { userId, sessionId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { question: { select: { id: true, stem: true } } },
    }),
    masteryOverview(userId),
    prisma.document.findMany({
      where: { userId, kind: "image" },
      select: { id: true, title: true, subject: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const weak = new Set(mastery.filter((m) => m.status !== "strong").map((m) => m.topicSlug));

  const bankQuestions: BankQuestion[] = bank.map((q) => ({
    id: q.id,
    stem: q.stem,
    choices: Array.isArray(q.choices) ? (q.choices as string[]) : [],
    answerIndex: q.answerIndex,
    explanation: q.explanation,
    topicSlug: q.topic?.slug ?? null,
    topicTitle: q.topic?.title ?? null,
    sourcePage: q.sourcePage,
    difficulty: q.difficulty,
    documentId: q.documentId,
  }));

  // Group attempts into past sets.
  const bySession = new Map<string, typeof attempts>();
  for (const a of attempts) {
    if (!a.sessionId) continue;
    const list = bySession.get(a.sessionId) ?? [];
    list.push(a);
    bySession.set(a.sessionId, list);
  }
  const pastSets: PastSet[] = [...bySession.entries()].slice(0, 8).map(([sessionId, list]) => {
    const correct = list.filter((a) => a.correct).length;
    const first = list[list.length - 1];
    return {
      sessionId,
      date: first.createdAt.toISOString(),
      total: list.length,
      correct,
      questionIds: list.map((a) => a.questionId).filter((id): id is string => !!id),
      wrongIds: list.filter((a) => !a.correct).map((a) => a.questionId).filter((id): id is string => !!id),
    };
  });

  const topicOptions = topics.map((t) => ({
    slug: t.slug,
    title: t.title,
    weak: weak.has(t.slug),
    count: bankQuestions.filter((q) => q.topicSlug === t.slug).length,
  }));

  return (
    <QuestionsClient
      documents={documents.map((d) => ({ id: d.id, title: d.title }))}
      imageDocs={imageDocs}
      topicOptions={topicOptions}
      bank={bankQuestions}
      pastSets={pastSets}
      emptyHint={
        bankQuestions.length === 0 ? (
          <div className="surface" style={{ textAlign: "center" }}>
            <h3 className="display-lg">No questions yet</h3>
            <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
              Questions show up here after you analyze a material.
            </p>
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Link className="btn btn-primary btn-sm" href="/materials?tab=analyze">
                Go to Analyze Docs
              </Link>
            </div>
          </div>
        ) : null
      }
    />
  );
}
