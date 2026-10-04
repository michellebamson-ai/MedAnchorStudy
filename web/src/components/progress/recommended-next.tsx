"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startPath, type ProgressSnapshot } from "@/app/progress/actions";
import { formatTotal } from "@/lib/paths";

/**
 * Recommended next steps (PROGRESS_SPEC.md §8) and the course-level view
 * (§7). Each recommendation is a short path; one button begins the first step.
 */
export function RecommendedNext({
  snapshot,
}: {
  snapshot: ProgressSnapshot;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  if (snapshot.recommended.length === 0) return null;

  function begin(slug: string) {
    setBusy(slug);
    start(async () => {
      const res = await startPath(slug);
      setBusy(null);
      if (res.ok && res.target) router.push(res.target);
    });
  }

  return (
    <section className="plan-next" aria-labelledby="next-heading">
      <h2 id="next-heading" className="section-title">
        Recommended next steps
      </h2>
      <p className="section-note" style={{ marginTop: "var(--sp-1)" }}>
        Ranked by what would move the needle most — each one is a path, not a task.
      </p>
      <div className="next-list" style={{ marginTop: "var(--sp-4)" }}>
        {snapshot.recommended.map((r) => (
          <article key={r.topicSlug} className="surface-tight next-row">
            <div className="next-main">
              <span className="list-title">{r.title}</span>
              <span className="list-sub">{r.headline}</span>
              <span className="next-chain">
                {Array.from({ length: Math.min(r.steps, 5) }).map((_, i) => (
                  <span key={i} className="next-pip" aria-hidden="true" />
                ))}
                <span className="list-sub">
                  {r.steps} step{r.steps === 1 ? "" : "s"} · about {formatTotal(r.estMinutes)}
                  {r.currentStep > 0 ? ` · step ${r.currentStep + 1} of ${r.steps}` : ""}
                </span>
              </span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={pending || busy === r.topicSlug}
              onClick={() => begin(r.topicSlug)}
              type="button"
            >
              {busy === r.topicSlug ? "Starting…" : r.currentStep > 0 ? "Continue path" : "Start"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Course-level view (PROGRESS_SPEC.md §7). Switching course re-scopes the whole
 * page — summary, focus areas, topics and feed.
 */
export function CourseFilter({
  courses,
  active,
}: {
  courses: ProgressSnapshot["courses"];
  active: string | null;
}) {
  if (courses.length <= 1) return null;

  return (
    <nav className="course-filter" aria-label="Course filter">
      <Link className="chip chip-sm" href="/progress" aria-current={active === null ? "page" : undefined}>
        All Courses
      </Link>
      {courses.map((c) => (
        <Link
          key={c.name}
          className="chip chip-sm"
          href={`/progress?course=${encodeURIComponent(c.name)}`}
          aria-current={active === c.name ? "page" : undefined}
        >
          {c.name}
          <span className="chip-count">{c.strong}/{c.topics}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Per-course rollup shown when a course is selected. */
export function CourseBreakdown({ snapshot }: { snapshot: ProgressSnapshot }) {
  if (!snapshot.activeCourse) return null;
  return (
    <div className="alert alert-info" style={{ marginBottom: "var(--sp-6)" }}>
      Showing <b>{snapshot.activeCourse}</b> · {snapshot.topics.length} topic
      {snapshot.topics.length === 1 ? "" : "s"} · {snapshot.health.strong} strong ·{" "}
      {snapshot.health.needsReview} need review · {snapshot.health.needsAttention} need attention.{" "}
      <a href="/progress">Back to all courses</a>
    </div>
  );
}