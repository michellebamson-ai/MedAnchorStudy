"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSetup, skipSetup } from "@/app/plan/actions";
import { MODES, type PlanMode } from "@/lib/planner";

const HOURS = [5, 10, 15, 20, 25];

/**
 * First run (STUDY_PLAN_SPEC.md §10): one question about the exam, one about
 * hours. Once both exist, the real planner takes over.
 */
export function SetupCard({ onMessage }: { onMessage: (m: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState<number | null>(10);
  const [mode, setMode] = useState<PlanMode>("deep");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function build() {
    if (pending) return;
    setError("");
    start(async () => {
      if (!name.trim()) return setError("Name your next exam so the plan has a target.");
      if (!date) return setError("Pick the exam date.");
      if (hours === null) return setError("Pick how many hours a week you can study.");
      const res = await completeSetup({ examName: name, examDate: date, weeklyHours: hours, mode });
      onMessage(res.message);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  function later() {
    start(async () => {
      await skipSetup();
      onMessage("No problem — the planner will ask again once you have an exam date.");
      router.refresh();
    });
  }

  return (
    <section className="surface plan-setup" aria-labelledby="setup-heading">
      <span className="eyebrow">Study Plan</span>
      <h2 id="setup-heading" className="display-lg" style={{ margin: "var(--sp-2) 0" }}>
        Tell us your next exam and available study time so we can build your plan
      </h2>
      <p className="card-sub">
        Two questions. From those, the planner schedules teaching, practice and spaced review around the days
        you actually have — and tells you why each task is there.
      </p>

      <div className="grid grid-2" style={{ marginTop: "var(--sp-6)" }}>
        <div className="field">
          <label className="label" htmlFor="setup-exam">
            Your next exam
          </label>
          <input
            id="setup-exam"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. USMLE Step 1 · Cardiology"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="setup-date">
            Exam date
          </label>
          <input id="setup-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginTop: "var(--sp-5)" }}>
        <span className="label">Hours you can study each week</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Weekly study hours">
          {HOURS.map((h) => (
            <button key={h} className="chip" aria-pressed={hours === h} onClick={() => setHours(h)} type="button">
              {h === 25 ? "25 or more" : `${h}h`}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginTop: "var(--sp-5)" }}>
        <span className="label">How should it plan?</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Study mode">
          {Object.values(MODES)
            .filter((m) => m.id !== "catch_up")
            .map((m) => (
              <button key={m.id} className="chip" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} type="button">
                {m.label}
              </button>
            ))}
        </div>
        <span className="hint" style={{ marginTop: "var(--sp-2)", display: "block" }}>
          {MODES[mode].blurb}
        </span>
      </div>

      {error ? <div className="alert alert-danger" style={{ marginTop: "var(--sp-4)" }}>{error}</div> : null}

      <div className="row" style={{ marginTop: "var(--sp-5)" }}>
        <button className="btn btn-primary" disabled={pending} onClick={build} type="button">
          {pending ? "Building your plan…" : "Set up my study plan"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={later} type="button">
          I&apos;ll do it later
        </button>
      </div>
    </section>
  );
}