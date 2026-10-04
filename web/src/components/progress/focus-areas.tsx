"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { advancePath, dismissPath, startPath, type FocusView } from "@/app/progress/actions";
import { formatTotal } from "@/lib/paths";

/**
 * Focus areas (PROGRESS_SPEC.md §4) — the heart of the tab. Never a plain list of
 * weak topics: each card explains the signals, shows the whole recommended path,
 * and one button launches step one while keeping the rest of the path available.
 */
export function FocusAreas({ focus }: { focus: FocusView[] }) {
  if (focus.length === 0) {
    return (
      <section className="plan-focus" aria-labelledby="focus-heading">
        <h2 id="focus-heading" className="section-title">
          Focus areas
        </h2>
        <div className="surface" style={{ marginTop: "var(--sp-4)" }}>
          <p className="card-sub" style={{ margin: 0 }}>
            Nothing needs attention right now — every topic you have practised is holding up. Keep a spaced
            review going and this space fills in when something slips.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="plan-focus" aria-labelledby="focus-heading">
      <h2 id="focus-heading" className="section-title">
        Focus areas
      </h2>
      <p className="section-note" style={{ marginTop: "var(--sp-1)" }}>
        Each one is a complete path, not a single task — so the fix survives past today.
      </p>
      <div className="focus-grid" style={{ marginTop: "var(--sp-5)" }}>
        {focus.map((f) => (
          <FocusCard key={f.topicSlug} focus={f} />
        ))}
      </div>
    </section>
  );
}

function FocusCard({ focus }: { focus: FocusView }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const started = focus.currentStep > 0;
  const done = focus.currentStep >= focus.steps.length;
  const currentStep = focus.steps[Math.min(focus.currentStep, focus.steps.length - 1)];

  function begin() {
    if (!focus.topicSlug) return;
    start(async () => {
      const res = await startPath(focus.topicSlug);
      setMessage(res.message);
      if (res.ok && res.target) router.push(res.target);
    });
  }

  function completeStep() {
    const pathId = focus.pathId;
    if (!pathId) return;
    start(async () => {
      const res = await advancePath(pathId);
      setMessage(res.message);
      if (res.ok) {
        if (res.finished) router.push(res.target);
        else router.refresh();
      }
    });
  }

  function setAside() {
    if (!focus.pathId) return;
    start(async () => {
      const res = await dismissPath(focus.pathId as string);
      setMessage(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <article className="surface focus-card" data-status={focus.status}>
      <div className="focus-card-head">
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>
            {focus.title}
          </h3>
          <span className="list-sub">{focus.course ?? "No course linked"}</span>
        </div>
        <span className={`badge ${focus.status === "needs_attention" ? "badge-attention" : "badge-review"}`}>
          {focus.status === "needs_attention" ? "Needs Attention" : "Needs Review"}
        </span>
      </div>

      <p className="focus-why">
        <span aria-hidden="true">◷</span> {focus.reason}
      </p>

      <div className="focus-path" aria-label="Recommended learning path">
        <span className="label">Recommended path · about {formatTotal(focus.estMinutes)}</span>
        <ol className="focus-steps">
          {focus.steps.map((s, i) => {
            const state = i < focus.currentStep ? "done" : i === focus.currentStep ? "current" : "todo";
            return (
              <li key={s.key + i} data-state={state}>
                <span className="focus-step-pip" aria-hidden="true">
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className="focus-step-text">
                  <span className="focus-step-label">{s.label}</span>
                  {state === "current" ? <span className="focus-step-detail">{s.detail}</span> : null}
                </span>
                {state === "todo" ? (
                  <Link className="focus-step-link" href={s.target}>
                    open
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="focus-actions">
        {started && !done ? (
          <>
            <button className="btn btn-primary" disabled={pending} onClick={completeStep} type="button">
              {pending ? "Saving…" : `Step ${focus.currentStep + 1} done — continue`}
            </button>
            <Link className="btn" href={currentStep?.target ?? "/progress"}>
              Open “{currentStep?.label}”
            </Link>
          </>
        ) : (
          <button className="btn btn-primary" disabled={pending} onClick={begin} type="button">
            {pending ? "Starting…" : done ? "Run this path again" : "Start this path"}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded((e) => !e)} type="button" aria-expanded={expanded}>
          {expanded ? "Hide steps" : "Show all steps"}
        </button>
        {started ? (
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={setAside} type="button">
            Set aside
          </button>
        ) : null}
      </div>

      {done ? (
        <p className="focus-done">
          You finished this path. The topic stays here until fresh practice actually lifts it — that is the
          loop working, not a bug.
        </p>
      ) : null}

      {expanded ? (
        <p className="focus-expanded">
          {focus.headline}. Each step runs in the app, and finishing the path schedules the spaced review that
          keeps it from fading.
        </p>
      ) : null}

      {message ? (
        <p className="hint" style={{ marginTop: "var(--sp-3)" }}>
          {message}
        </p>
      ) : null}
    </article>
  );
}