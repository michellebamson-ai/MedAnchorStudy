"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { citeSource, saveSource } from "@/app/research/evidence-actions";
import type { CitationStyle } from "@/lib/citations";

type Quality = {
  label?: string;
  explanation?: string;
  funding?: string;
  limitations?: string;
  agreement?: string;
  takeaways?: string[];
};

export interface DetailSource {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  publisher: string | null;
  url: string | null;
  sourceType: string;
  abstract: string | null;
  scopeNote: string | null;
  quality: unknown;
}

/**
 * Source detail (RESEARCH_SPEC.md §2.3): quality label, takeaways, fit, use,
 * evaluation, and every action — save, explain-stats, tutor, assignment,
 * compare, three-style citations, more-by-author.
 */
export function SourceDetail({
  source,
  savedId,
  more,
  signedIn,
}: {
  source: DetailSource;
  savedId: string | null;
  more: Array<{ id: string; title: string; year: number | null }>;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [citation, setCitation] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const quality = (source.quality ?? {}) as Quality;
  const takeaways = quality.takeaways ?? [];

  async function loadCitation(s: CitationStyle) {
    setStyle(s);
    const res = await citeSource(source.id, s);
    if (res.ok) {
      setCitation(res.citation);
      setCopied(false);
    }
  }

  async function copy() {
    if (!citation) await loadCitation(style);
    const text = citation || (await citeSource(source.id, style).then((r) => r.citation));
    try {
      await navigator.clipboard.writeText(text);
      setCitation(text);
      setCopied(true);
    } catch {
      setCitation(text);
    }
  }

  function save() {
    start(async () => {
      const res = await saveSource(source.id);
      setMessage(res.message);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=evidence" style={{ marginBottom: "var(--sp-4)" }}>
        ← Search results
      </Link>

      <span className="eyebrow">{source.publisher ?? "Source"}</span>
      <h1 className="display-sm" style={{ marginBottom: "var(--sp-2)" }}>
        {source.title}
      </h1>
      <p className="list-sub">
        {[source.authors, source.year].filter(Boolean).join(" · ")}
      </p>
      <div className="row" style={{ gap: 6, marginTop: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
        <span className="tag">{source.sourceType.replace(/_/g, " ")}</span>
        {savedId ? <span className="tag tag-exam">In your sources</span> : null}
      </div>

      {quality.label ? (
        <div className="surface" style={{ marginBottom: "var(--sp-6)" }}>
          <span className="eyebrow">Quality</span>
          <h2 className="display-lg">{quality.label}</h2>
          {quality.explanation ? <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>{quality.explanation}</p> : null}
        </div>
      ) : null}

      {source.abstract ? (
        <section className="section">
          <h2 className="section-title">About this source</h2>
          <div className="note-body" style={{ marginTop: "var(--sp-4)" }}>
            <p>{source.abstract}</p>
          </div>
        </section>
      ) : null}

      {takeaways.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Key takeaways</h2>
          <ul className="note-body" style={{ marginTop: "var(--sp-4)", paddingLeft: "var(--sp-6)" }}>
            {takeaways.map((t, i) => (
              <li key={i} style={{ marginBottom: "var(--sp-2)" }}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <h2 className="section-title">Evaluation</h2>
        <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
          {(
            [
              ["Funding", quality.funding],
              ["Limitations", quality.limitations],
              ["Agreement with other sources", quality.agreement],
            ] as Array<[string, string | undefined]>
          ).map(([label, text]) =>
            text ? (
              <div key={label} className="surface-tight">
                <span className="list-title">{label}</span>
                <p className="card-sub" style={{ margin: "4px 0 0" }}>{text}</p>
              </div>
            ) : null
          )}
        </div>
        {source.scopeNote ? <p className="hint" style={{ marginTop: "var(--sp-3)" }}>{source.scopeNote}</p> : null}
      </section>

      <section className="section">
        <h2 className="section-title">Use this source</h2>
        <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
          {signedIn && !savedId ? (
            <button className="btn btn-primary btn-sm" disabled={pending} onClick={save} type="button">
              Add to my sources
            </button>
          ) : null}
          {message ? <span className="hint">{message}</span> : null}
          <div className="row">
            <Link className="btn btn-primary btn-sm" href="/research?tab=biostat">
              Explain the statistics in this paper
            </Link>
            <Link className="btn btn-sm" href="/teach">
              Ask the Tutor
            </Link>
            <Link className="btn btn-sm" href="/teach?tab=assignments">
              Use in my assignment
            </Link>
            <Link
              className="btn btn-sm"
              href={`/research?tab=evidence&compare=${source.id}`}
            >
              Compare with similar
            </Link>
          </div>

          <div className="surface-tight">
            <span className="label">Copy citation</span>
            <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Citation style">
              {(["apa", "vancouver", "harvard"] as const).map((s) => (
                <button key={s} className="chip chip-sm" aria-pressed={style === s} onClick={() => loadCitation(s)} type="button">
                  {s === "apa" ? "APA" : s === "vancouver" ? "Vancouver" : "Harvard"}
                </button>
              ))}
              <button className="chip chip-sm" onClick={copy} type="button">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            {citation ? (
              <p className="card-sub" style={{ marginTop: "var(--sp-3)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>
                {citation}
              </p>
            ) : null}
          </div>

          <div className="row">
            {["Zotero", "Mendeley", "EndNote"].map((tool) => (
              <button key={tool} className="btn btn-sm" disabled title="Coming with reference-manager export" type="button">
                {tool} (soon)
              </button>
            ))}
          </div>

          {more.length > 0 ? (
            <div>
              <span className="label">More by this author</span>
              <div className="stack-sm" style={{ marginTop: "var(--sp-2)" }}>
                {more.map((m) => (
                  <Link key={m.id} className="list-title" href={`/research?tab=evidence&source=${m.id}`}>
                    {m.title}
                    {m.year ? ` (${m.year})` : ""}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
