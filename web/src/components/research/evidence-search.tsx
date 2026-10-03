"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSource, searchEvidence, type EvidenceHit, type SourceFilter } from "@/app/research/evidence-actions";

export const FILTERS = [
  ["pubmed", "PubMed"],
  ["scholar", "Google Scholar"],
  ["guidelines", "Guidelines"],
  ["news", "News"],
  ["textbooks", "Textbooks"],
  ["all", "All Sources"],
] as const;

const EXAMPLES = [
  "Hypertension guidelines",
  "Vaccine efficacy",
  "Hand hygiene evidence",
  "Public health communication",
];

const TYPE_BADGE: Record<string, string> = {
  peer_reviewed: "Peer-reviewed",
  systematic_review: "Systematic review",
  clinical_guideline: "Clinical Guideline",
  public_health_guideline: "Guideline",
  government: "Government",
  organization: "Organization",
  textbook: "Textbook",
  news: "News",
};

const RECENT_KEY = "medanchor-recent-searches";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Evidence search (RESEARCH_SPEC.md §2.1–2.2): big bar, source filters,
 * recent searches with X, example chips, honest result cards.
 */
export function EvidenceSearch({
  userId,
  initialQ,
  initialFilter,
}: {
  userId: string | null;
  initialQ: string;
  initialFilter: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [filter, setFilter] = useState<SourceFilter>(
    (FILTERS as readonly (readonly [string, string])[]).some(([v]) => v === initialFilter)
      ? (initialFilter as SourceFilter)
      : "all"
  );
  const [hits, setHits] = useState<EvidenceHit[] | null>(null);
  const [note, setNote] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function remember(term: string) {
    const next = [term, ...loadRecent().filter((r) => r !== term)].slice(0, 8);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    setRecent(next);
  }

  function run(term: string, f: SourceFilter) {
    const t = term.trim();
    if (!t) return;
    remember(t);
    start(async () => {
      const res = await searchEvidence(t, f);
      setHits(res.hits);
      setNote(res.note);
      router.refresh();
    });
  }

  function clearRecent(term: string) {
    const next = loadRecent().filter((r) => r !== term);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setRecent(next);
  }

  async function save(id: string) {
    setSaving(id);
    setMessage("");
    const res = await saveSource(id);
    setMessage(res.message);
    setSaving(null);
    if (res.ok) {
      setHits((h) => (h ? h.map((x) => (x.id === id ? { ...x, saved: true } : x)) : h));
      router.refresh();
    }
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q, filter);
        }}
      >
        <div className="field">
          <label className="label" htmlFor="ev-q" style={{ fontSize: "var(--fs-md)" }}>
            Search topics, papers, or guidelines
          </label>
          <input
            id="ev-q"
            className="input"
            style={{ minHeight: 52, fontSize: "var(--fs-md)" }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics, papers, or guidelines"
          />
        </div>
        <div className="chips" style={{ marginTop: "var(--sp-3)" }} role="group" aria-label="Source filter">
          {FILTERS.map(([v, label]) => (
            <button
              key={v}
              className="chip chip-sm"
              aria-pressed={filter === v}
              onClick={() => setFilter(v as SourceFilter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "var(--sp-4)" }}>
          <button className="btn btn-primary" disabled={pending} type="submit">
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {recent.length > 0 && !hits ? (
        <section>
          <span className="label">Recent searches</span>
          <div className="stack-sm" style={{ marginTop: "var(--sp-2)" }}>
            {recent.map((r) => (
              <div key={r} className="doc-row">
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setQ(r);
                    run(r, filter);
                  }}
                  type="button"
                >
                  {r}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => clearRecent(r)} type="button" aria-label={`Clear ${r}`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!hits ? (
        <section>
          <p className="card-sub">Try searching for guidelines or key topics in your course — for example:</p>
          <div className="chips" style={{ marginTop: "var(--sp-3)" }}>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                className="chip"
                onClick={() => {
                  setQ(e);
                  run(e, filter);
                }}
                type="button"
              >
                {e}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {note ? <div className="alert alert-info">{note}</div> : null}
      {message ? <div className="alert alert-ok">{message}</div> : null}

      {hits ? (
        hits.length === 0 ? (
          <div className="surface" style={{ textAlign: "center" }}>
            <h3 className="display-lg">Nothing in the library matches</h3>
            <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
              Try broader words — or ask for a topic and we’ll point you at the right shelf.
            </p>
          </div>
        ) : (
          <div className="stack-sm" role="list" aria-label="Search results">
            {hits.map((h) => (
              <article key={h.id} className="surface-tight" role="listitem">
                <Link className="list-title" href={`/research?tab=evidence&source=${h.id}`}>
                  {h.title}
                </Link>
                <p className="list-sub" style={{ margin: "4px 0" }}>
                  {[h.authors, h.year].filter(Boolean).join(" · ")}
                  {h.publisher ? ` · ${h.publisher}` : ""}
                </p>
                <p className="row" style={{ gap: 6, margin: "4px 0" }}>
                  <span className="tag">{TYPE_BADGE[h.sourceType] ?? "Other"}</span>
                  {h.mine ? <span className="tag tag-exam">My source</span> : null}
                </p>
                <p className="card-sub" style={{ margin: "4px 0 var(--sp-3)" }}>
                  {h.snippet}…
                </p>
                <div className="row">
                  <Link className="btn btn-sm" href={`/research?tab=evidence&source=${h.id}`}>
                    Read
                  </Link>
                  {userId && !h.saved && !h.mine ? (
                    <button className="btn btn-ghost btn-sm" disabled={saving === h.id} onClick={() => save(h.id)} type="button">
                      {saving === h.id ? "Saving…" : "Add to my sources"}
                    </button>
                  ) : null}
                  {h.saved || h.mine ? <span className="hint">In your sources ✓</span> : null}
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
