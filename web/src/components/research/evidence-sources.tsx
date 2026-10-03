"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  compareSources,
  evidenceSummary,
  markImportant,
  moveToProject,
  removeSource,
  saveResearchQuestion,
  suggestQuestions,
} from "@/app/research/evidence-actions";

export interface MySource {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  publisher: string | null;
  sourceType: string;
  important: boolean;
  project: string | null;
  createdAt: Date;
}

/**
 * My Sources (RESEARCH_SPEC.md §2.4): filters, per-item menu, evidence
 * summary generation, plus compare view and the research-question tool.
 */
export function MySources({ sources }: { sources: MySource[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [project, setProject] = useState("all");
  const [compare, setCompare] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [summary, setSummary] = useState<{ text: string; citations: string[] } | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");

  const projects = [...new Set(sources.map((s) => s.project).filter((p): p is string => !!p))];
  const visible = sources.filter((s) => {
    if (filter !== "all" && s.sourceType !== filter) return false;
    if (project !== "all" && s.project !== project) return false;
    return true;
  });

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(0, 3)));
  }

  function summarize() {
    if (!compare.length) {
      setMessage("Tick up to three sources to summarize.");
      return;
    }
    if (!focus.trim()) {
      setMessage("Say what the summary should focus on.");
      return;
    }
    start(async () => {
      const res = await evidenceSummary(compare, focus);
      setMessage(res.message);
      if (res.ok && res.summary) {
        setSummary({ text: res.summary, citations: res.citations ?? [] });
      }
      router.refresh();
    });
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      <div className="row-between">
        <h2 className="display-lg">My Sources ({sources.length})</h2>
        {compare.length >= 2 ? (
          <Link className="btn btn-primary btn-sm" href={`/research?tab=evidence&compare=${compare.join(",")}`}>
            Compare {compare.length}
          </Link>
        ) : null}
      </div>

      <div className="row">
        <div className="chips" role="group" aria-label="Filter by type">
          <button className="chip chip-sm" aria-pressed={filter === "all"} onClick={() => setFilter("all")} type="button">
            All sources
          </button>
          {[...new Set(sources.map((s) => s.sourceType))].map((t) => (
            <button key={t} className="chip chip-sm" aria-pressed={filter === t} onClick={() => setFilter(t)} type="button">
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {projects.length > 0 ? (
          <div className="chips" role="group" aria-label="Filter by project">
            <button className="chip chip-sm" aria-pressed={project === "all"} onClick={() => setProject("all")} type="button">
              All projects
            </button>
            {projects.map((p) => (
              <button key={p} className="chip chip-sm" aria-pressed={project === p} onClick={() => setProject(p)} type="button">
                {p}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="card-sub">No saved sources yet — search the library and add the ones that matter.</p>
      ) : (
        <div className="stack-sm">
          {visible.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              comparing={compare.includes(s.id)}
              onCompare={() => toggleCompare(s.id)}
              onMove={(name) => {
                start(async () => {
                  const res = await moveToProject(s.id, name);
                  setMessage(res.message);
                  setMoving(null);
                  router.refresh();
                });
              }}
              moving={moving === s.id}
              onMoving={() => setMoving(s.id)}
              projectName={projectName}
              setProjectName={setProjectName}
            />
          ))}
        </div>
      )}

      <section className="surface">
        <span className="eyebrow">Evidence summary</span>
        <h3 className="display-lg" style={{ marginBottom: "var(--sp-3)" }}>
          Summarize across sources
        </h3>
        <p className="card-sub">Tick up to three sources above, say the focus, and get a plain-language synthesis with citations.</p>
        <div className="field" style={{ marginTop: "var(--sp-3)" }}>
          <label className="label" htmlFor="sum-focus">Focus</label>
          <input
            id="sum-focus"
            className="input"
            placeholder="e.g. first-line treatment for newly diagnosed hypertension"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          />
        </div>
        {message ? <p className="hint" style={{ marginTop: "var(--sp-2)" }}>{message}</p> : null}
        <div style={{ marginTop: "var(--sp-3)" }}>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={summarize} type="button">
            {pending ? "Summarizing…" : "Generate evidence summary"}
          </button>
        </div>
        {summary ? (
          <div style={{ marginTop: "var(--sp-4)" }}>
            <div className="note-body">
              {summary.text.split("\n").map((line, i) =>
                line.startsWith("•") ? <p key={i} style={{ marginBottom: 4 }}>{line}</p> : <p key={i}>{line}</p>
              )}
            </div>
            <h4 className="card-title" style={{ marginTop: "var(--sp-4)" }}>Cited</h4>
            {summary.citations.map((c, i) => (
              <p key={i} className="card-sub" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>
                [{i + 1}] {c}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SourceRow({
  source: s,
  comparing,
  onCompare,
  onMove,
  moving,
  onMoving,
  projectName,
  setProjectName,
}: {
  source: MySource;
  comparing: boolean;
  onCompare: () => void;
  onMove: (name: string) => void;
  moving: boolean;
  onMoving: () => void;
  projectName: string;
  setProjectName: (v: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);

  return (
    <div className="doc-row">
      <input type="checkbox" checked={comparing} onChange={onCompare} aria-label={`Select ${s.title} for comparison`} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <Link className="list-title" href={`/research?tab=evidence&source=${s.id}`}>
          {s.important ? "★ " : ""}{s.title}
        </Link>
        <span className="list-sub" style={{ display: "block" }}>
          {[s.authors, s.year, s.project].filter(Boolean).join(" · ")}
        </span>
        <span className="tag" style={{ marginTop: 4 }}>{s.sourceType.replace(/_/g, " ")}</span>
      </span>
      <span style={{ position: "relative" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMenu((m) => !m)} type="button" aria-label={`Options for ${s.title}`} aria-expanded={menu}>
          ⋯
        </button>
        {menu ? (
          <span className="surface-tight" style={{ position: "absolute", right: 0, zIndex: 5, minWidth: 190, display: "flex", flexDirection: "column", gap: 4 }}>
            <Link className="btn btn-ghost btn-sm" href={`/research?tab=evidence&source=${s.id}`}>
              View
            </Link>
            <button
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await markImportant(s.id, !s.important);
                  setMenu(false);
                  router.refresh();
                })
              }
              type="button"
            >
              {s.important ? "Unmark important" : "Mark important"}
            </button>
            {!moving ? (
              <button className="btn btn-ghost btn-sm" onClick={onMoving} type="button">
                Move to project…
              </button>
            ) : (
              <span className="row">
                <input
                  className="input"
                  style={{ minHeight: 32 }}
                  placeholder="Project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  aria-label="Project name"
                />
                <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => onMove(projectName)} type="button">
                  ✓
                </button>
              </span>
            )}
            <button
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const { removeSource } = await import("@/app/research/evidence-actions");
                  await removeSource(s.id);
                  setMenu(false);
                  router.refresh();
                })
              }
              type="button"
            >
              Remove
            </button>
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Side-by-side comparison with agreement explained. */
export function CompareView({ sources, signedIn }: {
  sources: Array<{ id: string; title: string; authors: string | null; year: number | null; publisher: string | null; sourceType: string; abstract: string | null; quality: unknown }>;
  signedIn: boolean;
}) {
  const [comparison, setComparison] = useState("");
  const [pending, start] = useTransition();

  return (
    <div style={{ maxWidth: 900 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=evidence" style={{ marginBottom: "var(--sp-4)" }}>
        ← Search
      </Link>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-5)" }}>
        Compare sources
      </h2>
      <div className="grid grid-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {sources.map((s) => {
          const q = (s.quality ?? {}) as { label?: string; takeaways?: string[] };
          return (
            <div key={s.id} className="surface">
              <span className="tag">{s.sourceType.replace(/_/g, " ")}</span>
              <h3 className="display-lg" style={{ marginTop: "var(--sp-2)" }}>
                {s.title}
              </h3>
              <p className="list-sub">{[s.authors, s.year, s.publisher].filter(Boolean).join(" · ")}</p>
              <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>{s.abstract}</p>
              {q.label ? <p className="list-sub" style={{ marginTop: "var(--sp-2)" }}><b>Quality:</b> {q.label}</p> : null}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <button
          className="btn btn-primary"
          disabled={pending || !signedIn}
          onClick={() =>
            start(async () => {
              const { compareSources } = await import("@/app/research/evidence-actions");
              const res = await compareSources(sources.map((s) => s.id));
              if (res.ok && res.comparison) setComparison(res.comparison);
            })
          }
          type="button"
        >
          {pending ? "Comparing…" : "Explain agreement & disagreement"}
        </button>
        {!signedIn ? <p className="hint" style={{ marginTop: 4 }}>Sign in to generate the comparison.</p> : null}
      </div>
      {comparison ? (
        <div className="note-body" style={{ marginTop: "var(--sp-5)" }}>
          {comparison.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Develop a research question, then save it into Biostatistics. */
export function RQTool({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function develop() {
    if (!topic.trim()) {
      setMessage("Say the topic in a few words first.");
      return;
    }
    start(async () => {
      const res = await suggestQuestions(topic);
      setMessage(res.message);
      if (res.ok && res.questions) setQuestions(res.questions);
      router.refresh();
    });
  }

  function save(q: string) {
    start(async () => {
      const res = await saveResearchQuestion(q, topic);
      setMessage(res.message + " ");
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=evidence" style={{ marginBottom: "var(--sp-4)" }}>
        ← Search
      </Link>
      <span className="eyebrow">Research support</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-3)" }}>
        Develop a research question
      </h2>
      <p className="card-sub">Enter a topic — the tutor suggests evidence-based questions you can refine and save.</p>
      <div className="row" style={{ marginTop: "var(--sp-4)" }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="e.g. hand hygiene compliance on wards"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label="Research topic"
        />
        <button className="btn btn-primary" disabled={pending || !signedIn} onClick={develop} type="button">
          {pending ? "Thinking…" : "Suggest"}
        </button>
      </div>
      {!signedIn ? <p className="hint" style={{ marginTop: 4 }}>Sign in to develop and save questions.</p> : null}
      {message ? <p className="hint" style={{ marginTop: "var(--sp-2)" }}>{message} {message.startsWith("Saved") ? <Link href="/research?tab=biostat">Open Biostatistics →</Link> : null}</p> : null}
      {questions.length > 0 ? (
        <div className="stack-sm" style={{ marginTop: "var(--sp-5)" }}>
          {questions.map((q, i) => (
            <div key={i} className="doc-row">
              <span className="list-title" style={{ flex: 1 }}>{q}</span>
              <button className="btn btn-sm" disabled={pending} onClick={() => save(q)} type="button">
                Save
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
