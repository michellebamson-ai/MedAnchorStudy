"use client";

import type { ProgressSnapshot } from "@/app/progress/actions";

/**
 * Top summary row (PROGRESS_SPEC.md §3): overall mastery, topic health in the
 * exact PRD status language, and learning consistency.
 */
export function SummaryCards({ snapshot }: { snapshot: ProgressSnapshot }) {
  const { health, consistency: c } = snapshot;
  const pct = snapshot.overallMastery;
  const r = 44;
  const circ = 2 * Math.PI * r;

  const consistencyText = c.streak > 0
    ? `${c.streak}-day streak`
    : c.daysThisWeek > 0
      ? `${c.daysThisWeek} day${c.daysThisWeek === 1 ? "" : "s"} this week`
      : "Nothing logged yet";

  const consistencyHint = c.studiedToday
    ? "You have studied today — the streak is safe."
    : c.streak > 0
      ? "Nothing logged today yet. Any session keeps the streak alive."
      : "A single session today starts a streak.";

  return (
    <div className="grid grid-3 plan-summary" role="list" aria-label="Progress summary">
      {/* ---- Overall mastery ---- */}
      <section className="surface plan-summary-card" role="listitem" aria-label="Overall mastery">
        <span className="label">Overall mastery</span>
        <div className="prog-mastery">
          <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
            <circle className="ring-track" cx="52" cy="52" r={r} fill="none" strokeWidth="9" />
            <circle
              className="ring-fill"
              cx="52"
              cy="52"
              r={r}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - (circ * pct) / 100}
              transform="rotate(-90 52 52)"
            />
          </svg>
          <span className="prog-mastery-label">{pct}%</span>
        </div>
        <span className="list-sub">
          Averaged across the {snapshot.topics.filter((t) => t.attempts > 0).length} topics you have practised.
        </span>
      </section>

      {/* ---- Topic health ---- */}
      <section className="surface plan-summary-card" role="listitem" aria-label="Topic health">
        <span className="label">Topic health</span>
        <ul className="prog-health">
          <li>
            <span className="dot dot-strong" aria-hidden="true" />
            <span>Strong</span>
            <b>{health.strong}</b>
          </li>
          <li>
            <span className="dot dot-review" aria-hidden="true" />
            <span>Needs Review</span>
            <b>{health.needsReview}</b>
          </li>
          <li>
            <span className="dot dot-attention" aria-hidden="true" />
            <span>Needs Attention</span>
            <b>{health.needsAttention}</b>
          </li>
        </ul>
        <span className="list-sub">
          Every status is computed from several signals — tutor sessions, cases, questions and flashcards —
          never one quiz score.
        </span>
      </section>

      {/* ---- Learning consistency ---- */}
      <section className="surface plan-summary-card" role="listitem" aria-label="Learning consistency">
        <span className="label">Learning consistency</span>
        <div className="plan-summary-big" data-teal="yes">
          {c.daysThisWeek}
          <span className="plan-summary-unit">days this week</span>
        </div>
        <span className="list-title">{consistencyText}</span>
        <span className="list-sub">{consistencyHint}</span>
        <span className="list-sub">
          {snapshot.planAhead} task{snapshot.planAhead === 1 ? "" : "s"} planned ahead
          {snapshot.dueReviews > 0 ? ` · ${snapshot.dueReviews} review${snapshot.dueReviews === 1 ? "" : "s"} due` : ""}
        </span>
      </section>
    </div>
  );
}