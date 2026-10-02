import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { UploadTab } from "@/components/materials/upload-tab";
import { AnalyzeTab } from "@/components/materials/analyze-tab";
import { NotesTab } from "@/components/materials/notes-tab";
import { SummariesTab } from "@/components/materials/summaries-tab";
import { FlashcardsTab } from "@/components/materials/flashcards-tab";
import { QuestionsTab } from "@/components/materials/questions-tab";

export const metadata = { title: "Materials" };

const TABS = [
  { id: "upload", label: "Upload" },
  { id: "analyze", label: "Analyze Docs" },
  { id: "notes", label: "Notes" },
  { id: "summaries", label: "Summaries" },
  { id: "flashcards", label: "Flashcards" },
  { id: "questions", label: "Practice Questions" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Materials — "Study it. Practice it. Anchor it." (MATERIALS_SPEC.md).
 * Upload → Analyze Docs → Notes, Summaries, Flashcards, Practice Questions.
 */
export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "upload";
  const docId = typeof params.doc === "string" ? params.doc : undefined;
  const q = typeof params.q === "string" ? params.q : "";
  const noteId = typeof params.note === "string" ? params.note : undefined;
  const made = typeof params.made === "string" ? params.made : undefined;
  const summaryId = typeof params.summary === "string" ? params.summary : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;
  const deck = typeof params.deck === "string" ? params.deck : undefined;
  const review = typeof params.review === "string" ? params.review : undefined;

  const user = await getCurrentUser();
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  const userId = user?.id ?? null;
  const [documents, subjects] = userId
    ? await Promise.all([
        prisma.document.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { artifacts: true, concepts: true } } },
        }),
        prisma.document
          .findMany({ where: { userId, subject: { not: null } }, select: { subject: true }, distinct: ["subject"] })
          .then((rows) => rows.map((r) => r.subject as string)),
      ])
    : [[], []];

  return (
    <Shell
      section="materials"
      name={user?.name ?? "Student"}
      topics={searchTopics}
      searchPlaceholder="Find a material by name…"
    >
      <div className="page-head">
        <span className="eyebrow">Study it. Practice it. Anchor it.</span>
        <h1 className="display">Materials</h1>
        <p className="lede">
          Everything starts here. Add your own material, the app reads it and builds study
          tools — and those tools feed the AI Tutor, Practice, Study Plan and Progress.
        </p>
      </div>

      <nav className="subtabs" aria-label="Materials sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/materials?tab=${t.id}`}
            className="subtab"
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="tab-body">
        {tab === "upload" ? (
          <UploadTab signedIn={!!userId} documents={documents} subjects={subjects} q={q} />
        ) : null}
        {tab === "analyze" ? (
          <AnalyzeTab signedIn={!!userId} documents={documents} selectedId={docId} />
        ) : null}
        {tab === "notes" ? <NotesTab userId={userId} q={q} noteId={noteId} made={made} docId={docId} /> : null}
        {tab === "summaries" ? <SummariesTab userId={userId} q={q} summaryId={summaryId} view={view} /> : null}
        {tab === "flashcards" ? <FlashcardsTab userId={userId} q={q} deck={deck} review={review} /> : null}
        {tab === "questions" ? <QuestionsTab userId={userId} documents={documents} topics={topics} /> : null}
      </div>
    </Shell>
  );
}
