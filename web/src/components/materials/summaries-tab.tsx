import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArtifactBody, SourceLabel, plainTextOf } from "@/components/materials/artifact-view";
import { DeriveButtons, StarButton } from "@/components/materials/artifact-actions";
import { ListenButton } from "@/components/materials/listen-button";

const SUMMARY_KINDS = ["summary", "quick_review"];

/**
 * Summaries tab (MATERIALS_SPEC.md §4): high-yield one-pagers and 2-minute
 * quick reviews, with listen + speed control and captions via visible text.
 */
export async function SummariesTab({
  userId,
  q,
  summaryId,
  view,
}: {
  userId: string | null;
  q: string;
  summaryId?: string;
  view?: string;
}) {
  if (!userId) {
    return (
      <div className="surface" style={{ maxWidth: 560 }}>
        <h2 className="display-lg">Summaries live here</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Sign in, analyze a material, and your high-yield summaries will appear.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <a className="btn btn-primary" href="/login">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const term = q.trim().toLowerCase();
  const summaries = await prisma.artifact.findMany({
    where: {
      userId,
      kind: { in: SUMMARY_KINDS },
      ...(term ? { title: { contains: term, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { document: { select: { id: true, title: true, subject: true } } },
  });

  const open = summaryId ? summaries.find((s) => s.id === summaryId) : null;
  if (open) {
    return <SummaryReader summary={open} view={view === "quick" ? "quick" : "full"} />;
  }

  return (
    <div className="stack-lg">
      <section>
        <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
          <h2 className="display-lg">Summaries</h2>
        </div>
        {summaries.length === 0 ? (
          <div className="surface" style={{ textAlign: "center" }}>
            <h3 className="display-lg">No summaries yet</h3>
            <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
              Summaries show up here after you analyze a material.
            </p>
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Link className="btn btn-primary btn-sm" href="/materials?tab=analyze">
                Go to Analyze Docs
              </Link>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            {summaries.map((s) => (
              <div key={s.id} className="doc-row">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Link className="list-title" href={`/materials?tab=summaries&summary=${s.id}`}>
                    {s.title}
                  </Link>
                  <span className="list-sub" style={{ display: "block" }}>
                    {[s.document?.subject, s.createdAt.toLocaleDateString(), "~2 min read"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span className="tag">
                      {s.kind === "quick_review" ? "Quick review" : "High-yield summary"}
                    </span>
                  </span>
                </span>
                <StarButton artifactId={s.id} favorite={s.favorite} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryReader({
  summary,
  view,
}: {
  summary: {
    id: string;
    title: string;
    kind: string;
    body: unknown;
    favorite: boolean;
    createdAt: Date;
    document: { id: string; title: string; subject: string | null } | null;
  };
  view: "full" | "quick";
}) {
  const body = (summary.body ?? {}) as Record<string, unknown>;
  const text = plainTextOf(body);
  const facts = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 12)
    .slice(0, 8);

  return (
    <div style={{ maxWidth: 760 }}>
      <Link
        className="btn btn-ghost btn-sm"
        href="/materials?tab=summaries"
        style={{ marginBottom: "var(--sp-4)" }}
      >
        ← All summaries
      </Link>
      <span className="eyebrow">{summary.document?.title ?? "Summary"}</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-2)" }}>
        {summary.title}
      </h2>
      <div className="row" style={{ gap: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        <SourceLabel body={body} examNote={typeof body.examNote === "string" ? body.examNote : null} />
        <StarButton artifactId={summary.id} favorite={summary.favorite} />
      </div>

      <div className="row" style={{ marginBottom: "var(--sp-5)" }}>
        <Link
          className="chip chip-sm"
          aria-pressed={view === "full"}
          href={`/materials?tab=summaries&summary=${summary.id}`}
          style={{ textDecoration: "none" }}
        >
          High-yield
        </Link>
        <Link
          className="chip chip-sm"
          aria-pressed={view === "quick"}
          href={`/materials?tab=summaries&summary=${summary.id}&view=quick`}
          style={{ textDecoration: "none" }}
        >
          Quick review
        </Link>
      </div>

      {view === "quick" ? (
        <div className="note-body">
          <h4>Quick review — about 2 minutes</h4>
          <ul>
            {facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : (
        <ArtifactBody body={body} />
      )}

      <div className="stack-sm" style={{ marginTop: "var(--sp-6)" }}>
        <ListenButton text={text} rates />
        <DeriveButtons artifactId={summary.id} />
        <Link className="btn btn-ghost btn-sm" href="/teach">
          Ask the tutor →
        </Link>
      </div>
    </div>
  );
}
