"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteItem, setItemStatus, type PlanSnapshot } from "@/app/plan/actions";
import { formatMinutes } from "@/lib/planner";
import { SummaryCards } from "@/components/plan/summary-cards";
import { ModeSwitcher } from "@/components/plan/mode-switcher";
import { TodaySection } from "@/components/plan/today-section";
import { UpcomingDays } from "@/components/plan/upcoming-days";
import { DeadlineList } from "@/components/plan/deadline-list";
import { DeadlineForm } from "@/components/plan/deadline-form";
import { AvailabilityForm } from "@/components/plan/availability-form";
import { SetupCard } from "@/components/plan/setup-card";

/**
 * Study Plan tab (STUDY_PLAN_SPEC.md): Today's plan is the hero, then Upcoming,
 * then Exams & Deadlines — calm and low-stress, because planning anxiety is the
 * reason students avoid planning.
 */
export function StudyPlan({ snapshot }: { snapshot: PlanSnapshot | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "warn">("ok");
  const [addDeadline, setAddDeadline] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [pending, start] = useTransition();

  function notify(m: string, t: "ok" | "warn" = "ok") {
    setMessage(m);
    setTone(t);
  }

  function status(id: string, next: "planned" | "in_progress" | "done" | "missed") {
    start(async () => {
      const res = await setItemStatus(id, next);
      notify(res.message, next === "missed" ? "warn" : "ok");
      if (res.ok) router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteItem(id);
      notify(res.message);
      if (res.ok) router.refresh();
    });
  }

  if (!snapshot) {
    return (
      <section className="surface" style={{ maxWidth: 620 }}>
        <h2 className="display-lg">Sign in to build your plan</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Your exams, deadlines, available hours and weak topics all live on your account, so the plan can be
          built around them.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Link className="btn btn-primary" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  const needsSetup = !snapshot.setupDone;

  return (
    <div className="plan-page">
      {/* ---------------- Header ---------------- */}
      <div className="page-head row-between">
        <div>
          <span className="eyebrow">Plan it. Then do it.</span>
          <h1 className="display">Study Plan</h1>
          <p className="lede">Your personalized schedule, deadlines, and daily goals.</p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setShowAvailability(true)} type="button">
            My available hours
          </button>
          <button className="btn btn-primary" onClick={() => setAddDeadline(true)} type="button">
            + Add Exam / Deadline
          </button>
        </div>
      </div>

      {message ? (
        <div className={`alert alert-${tone === "warn" ? "warn" : "ok"}`} role="status" style={{ marginBottom: "var(--sp-6)" }}>
          {message}
        </div>
      ) : null}

      {needsSetup ? (
        <SetupCard onMessage={notify} />
      ) : (
        <>
          <SummaryCards snapshot={snapshot} onEditNextExam={() => setAddDeadline(true)} />

          <div className="plan-meta">
            <span className="hint">
              {snapshot.dueCards > 0
                ? `${snapshot.dueCards} spaced review${snapshot.dueCards === 1 ? "" : "s"} due — reviews are planned as first-class work.`
                : "No spaced reviews due right now."}
            </span>
            <span className="hint">
              About {formatMinutes(snapshot.weekCapacityMinutes)} available this week.
            </span>
            {snapshot.openAssignments > 0 ? (
              <span className="hint">
                {snapshot.openAssignments} open assignment{snapshot.openAssignments === 1 ? "" : "s"} counted for
                workload balancing.
              </span>
            ) : null}
          </div>

          {snapshot.notes.length ? (
            <div className="alert alert-info plan-notes">
              {snapshot.notes.map((n, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : "var(--sp-2) 0 0" }}>
                  {n}
                </p>
              ))}
            </div>
          ) : null}

          <ModeSwitcher mode={snapshot.mode} onMessage={(m) => notify(m)} />

          <div className="plan-grid">
            <div className="plan-grid-main">
              <TodaySection snapshot={snapshot} onMessage={notify} onStatus={status} onDelete={remove} />
              <UpcomingDays snapshot={snapshot} onStatus={status} onDelete={remove} />
            </div>
            <aside className="plan-grid-side">
              <ForecastPanel snapshot={snapshot} />
            </aside>
          </div>

          <DeadlineList snapshot={snapshot} onMessage={notify} onAdd={() => setAddDeadline(true)} />
        </>
      )}

      {addDeadline ? <DeadlineForm editing={null} onClose={() => setAddDeadline(false)} onMessage={notify} /> : null}
      {showAvailability ? (
        <AvailabilityForm
          dayMinutes={snapshot.dayMinutes}
          weeklyHours={snapshot.weeklyHours}
          dailyGoalMinutes={snapshot.dailyGoalMinutes}
          onClose={() => setShowAvailability(false)}
          onMessage={notify}
        />
      ) : null}

      {pending ? <span className="visually-hidden">Working…</span> : null}
    </div>
  );
}

/**
 * Cautious forecast (STUDY_PLAN_SPEC.md §8). Counts coverage, never promises
 * readiness.
 */
function ForecastPanel({ snapshot }: { snapshot: PlanSnapshot }) {
  const f = snapshot.forecast;
  if (!f) return null;
  const pct = f.topicsTotal ? Math.round((f.topicsStarted / f.topicsTotal) * 100) : 0;

  return (
    <section className="surface plan-forecast" aria-labelledby="forecast-heading">
      <h2 id="forecast-heading" className="card-title">
        Coverage
      </h2>
      <div className="plan-forecast-big">
        {pct}
        <span>%</span>
      </div>
      <div className="progress-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Topics with activity">
        <i style={{ width: `${Math.max(pct, f.topicsTotal ? 2 : 0)}%` }} />
      </div>
      <ul className="legend" style={{ marginTop: "var(--sp-4)" }}>
        <li>
          <span className="dot dot-strong" aria-hidden="true" /> Topics with activity <b>{f.topicsStarted}/{f.topicsTotal}</b>
        </li>
        <li>
          <span className="dot dot-strong" aria-hidden="true" /> Strong <b>{f.topicsStrong}</b>
        </li>
        <li>
          <span className="dot dot-attention" aria-hidden="true" /> Need attention <b>{f.topicsNeedingAttention}</b>
        </li>
      </ul>
      <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
        {f.note}
      </p>
    </section>
  );
}