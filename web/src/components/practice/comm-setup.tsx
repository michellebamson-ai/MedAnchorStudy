"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startComm } from "@/app/practice/comm-actions";
import type { CommScenarioInfo } from "@/app/practice/comm-actions";

const CHARACTERS = [
  ["patient", "Patient"],
  ["caregiver", "Caregiver"],
  ["community_member", "Community member"],
  ["colleague", "Colleague"],
  ["community_leader", "Community leader"],
] as const;

const CLINICAL_SCENARIOS = [
  "History-taking",
  "Patient interview",
  "Health education",
  "Motivational interviewing",
  "Breaking bad news",
];

const PH_SCENARIOS = [
  "Public-health communication",
  "Community engagement",
  "Explaining an outbreak",
  "Explaining a health measure",
];

const PERSONALITIES = [
  "Anxious",
  "Angry or frustrated",
  "Confused",
  "Quiet or reluctant",
  "Talkative",
  "Skeptical of healthcare",
  "Worried about cost",
];

const CHALLENGES = [
  "Language or culture barrier",
  "Misunderstanding",
  "Sensitive questions",
  "Patient refuses an exam",
  "Difficult questions",
  "Community distrusts an intervention",
];

/**
 * Communication start screen (PRACTICE_SPEC.md Communication): who, scenario,
 * personality, challenge, difficulty, mode, material — then Start.
 */
