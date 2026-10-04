"use client";

import Link from "next/link";
import type { ProgressSnapshot } from "@/app/progress/actions";
import { SummaryCards } from "@/components/progress/summary-cards";
import { FocusAreas } from "@/components/progress/focus-areas";
import { RecommendedNext, CourseFilter, CourseBreakdown } from "@/components/progress/recommended-next";
import { TopicMastery } from "@/components/progress/topic-mastery";
import { LoopFeed } from "@/components/progress/loop-feed";
import { EmptyState } from "@/components/progress/empty-state";

/**
 * Progress tab (PROGRESS_SPEC.md): Summary → Focus Areas → Topic Mastery →
 * Learning Loop. Actionable over analytical — every element drives a next step.
 */
export function ProgressView({ snapshot }: { snapshot: ProgressSnapshot | null }) {
  if (!snapshot) {
    return (
      <section className="surface" style={{ maxWidth: 620 }}>
        <h2 className="display-lg">Sign in to see your progress</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Mastery is computed from your own sessions, so it lives on your account.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="plan-page">
      <div className="page-head">
        <span className="eyebrow">See how it compounds</span>
        <h1 className="display">Progress</h1>
        <p className="lede">See how your learning is compounding — and what to do next.</p>
      </div>

      <CourseFilter courses={snapshot.courses} active={snapshot.activeCourse} />
      <CourseBreakdown snapshot={snapshot} />

      {!snapshot.hasSignal ? (
        <EmptyState />
      ) : (
        <>
          <SummaryCards snapshot={snapshot} />
          <FocusAreas focus={snapshot.focus} />
          <RecommendedNext snapshot={snapshot} />
          <TopicMastery topics={snapshot.topics} />
          <LoopFeed chains={snapshot.chains} planAhead={snapshot.planAhead} />
        </>
      )}
    </div>
  );
}