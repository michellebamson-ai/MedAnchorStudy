import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { EvidenceTab } from "@/components/research/evidence-tab";
import { BiostatTab } from "@/components/research/biostat-tab";

export const metadata = { title: "Research" };

const TABS = [
  { id: "evidence", label: "Evidence" },
  { id: "biostat", label: "Biostatistics" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Research hub (RESEARCH_SPEC.md): find reliable evidence, master
 * biostatistics, analyze data, complete research projects.
 */
export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "evidence";
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));
  const userId = user?.id ?? null;

  return (
    <Shell section="research" name={user?.name ?? "Student"} topics={searchTopics}>
      <div className="page-head">
        <span className="eyebrow">Study it. Practice it. Anchor it.</span>
        <h1 className="display">Research</h1>
        <p className="lede">
          Find reliable health evidence, master biostatistics, analyze data, and complete
          research projects — with every claim cited and every limit stated.
        </p>
      </div>

      <nav className="subtabs" aria-label="Research sections" style={{ marginBottom: "var(--sp-10)" }}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "evidence" ? "/research" : `/research?tab=${t.id}`}
            className="subtab"
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "evidence" ? (
        <EvidenceTab
          userId={userId}
          q={str(params.q) ?? ""}
          filter={str(params.filter) ?? "all"}
          sourceId={str(params.source)}
          view={str(params.view)}
          compare={str(params.compare)}
        />
      ) : (
        <BiostatTab
          userId={userId}
          concept={str(params.concept)}
          flow={str(params.flow)}
          docIds={undefined}
        />
      )}
    </Shell>
  );
}
