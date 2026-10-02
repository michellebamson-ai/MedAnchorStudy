import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AnalyzeButton, GeneratePanel } from "@/components/materials/analyze-client";

const KIND_TITLES: Record<string, string> = {
  topic: "Topics and subtopics",
  concept: "Key concepts",
  definition: "Definitions",
  formula: "Formulas",
  table: "Tables",
  diagram: "Diagrams",
  fact: "Important facts",
  link: "How ideas connect",
  hard: "Hard areas",
  term: "Course words",
};

const KIND_ORDER = ["topic", "concept", "definition", "formula", "table", "diagram", "fact", "link", "hard", "term"];

/**
 * Analyze Docs (MATERIALS_SPEC.md §2). Shows what the app found in the
 * material, then lets the student choose what to make from it.
 */
export async function AnalyzeTab({
  signedIn,
  documents,
  selectedId,
}: {
  signedIn: boolean;
  documents: Array<{ id: string; title: string; kind: string; subject: string | null; status: string; error: string | null }>;
  selectedId?: string;
}) {
  if (!signedIn) {
    return (
      <div className="surface" style={{ maxWidth: 560 }}>
        <h2 className="display-lg">First, add a material</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Analysis needs something to read. Upload a lecture, then come back here.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Link className="btn btn-primary" href="/materials?tab=upload">
            Upload a material
          </Link>
        </div>
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="surface" style={{ maxWidth: 560, textAlign: "center" }}>
        <h2 className="display-lg">Upload a material first</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          There is nothing to read yet.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Link className="btn btn-primary" href="/materials?tab=upload">
            Upload
          </Link>
        </div>
      </div>
    );
  }

  const selected = documents.find((d) => d.id === selectedId) ?? documents[0];
  const concepts = await prisma.docConcept.findMany({
    where: { documentId: selected.id },
    orderBy: [{ confidence: "desc" }],
  });

  const grouped = new Map<string, typeof concepts>();
  for (const c of concepts) {
    const list = grouped.get(c.kind) ?? [];
    list.push(c);
    grouped.set(c.kind, list);
  }

  const counts: Record<string, number> = {};
  for (const [kind, list] of grouped) counts[kind] = list.length;

  return (
    <div className="stack-lg">
      <section>
        <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
          <h2 className="display-lg">Analyze Docs</h2>
        </div>
        <div className="chips" role="group" aria-label="Choose material">
          {documents.map((d) => (
            <Link
              key={d.id}
              href={`/materials?tab=analyze&doc=${d.id}`}
              className="chip"
              aria-pressed={d.id === selected.id}
              style={d.id === selected.id ? undefined : { textDecoration: "none" }}
            >
              {d.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="row-between" style={{ gap: "var(--sp-4)" }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              {selected.title}
            </h3>
            <p className="list-sub" style={{ marginTop: 4 }}>
              {[selected.subject, selected.kind].filter(Boolean).join(" · ")}
            </p>
          </div>
          <AnalyzeButton documentId={selected.id} analyzed={selected.status === "analyzed"} />
        </div>

        {selected.error === "unreadable" ? (
          <div className="alert alert-warn" style={{ marginTop: "var(--sp-4)" }}>
            We can’t read this kind of file yet. Paste the text instead — the Upload tab has a
            “Paste text” option — and the whole pipeline will work.
          </div>
        ) : null}
        {selected.error === "too-short" ? (
          <div className="alert alert-warn" style={{ marginTop: "var(--sp-4)" }}>
            We couldn’t find topics in this file. Try another file.
          </div>
        ) : null}
        {selected.error === "failed" ? (
          <div className="alert alert-danger" style={{ marginTop: "var(--sp-4)" }}>
            We couldn’t finish reading this. Try again.
          </div>
        ) : null}

        {selected.status !== "analyzed" && !selected.error ? (
          <p className="card-sub" style={{ marginTop: "var(--sp-4)", marginBottom: 0 }}>
            Not analyzed yet. Press <b>Analyze</b> and we’ll read it: topics, key ideas,
            definitions, formulas, tables, diagrams and how ideas connect.
          </p>
        ) : null}

        {concepts.length > 0 ? (
          <div style={{ marginTop: "var(--sp-6)" }}>
            <span className="eyebrow">What we found</span>
            <div className="grid grid-4" style={{ marginBottom: "var(--sp-6)" }}>
              {KIND_ORDER.filter((k) => counts[k]).map((k) => (
                <div key={k} className="surface-tight" style={{ textAlign: "center" }}>
                  <div className="stat-value" style={{ fontSize: "var(--fs-xl)" }}>
                    {counts[k]}
                  </div>
                  <div className="list-sub">{KIND_TITLES[k]}</div>
                </div>
              ))}
            </div>

            {KIND_ORDER.filter((k) => grouped.get(k)?.length).map((k) => (
              <div key={k} className="finding-group">
                <h3>{KIND_TITLES[k]}</h3>
                <div className="finding-list">
                  {(grouped.get(k) ?? []).slice(0, k === "topic" ? 12 : 8).map((c) =>
                    k === "formula" ? (
                      <div key={c.id} className="formula-box">
                        {c.label}
                      </div>
                    ) : (
                      <div key={c.id} className="finding">
                        {k === "topic" ? (
                          <span className="tick" data-done="true" aria-hidden="true">
                            ✓
                          </span>
                        ) : null}
                        <span>
                          <b>{c.label}</b>
                          {c.detail ? <span className="finding-detail"> — {c.detail}</span> : null}
                          {k === "hard" ? <span className="tag tag-review" style={{ marginLeft: 8 }}>Hard</span> : null}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {concepts.length > 0 ? (
        <GeneratePanel
          documentId={selected.id}
          topics={(grouped.get("topic") ?? []).map((t) => t.label)}
        />
      ) : null}
    </div>
  );
}
