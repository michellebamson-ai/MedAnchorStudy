"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissStudyPlan, saveStudyPlan } from "@/app/dashboard/plan-actions";

const HOURS = [5, 10, 15, 20];

/**
 * "Set up your study plan" (ONBOARDING_SPEC.md). A bottom sheet on phones, an
 * inline card on larger screens — light and friendly, with a soft teal edge,
 * so it feels like help and not like a form.
 */
export function StudyPlanPrompt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (pending) return;
    setError("");
    start(async () => {
      if (hours === null) {
        setError("Pick your weekly study hours.");
        return;
      }
      const res = await saveStudyPlan({ examName: name, examDate: date, hoursPerWeek: hours });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function notNow() {
    start(async () => {
      await dismissStudyPlan();
      router.refresh();
    });
  }

  return (
    <div className="plan-prompt" role="dialog" aria-modal="false" aria-labelledby="plan-prompt-title">
      <div className="row-between" style={{ marginBottom: "var(--sp-3)" }}>
        <h2 id="plan-prompt-title" className="display-lg">
          Set up your study plan
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={notNow} type="button" aria-label="Close">
          ✕
        </button>
      </div>
      <p className="card-sub">Add your next exam so we can count the days with you.</p>

      <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
        <div className="field">
          <label className="label" htmlFor="plan-exam">Next exam</label>
          <input
            id="plan-exam"
            className="input"
            placeholder="e.g. Pharmacology midterm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="plan-date">Exam date</label>
          <input
            id="plan-date"
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <span className="label">Study hours per week</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Study hours per week">
            {HOURS.map((h) => (
              <button
                key={h}
                className="chip"
                aria-pressed={hours === h}
                onClick={() => setHours(h)}
                type="button"
              >
                {h === 20 ? "20 or more" : h}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="row">
          <button className="btn btn-primary" disabled={pending} onClick={save} type="button">
            {pending ? "Saving…" : "Save plan"}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={notNow} type="button">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
