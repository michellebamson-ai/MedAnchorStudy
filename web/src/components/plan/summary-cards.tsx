"use client";

import Link from "next/link";
import type { PlanSnapshot } from "@/app/plan/actions";
import { formatMinutes } from "@/lib/planner";

/**
 * Top summary row (STUDY_PLAN_SPEC.md §3): next exam, the week's load, and the
 * focus area pulled from Progress — each with one clear next step.
 */
export function SummaryCards({
  snapshot,
  onEditNextExam,
}: {
  snapshot: PlanSnapshot;
  onEditNextExam: () => void;
}) {
  const { nextExam, week, focus } = snapshot;
  const weekPct = week.pct;

  return (
    <div className="grid grid-3 plan-summary" role="list" aria-label="Plan summary">
      {/* ---------------- Next exam ---------------- */}
      <section className="surface plan-summary-card" role="listitem" aria-label="Next exam">
        <span className="label">Next exam</span>
        {nextExam ? (
          <>
            <div className="plan-summary-big" data-urgent={nextExam.daysLeft <= 7 ? "yes" : undefined}>
              {nextExam.daysLeft}
              <span className="plan-summary-unit">{nextExam.daysLeft === 1 ? "day" : "days"}</span>
            </div>
            <span className="list-title">{nextExam.title}</span>
            <span className="list-sub">
              {new Date(nextExam.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {nextExam.course ? ` · ${nextExam.course}` : ""}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={onEditNextExam} type="button">
              Open exam details →
            </button>
          </>
        ) : (
          <>
            <div className="plan-summary-big" data-empty="yes">
              —
            </div>
            <span className="list-title">No exam added yet</span>
            <span className="list-sub">Add one and the planner works backwards from it.</span>
            <button className="btn btn-primary btn-sm" onClick={onEditNextExam} type="button">
              + Add exam
            </button>
          </>
        )}
      </section>

      {/* ---------------- This week ---------------- */}
      <section className="surface plan-summary-card" role="listitem" aria-label="This week">
        <span className="label">This week</span>
        <div className="plan-summary-big">
          {formatMinutes(week.plannedMinutes)}
          <span className="plan-summary-unit">planned</span>
        </div>
        <span className="list-title">
          {formatMinutes(week.doneMinutes)} done · {weekPct}%
        </span>
        <div
          className="progress-line"
          role="progressbar"
          aria-valuenow={weekPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Week completion"
        >
          <i style={{ width: `${Math.max(weekPct, week.plannedMinutes ? 2 : 0)}%` }} />
        </div>
        <span className="list-sub">
          You told the planner you have about {snapshot.weeklyHours}h a week.
        </span>
      </section>

      {/* ---------------- Focus area ---------------- */}
      <section className="surface plan-summary-card" role="listitem" aria-label="Focus area">
        <span className="label">Focus area</span>
        {focus ? (
          <>
            <div className="plan-summary-big" data-teal="yes">
              {Math.round(focus.score * 100)}
              <span className="plan-summary-unit">% mastery</span>
            </div>
            <span className="list-title">{focus.title}</span>
            <span className="list-sub">
              {focus.status === "needs_attention"
                ? "Needs attention — Progress flags this as your weakest area."
                : "Needs review — worth another pass before it fades."}
            </span>
            <Link className="btn btn-primary btn-sm" href={focus.target}>
              Study now
            </Link>
          </>
        ) : (
          <>
            <div className="plan-summary-big" data-empty="yes">
              —
            </div>
            <span className="list-title">Nothing flagged yet</span>
            <span className="list-sub">Take a quiz or case and Progress will point at a weak spot.</span>
            <Link className="btn btn-sm" href="/practice">
              Practise something
            </Link>
          </>
        )}
      </section>
    </div>
  );
}