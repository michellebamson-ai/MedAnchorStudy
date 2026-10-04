"use client";

import Link from "next/link";
import type { PlanItemView } from "@/app/plan/actions";

const STATUS_LABEL: Record<string, string> = {
  planned: "Not started",
  in_progress: "In progress",
  done: "Done",
  missed: "Missed",
};

/**
 * One planned activity (STUDY_PLAN_SPEC.md §4): what it is, how long, where it
 * stands, why the planner chose it, and a way straight into the activity.
 */
export function PlanItemRow({
  item,
  onStatus,
  onDelete,
  windowNote,
}: {
  item: PlanItemView;
  onStatus?: (id: string, status: "planned" | "in_progress" | "done" | "missed") => void;
  onDelete?: (id: string) => void;
  /** Set when the row falls outside the time the student said they have. */
  windowNote?: string;
}) {
  const done = item.status === "done";
  const missed = item.status === "missed";
  const startable = item.target && item.target !== "/plan";

  return (
    <article className="plan-row" data-status={item.status} data-dimmed={windowNote ? "yes" : undefined}>
      <span className="plan-row-icon" aria-hidden="true">
        {item.icon}
      </span>
      <div className="plan-row-main">
        <div className="plan-row-head">
          <span className="plan-row-title">{item.title}</span>
          <span className="plan-row-meta">
            <span className="tag">{item.activityLabel}</span>
            <span className="plan-row-min">{item.estMinutes} min</span>
            {item.origin === "spaced_repetition" ? <span className="tag tag-review">Review</span> : null}
          </span>
        </div>
        {item.reason ? <p className="plan-row-reason">{item.reason}</p> : null}
        {windowNote ? <p className="plan-row-window">{windowNote}</p> : null}
      </div>
      <div className="plan-row-side">
        <span className="plan-row-status" data-status={item.status}>
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
        <div className="plan-row-actions">
          {startable && !done ? (
            <Link className="btn btn-primary btn-sm" href={item.target}>
              Start
            </Link>
          ) : null}
          {onStatus && !done ? (
            <>
              <button
                className="btn btn-sm"
                onClick={() => onStatus(item.id, "in_progress")}
                type="button"
                disabled={item.status === "in_progress"}
              >
                {item.status === "in_progress" ? "Started" : "Start later"}
              </button>
              <button className="btn btn-sm" onClick={() => onStatus(item.id, "done")} type="button">
                Mark done
              </button>
            </>
          ) : null}
          {onStatus && done ? (
            <button className="btn btn-ghost btn-sm" onClick={() => onStatus(item.id, "planned")} type="button">
              Undo
            </button>
          ) : null}
          {onStatus && !done ? (
            <button className="btn btn-ghost btn-sm" onClick={() => onStatus(item.id, "missed")} type="button">
              I missed this
            </button>
          ) : null}
          {onDelete && item.origin !== "spaced_repetition" ? (
            <button className="btn btn-ghost btn-sm" onClick={() => onDelete(item.id)} type="button" aria-label={`Remove ${item.title}`}>
              ✕
            </button>
          ) : null}
        </div>
      </div>
      {missed ? <span className="plan-row-flag">Catch-Up will move this forward</span> : null}
    </article>
  );
}