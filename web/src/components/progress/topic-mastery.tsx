"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startPath, type TopicView } from "@/app/progress/actions";
import { StatusBadge } from "@/components/ui";
import type { Status } from "@/components/ui";

const FILTERS = [
  ["all", "All"],
  ["strong", "Strong"],
  ["needs_review", "Needs Review"],
  ["needs_attention", "Needs Attention"],
] as const;

type Filter = (typeof FILTERS)[number][0];

function relative(date: string | null, days: number | null): string {
  if (!date) return "No activity yet";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days != null && days < 30) return `${days} days ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function signalChips(t: TopicView) {
  const chips: Array<[string, number | null]> = [
    ["Questions", t.signals.quizzes],
    ["Tutor", t.signals.tutoring],
    ["Cases", t.signals.cases],
    ["Cards", t.signals.cards],
  ];
  return chips.map(([label, value]) => (
    <span
      key={label}
      className="topic-signal"
      data-state={value == null ? "none" : value >= 0.75 ? "good" : value >= 0.6 ? "mid" : "low"}
      title={value == null ? `${label}: no signal yet` : `${label}: ${Math.round(value * 100)}%`}
    >
      {label}
      <b>{value == null ? "—" : `${Math.round(value * 100)}%`}</b>
    </span>
  ));
}

/**
 * Topic mastery overview (PROGRESS_SPEC.md §5): every topic, its multi-signal
 * status, the individual signals behind it, when it was last practised, and one
 * clear next action.
 */
export function TopicMastery({ topics }: { topics: TopicView[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: topics.length, strong: 0, needs_review: 0, needs_attention: 0 };
    for (const t of topics) c[t.status as Exclude<Filter, "all">] += 1;
    return c;
  }, [topics]);

  const list = filter === "all" ? topics : topics.filter((t) => t.status === filter);

  function act(slug: string) {
    setBusy(slug);
    start(async () => {
      const res = await startPath(slug);
      setBusy(null);
      if (res.ok && res.target) router.push(res.target);
    });
  }

  return (
    <section className="plan-topics" aria-labelledby="topics-heading">
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <h2 id="topics-heading" className="section-title" style={{ margin: 0 }}>
          Topic mastery
        </h2>
        <span className="list-sub">Statuses come from several signals, never one score</span>
      </div>

      <div className="chips" style={{ marginBottom: "var(--sp-4)" }} role="group" aria-label="Filter topics by status">
        {FILTERS.map(([v, label]) => (
          <button key={v} className="chip chip-sm" aria-pressed={filter === v} onClick={() => setFilter(v)} type="button">
            {label}
            <span className="chip-count">{counts[v as Filter]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="surface">
          <p className="card-sub" style={{ margin: 0 }}>
            No topics in this state yet.
          </p>
        </div>
      ) : (
        <div className="topic-list">
          {list.map((t) => (
            <article key={t.slug} className="surface-tight topic-row">
              <div className="topic-main">
                <div className="topic-head">
                  <span className="list-title">{t.title}</span>
                  <StatusBadge status={t.status as Status} />
                  {t.attempts === 0 ? <span className="tag">Not started</span> : null}
                  {t.breadth <= 1 && t.attempts > 0 ? (
                    <span className="tag tag-review" title="Judged on one signal only">
                      Thin evidence
                    </span>
                  ) : null}
                </div>
                <span className="list-sub">
                  {t.course ?? "No course"} · last activity {relative(t.lastStudied, t.daysSince)}
                </span>
                <div className="topic-signals">{signalChips(t)}</div>
              </div>

              <div className="topic-score">
                <span className="topic-score-value">{Math.round(t.score * 100)}%</span>
                <div
                  className="progress-line"
                  role="progressbar"
                  aria-valuenow={Math.round(t.score * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${t.title} mastery`}
                >
                  <i style={{ width: `${Math.max(t.score * 100, t.attempts > 0 ? 3 : 0)}%` }} />
                </div>
              </div>

              <div className="topic-actions">
                <Link className="btn btn-sm" href={t.action.target}>
                  {t.action.label}
                </Link>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={pending || busy === t.slug}
                  onClick={() => act(t.slug)}
                  type="button"
                >
                  {busy === t.slug ? "Starting…" : "Start path"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}