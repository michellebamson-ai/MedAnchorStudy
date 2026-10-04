"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeDeadline,
  deleteDeadline,
  type DeadlineView,
  type PlanSnapshot,
} from "@/app/plan/actions";
import { formatDayLabel } from "@/lib/planner";
import { DeadlineForm } from "@/components/plan/deadline-form";

const KIND_LABEL: Record<string, string> = {
  exam: "Exam",
  assignment: "Assignment",
  presentation: "Presentation",
  project: "Project",
  revision: "Revision",
};

/**
 * Exams & deadlines (STUDY_PLAN_SPEC.md §6). Items close to the date are
 * highlighted; assignments owned by the AI Tutor are shown but not edited here.
 */
export function DeadlineList({
  snapshot,
  onMessage,
  onAdd,
}: {
  snapshot: PlanSnapshot;
  onMessage: (m: string) => void;
  onAdd: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<DeadlineView | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      const res = await fn();
      onMessage(res.message);
      if (res.ok) router.refresh();
    });
  }

  const items = snapshot.deadlines;
  const nextExamId = snapshot.nextExam
    ? items.find((d) => d.editable && d.kind === "exam" && d.date === snapshot.nextExam?.date)?.id
    : null;

  return (
    <section className="plan-deadlines" aria-labelledby="deadlines-heading">
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <h2 id="deadlines-heading" className="section-title" style={{ margin: 0 }}>
          Exams &amp; deadlines
        </h2>
        <button className="btn btn-sm" onClick={onAdd} type="button">
          + Add exam / deadline
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Add your next exam or deadline to get a smarter plan</div>
          <div>
            With at least one date, the planner can work backwards: which topics to teach, what to practise, and
            when spaced reviews should land.
          </div>
          <div style={{ marginTop: "var(--sp-4)" }}>
            <button className="btn btn-primary" onClick={onAdd} type="button">
              + Add exam / deadline
            </button>
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          {items.map((d) => {
            const soon = d.daysLeft >= 0 && d.daysLeft <= 7;
            const past = d.daysLeft < 0 && !d.completed;
            return (
              <article key={d.id} className="surface-tight plan-deadline" data-soon={soon ? "yes" : undefined}>
                <div className="plan-deadline-main">
                  <div className="plan-deadline-head">
                    <span className="list-title">{d.title}</span>
                    <span className="tag">{KIND_LABEL[d.kind] ?? d.kind}</span>
                    {d.id === nextExamId ? <span className="tag tag-exam">Next exam</span> : null}
                    {d.completed ? <span className="tag tag-review">Done</span> : null}
                  </div>
                  <span className="list-sub">
                    {formatDayLabel(new Date(d.date))} · {d.course ?? "No course linked"}
                    {d.linkedTopics ? ` · ${d.linkedTopics} topic${d.linkedTopics === 1 ? "" : "s"} matched` : ""}
                  </span>
                  {d.notes ? <p className="plan-deadline-notes">{d.notes}</p> : null}
                </div>
                <div className="plan-deadline-side">
                  <span className="plan-deadline-days" data-soon={soon ? "yes" : undefined} data-past={past ? "yes" : undefined}>
                    {past ? `${Math.abs(d.daysLeft)}d ago` : d.daysLeft === 0 ? "Today" : `${d.daysLeft}d`}
                  </span>
                  {d.editable ? (
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setOpenMenu(openMenu === d.id ? null : d.id)} type="button" aria-expanded={openMenu === d.id} aria-label={`Actions for ${d.title}`}>
                        ⋯
                      </button>
                      {openMenu === d.id ? (
                        <div className="plan-menu">
                          <button className="plan-menu-item" onClick={() => { setEditing(d); setOpenMenu(null); }} type="button">
                            Edit
                          </button>
                          <button className="plan-menu-item" onClick={() => act(() => completeDeadline(d.id, !d.completed))} type="button">
                            {d.completed ? "Reopen" : "Mark done"}
                          </button>
                          <button className="plan-menu-item" data-danger="yes" onClick={() => act(() => deleteDeadline(d.id))} type="button">
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="hint">In AI Tutor</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <DeadlineForm
          editing={editing}
          onClose={() => setEditing(null)}
          onMessage={(m) => {
            onMessage(m);
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}