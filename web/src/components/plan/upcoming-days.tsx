"use client";

import { useState } from "react";
import type { PlanItemView, PlanSnapshot } from "@/app/plan/actions";
import { formatMinutes } from "@/lib/planner";
import { PlanItemRow } from "@/components/plan/plan-item-row";

/**
 * Upcoming (STUDY_PLAN_SPEC.md §5): the next seven days, each expandable so the
 * student can see the full list instead of only a preview.
 */
export function UpcomingDays({
  snapshot,
  onStatus,
  onDelete,
}: {
  snapshot: PlanSnapshot;
  onStatus: (id: string, status: "planned" | "in_progress" | "done" | "missed") => void;
  onDelete: (id: string) => void;
}) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = snapshot.days.slice(1);

  return (
    <section className="plan-upcoming" aria-labelledby="upcoming-heading">
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <h2 id="upcoming-heading" className="section-title" style={{ margin: 0 }}>
          Upcoming
        </h2>
        <span className="list-sub">Next {days.length} days, built from your available hours</span>
      </div>

      <div className="plan-days">
        {days.map((day) => {
          const open = openDay === day.key;
          const total = day.items.reduce((s, i) => s + i.estMinutes, 0);
          const doneCount = day.items.filter((i) => i.status === "done").length;
const preview = day.items
              .filter((i) => i.status !== "done")
              .slice(0, 2)
              .map((i) => i.title);
            const restDay = day.capacityMinutes === 0;

          return (
            <div key={day.key} className="surface-tight plan-day" data-open={open ? "yes" : undefined}>
              <button
                className="plan-day-head"
                onClick={() => setOpenDay(open ? null : day.key)}
                aria-expanded={open}
                type="button"
              >
                <span className="plan-day-date">
                  <b>{day.label}</b>
                  <span className="list-sub">
                    {day.items.length} task{day.items.length === 1 ? "" : "s"} · {formatMinutes(total)}
                    {doneCount ? ` · ${doneCount} done` : ""}
                  </span>
                </span>
                <span className="plan-day-preview">
                  {preview.length
                    ? preview.join(" · ")
                    : restDay
                      ? "Rest day — you said you have no time"
                      : day.items.length
                        ? "Everything done"
                        : "Nothing planned — time is still free"}
                </span>
                <span className="plan-day-toggle" aria-hidden="true">
                  {open ? "−" : "+"}
                </span>
              </button>
              {open ? (
                day.items.length ? (
                  <div className="plan-rows" style={{ marginTop: "var(--sp-3)" }}>
                    {day.items.map((item: PlanItemView) => (
                      <PlanItemRow key={item.id} item={item} onStatus={onStatus} onDelete={onDelete} />
                    ))}
                  </div>
                ) : (
                  <p className="hint" style={{ marginTop: "var(--sp-3)" }}>
                    {restDay
                      ? "You marked this day as having no study time, so nothing was scheduled."
                      : "Nothing planned yet — this time is still free. The planner fills days in priority order, so lower-priority work only appears once higher-value work has a slot."}
                  </p>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}