"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyzeDocument, generateFromDocument } from "@/app/materials/actions";

export function AnalyzeButton({ documentId, analyzed }: { documentId: string; analyzed: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  return (
    <span className="row" style={{ gap: "var(--sp-2)" }}>
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await analyzeDocument(documentId);
            setMessage(res.message);
            router.refresh();
          })
        }
        type="button"
      >
        {pending ? "Reading…" : analyzed ? "Analyze again" : "Analyze"}
      </button>
      {message ? <span className="hint">{message}</span> : null}
    </span>
  );
}

const DETAIL = ["Brief", "Standard", "Deep"];
const STYLES = ["Simple", "Technical", "With examples"];
const DIFFICULTY = ["Easy", "Medium", "Hard"];
const GOALS = ["Understand", "Exam prep", "Quick review"];
const MAKE = [
  ["notes", "Notes"],
  ["summaries", "Summaries"],
  ["flashcards", "Flashcards"],
  ["questions", "Practice questions"],
  ["cases", "Cases"],
] as const;

/**
 * Generation controls (MATERIALS_SPEC.md §2 "Choose what to make").
 * Tap buttons throughout — never dropdowns.
 */
export function GeneratePanel({ documentId, topics }: { documentId: string; topics: string[] }) {
  const router = useRouter();
  const [detail, setDetail] = useState(1);
  const [style, setStyle] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [goal, setGoal] = useState(0);
  const [make, setMake] = useState<string[]>(["notes", "summaries", "flashcards", "questions", "cases"]);
  const [checked, setChecked] = useState<string[]>(topics);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  function toggle(list: string[], v: string, set: (l: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <section className="surface">
      <span className="eyebrow">Choose what to make</span>
      <h2 className="display-lg" style={{ marginBottom: "var(--sp-5)" }}>
        Generate study tools
      </h2>

      {topics.length > 0 ? (
        <div style={{ marginBottom: "var(--sp-5)" }}>
          <span className="label">Topics to include</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Topics">
            {topics.map((t) => (
              <button
                key={t}
                className="chip chip-sm"
                aria-pressed={checked.includes(t)}
                onClick={() => toggle(checked, t, setChecked)}
                type="button"
              >
                {checked.includes(t) ? "✓ " : ""}{t}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: "var(--sp-5)" }}>
        <div>
          <span className="label">Detail</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Detail">
            {DETAIL.map((d, i) => (
              <button key={d} className="chip chip-sm" aria-pressed={detail === i} onClick={() => setDetail(i)} type="button">
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Style</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Style">
            {STYLES.map((s, i) => (
              <button key={s} className="chip chip-sm" aria-pressed={style === i} onClick={() => setStyle(i)} type="button">
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Difficulty</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Difficulty">
            {DIFFICULTY.map((d, i) => (
              <button key={d} className="chip chip-sm" aria-pressed={difficulty === i} onClick={() => setDifficulty(i)} type="button">
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Goal</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Goal">
            {GOALS.map((g, i) => (
              <button key={g} className="chip chip-sm" aria-pressed={goal === i} onClick={() => setGoal(i)} type="button">
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <span className="label">Make</span>
      <div className="chips" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }} role="group" aria-label="What to make">
        {MAKE.map(([v, label]) => (
          <button
            key={v}
            className="chip chip-sm"
            aria-pressed={make.includes(v)}
            onClick={() => toggle(make, v, setMake)}
            type="button"
          >
            {make.includes(v) ? "✓ " : ""}{label}
          </button>
        ))}
      </div>

      {message ? (
        <div className={`alert ${message.startsWith("Made") ? "alert-ok" : "alert-danger"}`} style={{ marginBottom: "var(--sp-4)" }}>
          {message}
        </div>
      ) : null}

      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await generateFromDocument(documentId, {
              detail: detail === 0 ? 2 : detail === 1 ? 3 : 5,
              style: ["simple", "technical", "examples"][style],
              difficulty: difficulty === 0 ? 1 : difficulty === 1 ? 3 : 5,
              goal: ["understand", "exam_prep", "quick_review"][goal],
              make,
              topicLabels: checked,
            });
            setMessage(res.message);
            router.refresh();
          })
        }
        type="button"
      >
        {pending ? "Generating…" : "Generate"}
      </button>
      <p className="hint" style={{ marginTop: "var(--sp-3)" }}>
        Notes, summaries, flashcards and questions fill their tabs. Cases go to Practice. Review
        times go to your Study Plan.
      </p>
    </section>
  );
}
