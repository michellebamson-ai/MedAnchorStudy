"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCase, type PlayCase } from "@/app/practice/case-actions";

const CLINICAL_TYPES = [
  "History-taking",
  "Symptom analysis",
  "Differential diagnosis",
  "Choosing investigations",
  "Interpreting findings",
  "Clinical decision-making",
  "Management plan",
];

const PH_TYPES = [
  "Outbreak investigation",
  "Environmental hazard",
  "Health promotion plan",
  "Community intervention",
  "Epidemiological investigation",
  "Population-level decision",
];

/**
 * Case start screen (PRACTICE_SPEC.md Cases): domain, material, suggested,
 * type, difficulty, voice, Start — plus Continue for unfinished cases.
 */
export function CaseSetup({
  suggested,
  all,
  documents,
  unfinished,
  onOpen,
}: {
  suggested: PlayCase[];
  all: PlayCase[];
  documents: Array<{ id: string; title: string }>;
  unfinished: { attemptId: string; caseId: string; title: string; atStep: number; total: number } | null;
  onOpen: (attemptId: string, play: PlayCase, fromStep: number) => void;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState<"clinical" | "public_health">("clinical");
  const [docId, setDocId] = useState("");
  const [caseType, setCaseType] = useState("");
  const [caseId, setCaseId] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [voice, setVoice] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");

  const types = domain === "clinical" ? CLINICAL_TYPES : PH_TYPES;

  function begin(input: Parameters<typeof startCase>[0]) {
    if (busy) return;
    setError("");
    start(async () => {
      const res = await startCase(input);
      if (!res.ok || !res.play || !res.attemptId) {
        setError(res.message);
        return;
      }
      onOpen(res.attemptId, { ...res.play, difficulty: res.play.difficulty }, 0);
      router.refresh();
    });
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      {unfinished ? (
        <button
          className="surface"
          style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
          onClick={() => {
            const c = all.find((x) => x.id === unfinished.caseId);
            if (c) onOpen(unfinished.attemptId, c, unfinished.atStep);
          }}
          type="button"
        >
          <span className="eyebrow">Unfinished case</span>
          <span className="display-lg" style={{ display: "block" }}>
            Continue: {unfinished.title}
          </span>
          <span className="list-sub">
            Step {unfinished.atStep + 1} of {unfinished.total}
          </span>
        </button>
      ) : null}

      <section>
        <div className="grid grid-2">
          {(["clinical", "public_health"] as const).map((d) => (
            <button
              key={d}
              className="surface"
              style={{
                cursor: "pointer",
                textAlign: "left",
                outline: domain === d ? "2px solid var(--brand-600)" : "none",
              }}
              aria-pressed={domain === d}
              onClick={() => {
                setDomain(d);
                setCaseType("");
              }}
              type="button"
            >
              <span className="display-lg">{d === "clinical" ? "Clinical" : "Public health"}</span>
              <p className="card-sub" style={{ marginTop: 4, marginBottom: 0 }}>
                {d === "clinical" ? "Patients, decisions, management." : "Outbreaks, communities, populations."}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <span className="label">Make a case from my material</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Material">
          {documents.length === 0 ? (
            <span className="hint">No materials yet — add one and a lecture can become a case.</span>
          ) : (
            documents.slice(0, 8).map((d) => (
              <button
                key={d.id}
                className="chip"
                aria-pressed={docId === d.id}
                onClick={() => {
                  setDocId(docId === d.id ? "" : d.id);
                  setCaseId("");
                }}
                type="button"
              >
                {d.title}
              </button>
            ))
          )}
        </div>
      </section>

      {suggested.length > 0 ? (
        <section>
          <span className="label">Suggested for you</span>
          <div className="stack-sm" style={{ marginTop: "var(--sp-2)" }}>
            {suggested.map((c) => (
              <div key={c.id} className="doc-row">
                <span style={{ flex: 1 }}>
                  <span className="list-title">{c.title}</span>
                  <span className="list-sub" style={{ display: "block" }}>
                    {c.domain === "public_health" ? "Public health" : "Clinical"} · {c.steps.length} steps
                  </span>
                </span>
                {c.topicSlug ? <span className="tag tag-review">Needs review</span> : null}
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setCaseId(c.id);
                    setDocId("");
                  }}
                  type="button"
                >
                  Pick
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <span className="label">Case type</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Case type">
          {types.map((t) => (
            <button
              key={t}
              className="chip chip-sm"
              aria-pressed={caseType === t}
              onClick={() => setCaseType(caseType === t ? "" : t)}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-2">
        <div>
          <span className="label">Difficulty (adapts as you decide)</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Difficulty">
            {["Easy", "Medium", "Hard"].map((d, i) => (
              <button key={d} className="chip chip-sm" aria-pressed={difficulty === i} onClick={() => setDifficulty(i)} type="button">
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Voice</span>
          <div style={{ marginTop: "var(--sp-2)" }}>
            <button
              className="chip chip-sm"
              aria-pressed={voice}
              onClick={() => setVoice((v) => !v)}
              type="button"
              aria-label="Run this case by voice"
            >
              {voice ? "Voice on" : "Voice off"}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div>
        <button
          className="btn btn-primary btn-block"
          style={{ minHeight: 54 }}
          disabled={busy}
          onClick={() =>
            begin({
              caseId: caseId || undefined,
              documentId: docId || undefined,
              caseType: caseType || undefined,
              domain,
              difficulty: difficulty === 0 ? 1 : difficulty === 1 ? 3 : 5,
            })
          }
          type="button"
        >
          {busy ? "Building…" : "Start case"}
        </button>
        {!docId && !caseId ? (
          <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
            Pick a case type or add a material, and I’ll make a case from it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