export function CommSetup({
  scenarios,
  suggested,
  documents,
  past,
  onOpen,
}: {
  scenarios: CommScenarioInfo[];
  suggested: CommScenarioInfo[];
  documents: Array<{ id: string; title: string }>;
  past: Array<{ id: string; title: string; date: string; overall: number | null }>;
  onOpen: (session: {
    scenarioId: string;
    title: string;
    character: string;
    characterLabel: string;
    kind: string;
    kindLabel: string;
    personality: string;
    challenge?: string;
    difficulty: number;
    mode: "text" | "voice";
    brief: string;
    opening: string;
    hiddenFacts: string[];
  }) => void;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState<"clinical" | "public_health">("clinical");
  const [character, setCharacter] = useState("");
  const [scenario, setScenario] = useState("");
  const [personality, setPersonality] = useState("");
  const [surprise, setSurprise] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const [docId, setDocId] = useState("");
  const [busy, start] = useTransition();
  const [error, setError] = useState("");

  const kinds = domain === "clinical" ? CLINICAL_SCENARIOS : PH_SCENARIOS;

  function begin(scenarioId?: string) {
    if (busy) return;
    setError("");
    start(async () => {
      const res = await startComm({
        scenarioId,
        character: character || undefined,
        kind: scenario
          ? scenario.toLowerCase().replace(/[^a-z]+/g, "-")
          : undefined,
        personality: surprise ? undefined : personality.toLowerCase().replace(/[^a-z]+/g, "_") || undefined,
        challenge: challenge || undefined,
        difficulty: difficulty === 3 ? 4 : difficulty + 1,
        mode,
        documentId: docId || undefined,
      });
      if (!res.ok || !res.session) {
        setError(res.message);
        return;
      }
      onOpen(res.session);
      router.refresh();
    });
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <section>
        <div className="grid grid-2">
          {(["clinical", "public_health"] as const).map((d) => (
            <button
              key={d}
              className="surface"
              style={{ cursor: "pointer", textAlign: "left", outline: domain === d ? "2px solid var(--brand-600)" : "none" }}
              aria-pressed={domain === d}
              onClick={() => setDomain(d)}
              type="button"
            >
              <span className="display-lg">{d === "clinical" ? "Clinical" : "Public health"}</span>
            </button>
          ))}
        </div>
      </section>

      {suggested.length > 0 ? (
        <section>
          <span className="label">Suggested for you</span>
          <div className="stack-sm" style={{ marginTop: "var(--sp-2)" }}>
            {suggested.map((s) => (
              <div key={s.id} className="doc-row">
                <span style={{ flex: 1 }}>
                  <span className="list-title">{s.title}</span>
                  <span className="list-sub" style={{ display: "block" }}>
                    {s.character} · {s.kind}
                  </span>
                </span>
                <span className="tag tag-review">Needs practice</span>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => begin(s.id)} type="button">
                  Start
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <span className="label">Who you’ll talk to</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Character">
          {(domain === "clinical" ? CHARACTERS.slice(0, 4) : [CHARACTERS[0], CHARACTERS[2], CHARACTERS[3], CHARACTERS[4]]).map(
            ([v, label]) => (
              <button key={v} className="chip" aria-pressed={character === v} onClick={() => setCharacter(v)} type="button">
                {label}
              </button>
            )
          )}
        </div>
      </section>

      <section>
        <span className="label">Scenario</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Scenario">
          {kinds.map((k) => (
            <button key={k} className="chip chip-sm" aria-pressed={scenario === k} onClick={() => setScenario(k)} type="button">
              {k}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-2">
        <div>
          <span className="label">Personality</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Personality">
            {PERSONALITIES.map((p) => (
              <button
                key={p}
                className="chip chip-sm"
                aria-pressed={personality === p && !surprise}
                onClick={() => {
                  setPersonality(p);
                  setSurprise(false);
                }}
                type="button"
              >
                {p}
              </button>
            ))}
            <button
              className="chip chip-sm"
              aria-pressed={surprise}
              onClick={() => {
                setSurprise(true);
                setPersonality("");
              }}
              type="button"
            >
              Surprise me
            </button>
          </div>
        </div>
        <div>
          <span className="label">Challenge (optional)</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Challenge">
            {CHALLENGES.map((c) => (
              <button
                key={c}
                className="chip chip-sm"
                aria-pressed={challenge === c}
                onClick={() => setChallenge(challenge === c ? "" : c)}
                type="button"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-2">
        <div>
          <span className="label">Difficulty</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Difficulty">
            {["Beginner", "Intermediate", "Advanced", "Exam (OSCE)"].map((d, i) => (
              <button key={d} className="chip chip-sm" aria-pressed={difficulty === i} onClick={() => setDifficulty(i)} type="button">
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Mode (voice first)</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Mode">
            <button className="chip chip-sm" aria-pressed={mode === "voice"} onClick={() => setMode("voice")} type="button">
              Voice
            </button>
            <button className="chip chip-sm" aria-pressed={mode === "text"} onClick={() => setMode("text")} type="button">
              Text
            </button>
          </div>
        </div>
      </section>

      {documents.length > 0 ? (
        <section>
          <span className="label">From my material (optional)</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Material">
            {documents.slice(0, 8).map((d) => (
              <button
                key={d.id}
                className="chip chip-sm"
                aria-pressed={docId === d.id}
                onClick={() => setDocId(docId === d.id ? "" : d.id)}
                type="button"
              >
                {d.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div>
        <button className="btn btn-primary btn-block" style={{ minHeight: 54 }} disabled={busy} onClick={() => begin()} type="button">
          {busy ? "Setting the scene…" : "Start"}
        </button>
        {!character || !scenario ? (
          <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
            Pick who you’ll talk to and a scenario, and we’ll start.
          </p>
        ) : null}
      </div>

      <div className="row">
        <Link className="btn btn-ghost btn-sm" href="/practice?tab=communicate&soap=1">
          Practice a SOAP note
        </Link>
      </div>

      {past.length > 0 ? (
        <section>
          <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
            Past sessions
          </h2>
          <div className="stack-sm">
            {past.map((p) => (
              <div key={p.id} className="doc-row">
                <span style={{ flex: 1 }}>
                  <span className="list-title">{p.title}</span>
                  <span className="list-sub" style={{ display: "block" }}>
                    {p.date}
                    {p.overall != null ? ` · ${Math.round(p.overall * 100)}%` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
