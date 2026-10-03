import Link from "next/link";
import { conceptsFromMaterials, explainConcept, studiedSummary } from "@/app/research/biostat-actions";
import { STAT_LIBRARY } from "@/lib/biostat";
import { prisma } from "@/lib/prisma";
import {
  ConceptView,
  DataAnalyzer,
  ExplainBox,
  MaterialsConcepts,
  MethodologyChat,
  PaperReviewer,
  StudyPlanBuilder,
  TestPicker,
} from "@/components/research/biostat-client";

const CATEGORIES = ["Descriptive", "Hypothesis Testing", "Comparative Tests", "Relationships", "Epidemiological Measures", "Study Designs"];

const STARTERS = [
  "I need to choose a statistical test",
  "Help me understand p-values",
  "Review a research paper",
  "Explain regression",
];

/**
 * Biostatistics sub-tab (RESEARCH_SPEC.md §3): library, test picker, data
 * analysis, paper review, methodology, study-plan builder, history.
 */
export async function BiostatTab({
  userId,
  concept,
  flow,
  docIds,
}: {
  userId: string | null;
  concept?: string;
  flow?: string;
  docIds?: string[];
}) {
  const [summary, documents] = await Promise.all([
    studiedSummary(),
    userId
      ? prisma.document.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, title: true } })
      : Promise.resolve([]),
  ]);

  if (concept) {
    const content = await explainConcept(concept);
    if (!content) {
      return (
        <div className="alert alert-danger">
          Concept not found. <Link href="/research?tab=biostat">Back to the library</Link>
        </div>
      );
    }
    return <ConceptView slug={concept} content={content} signedIn={!!userId} />;
  }

  if (flow === "test") return <TestPicker />;
  if (flow === "data") return <DataAnalyzer signedIn={!!userId} />;
  if (flow === "paper") return <PaperReviewer signedIn={!!userId} documents={documents} />;
  if (flow === "method") return <MethodologyChat signedIn={!!userId} />;
  if (flow === "design") return <StudyPlanBuilder signedIn={!!userId} />;
  if (flow === "question") {
    return (
      <div style={{ maxWidth: 680 }}>
        <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
          ← Biostatistics
        </Link>
        <h2 className="display-sm" style={{ marginBottom: "var(--sp-3)" }}>
          Plan a research question
        </h2>
        <p className="card-sub">
          Refine a question against evidence gaps, feasibility, your level and your course — then
          save it.
        </p>
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Link className="btn btn-primary" href="/research?tab=evidence&view=rq">
            Develop a research question
          </Link>
        </div>
      </div>
    );
  }

  const matched = docIds?.length ? await conceptsFromMaterials(docIds).catch(() => null) : null;

  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <ExplainBox signedIn={!!userId} />

      <section>
        <div className="grid grid-2">
          <Link className="surface" href="/research?tab=biostat&flow=design">
            <span className="display-lg">Start a Research Project</span>
            <p className="card-sub" style={{ marginTop: 4, marginBottom: 0 }}>
              Design, data, paper, methods or question — guided step by step.
            </p>
          </Link>
          <Link className="surface" href="/research?tab=biostat&flow=data">
            <span className="display-lg">Analyze Data or a Paper</span>
            <p className="card-sub" style={{ marginTop: 4, marginBottom: 0 }}>
              Upload a table or a paper and get a guided interpretation.
            </p>
          </Link>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Project flows</h2>
        </div>
        <div className="grid grid-3">
          {[
            ["design", "Designing a Study", "Goal to ethics, ending in a plan document."],
            ["data", "Analyzing Data", "Upload a table, get descriptives and next steps."],
            ["paper", "Reviewing a Paper", "Summary, methods, findings, quality."],
            ["method", "Writing Methodology", "Chat review ending in a clean section."],
            ["question", "Research Question", "Refine and save a question."],
            ["test", "Choose a Test", "Variables in, test recommendation out."],
          ].map(([f, title, sub]) => (
            <Link key={f} className="surface-tight" href={`/research?tab=biostat&flow=${f}`}>
              <span className="list-title">{title}</span>
              <p className="list-sub" style={{ margin: "4px 0 0" }}>{sub}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Quick topics — statistics library</h2>
        </div>
        {CATEGORIES.map((cat) => (
          <div key={cat} style={{ marginBottom: "var(--sp-5)" }}>
            <h3 className="card-title">{cat}</h3>
            <div className="chips" style={{ marginTop: "var(--sp-2)" }}>
              {STAT_LIBRARY.filter((t) => t.category === cat).map((t) => (
                <Link
                  key={t.slug}
                  className="chip chip-sm"
                  href={`/research?tab=biostat&concept=${t.slug}`}
                  style={{ textDecoration: "none" }}
                >
                  {t.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {userId && documents.length > 0 ? (
        <MaterialsConcepts documents={documents} initial={matched?.matches ?? null} />
      ) : null}

      {(summary.recent.length > 0 || summary.studied.length > 0) && userId ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">Your statistics</h2>
          </div>
          {summary.recent.length > 0 ? (
            <div className="chips" style={{ marginBottom: "var(--sp-3)" }} aria-label="Recently viewed">
              {summary.recent.map((r) => (
                <span key={r.slug} className="tag">
                  {r.slug.replace(/-/g, " ")} · {r.when}
                </span>
              ))}
            </div>
          ) : null}
          <div className="row">
            {summary.studied.map((s) => (
              <span key={s.activity} className="tag">
                {s.activity.replace(/_/g, " ")} × {s.count}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section className="surface">
          <h2 className="display-lg">Where to begin</h2>
          <div className="chips" style={{ marginTop: "var(--sp-3)" }}>
            {STARTERS.map((s) => (
              <Link
                key={s}
                className="chip"
                href={
                  s.includes("test")
                    ? "/research?tab=biostat&flow=test"
                    : s.includes("p-values")
                      ? "/research?tab=biostat&concept=p-value"
                      : s.includes("paper")
                        ? "/research?tab=biostat&flow=paper"
                        : "/research?tab=biostat&concept=regression"
                }
                style={{ textDecoration: "none" }}
              >
                {s}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
