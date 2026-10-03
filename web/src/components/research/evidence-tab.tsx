import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EvidenceSearch } from "@/components/research/evidence-search";
import { SourceDetail } from "@/components/research/evidence-detail";
import { MySources, CompareView, RQTool } from "@/components/research/evidence-sources";

export const FILTERS = [
  ["pubmed", "PubMed"],
  ["scholar", "Google Scholar"],
  ["guidelines", "Guidelines"],
  ["news", "News"],
  ["textbooks", "Textbooks"],
  ["all", "All Sources"],
] as const;

/**
 * Evidence tab (RESEARCH_SPEC.md §2): search → read → save → compare →
 * summarize, plus the research-question tool.
 */
export async function EvidenceTab({
  userId,
  q,
  filter,
  sourceId,
  view,
  compare,
}: {
  userId: string | null;
  q: string;
  filter: string;
  sourceId?: string;
  view?: string;
  compare?: string;
}) {
  if (view === "sources") {
    return <MySourcesView userId={userId} />;
  }
  if (view === "rq") {
    return <RQTool signedIn={!!userId} />;
  }
  if (compare) {
    return <CompareSection userId={userId} ids={compare.split(",").filter(Boolean).slice(0, 3)} />;
  }
  if (sourceId) {
    return <SourceDetailSection userId={userId} sourceId={sourceId} />;
  }
  return <EvidenceSearch userId={userId} initialQ={q} initialFilter={filter} />;
}

async function SourceDetailSection({ userId, sourceId }: { userId: string | null; sourceId: string }) {
  const src = await prisma.source.findFirst({
    where: { id: sourceId, OR: [{ userId: null }, ...(userId ? [{ userId }] : [])] },
  });
  if (!src) {
    return (
      <div className="alert alert-danger">
        Source not found. <Link href="/research?tab=evidence">Back to search</Link>
      </div>
    );
  }
  // "More by this author": same author string, other sources.
  const more = src.authors
    ? await prisma.source.findMany({
        where: { id: { not: src.id }, userId: null, authors: { contains: src.authors.split(",")[0].slice(0, 30), mode: "insensitive" } },
        take: 4,
        select: { id: true, title: true, year: true },
      })
    : [];
  const saved = userId
    ? await prisma.source.findFirst({ where: { userId, identifier: src.identifier } })
    : null;
  return <SourceDetail source={src} savedId={saved?.id ?? null} more={more} signedIn={!!userId} />;
}

async function MySourcesView({ userId }: { userId: string | null }) {
  if (!userId) {
    return (
      <div className="surface" style={{ maxWidth: 560 }}>
        <h2 className="display-lg">Your sources live here</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Sign in to save and organize sources.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Link className="btn btn-primary" href="/login">
            Sign in
          </Link>
        </div>
      </div>
    );
  }
  const sources = await prisma.source.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return <MySources sources={sources} />;
}

async function CompareSection({ userId, ids }: { userId: string | null; ids: string[] }) {
  const sources = await prisma.source.findMany({ where: { id: { in: ids } }, take: 3 });
  if (sources.length < 2) {
    return (
      <div className="alert alert-warn">
        Pick two sources to compare. <Link href="/research?tab=evidence">Back to search</Link>
      </div>
    );
  }
  return <CompareView sources={sources} signedIn={!!userId} />;
}
