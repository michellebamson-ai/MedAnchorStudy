import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { masteryOverview } from "@/lib/mastery";
import { listCases, type PlayCase } from "@/app/practice/case-actions";
import { CasesTab, type CasesData } from "@/components/practice/cases-tab";
import { PracticeQuestions, type PracticeQData } from "@/components/practice/practice-questions";
import { CommTab } from "@/components/practice/comm-tab";

export const metadata = { title: "Practice" };

const TABS = [
  { id: "cases", label: "Cases" },
  { id: "questions", label: "Questions" },
  { id: "communicate", label: "Communication" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Practice hub (PRACTICE_SPEC.md): use what was learned. Cases, mixed
 * questions and role-play — all shaped by weak spots, all feeding Progress.
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "cases";

  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  if (!user) {
    return (
      <Shell section="practice" topics={searchTopics}>
        <PracticeHead tab={tab} />
        <div className="surface" style={{ maxWidth: 560 }}>
          <h2 className="display-lg">Sign in to practise</h2>
          <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
            Cases, mixed question sets and role-play adapt to your weak spots — which live on
            your account.
          </p>
          <div style={{ marginTop: "var(--sp-5)" }}>
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell section="practice" name={user.name ?? "Student"} topics={searchTopics}>
      <PracticeHead tab={tab} />
      {tab === "cases" ? <CasesSection userId={user.id} /> : null}
      {tab === "questions" ? <QuestionsSection userId={user.id} topics={topics} /> : null}
      {tab === "communicate" ? <CommSection userId={user.id} soap={params.soap === "1"} /> : null}
    </Shell>
  );
}

function PracticeHead({ tab }: { tab: TabId }) {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Study it. Practice it. Anchor it.</span>
        <h1 className="display">Practice</h1>
        <p className="lede">
          Use what you learned — cases, questions and role-plays made from your materials and
          shaped by your weak spots.
        </p>
      </div>
      <nav className="subtabs" aria-label="Practice sections" style={{ marginBottom: "var(--sp-10)" }}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "cases" ? "/practice" : `/practice?tab=${t.id}`}
            className="subtab"
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

async function CasesSection({ userId }: { userId: string }) {
  const [{ suggested, all, unfinished }, documents] = await Promise.all([
    listCases().catch(() => ({ suggested: [], all: [], unfinished: null })),
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true },
    }),
  ]);
  const data: CasesData = {
    suggested: suggested as PlayCase[],
    all: all as PlayCase[],
    documents,
    unfinished,
  };
  return <CasesTab data={data} />;
}

async function QuestionsSection({
  userId,
  topics,
}: {
  userId: string;
  topics: Array<{ slug: string; title: string }>;
}) {
  const [bank, attempts, mastery, documents] = await Promise.all([
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
    }),
    masteryOverview(userId),
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true },
    }),
  ]);

  const weak = new Set(mastery.filter((m) => m.status !== "strong").map((m) => m.topicSlug));
  const bankMapped = bank.map((q) => ({
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

  const bySession = new Map<string, typeof attempts>();
  for (const a of attempts) {
    if (!a.sessionId) continue;
    const list = bySession.get(a.sessionId) ?? [];
    list.push(a);
    bySession.set(a.sessionId, list);
  }
  const pastSets = [...bySession.entries()].slice(0, 8).map(([sessionId, list]) => ({
    sessionId,
    date: list[list.length - 1].createdAt.toISOString(),
    total: list.length,
    correct: list.filter((a) => a.correct).length,
    questionIds: list.map((a) => a.questionId).filter((id): id is string => !!id),
    wrongIds: list.filter((a) => !a.correct).map((a) => a.questionId).filter((id): id is string => !!id),
  }));

  const data: PracticeQData = {
    bank: bankMapped,
    topicOptions: topics.map((t) => ({
      slug: t.slug,
      title: t.title,
      weak: weak.has(t.slug),
      count: bankMapped.filter((q) => q.topicSlug === t.slug).length,
    })),
    documents,
    pastSets,
  };
  return <PracticeQuestions data={data} />;
}

async function CommSection({ userId, soap }: { userId: string; soap: boolean }) {
  const { listScenarios } = await import("@/app/practice/comm-actions");
  const [{ scenarios, suggested }, documents, past] = await Promise.all([
    listScenarios().catch(() => ({ scenarios: [], suggested: [] })),
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true },
    }),
    prisma.commAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { scenario: { select: { title: true } } },
    }),
  ]);
  const { CommTab: Tab } = await import("@/components/practice/comm-tab");
  const historyScenario = scenarios.find((s) => s.kind === "history-taking") ?? scenarios[0] ?? null;
  return (
    <Tab
      scenarios={scenarios}
      suggested={suggested}
      documents={documents}
      past={past.map((p) => ({
        id: p.id,
        title: p.scenario.title,
        date: p.createdAt.toLocaleDateString(),
        overall: (p.scores as { overall?: number } | null)?.overall ?? null,
      }))}
      soapOnly={soap}
      soapScenario={historyScenario ? { scenarioId: historyScenario.id } : null}
    />
  );
}
