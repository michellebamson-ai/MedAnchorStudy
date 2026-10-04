"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualItem, regeneratePlan, type DayView, type PlanItemView, type PlanSnapshot } from "@/app/plan/actions";
import { fitItemsToWindow, formatMinutes } from "@/lib/planner";
import { PlanItemRow } from "@/components/plan/plan-item-row";

const WINDOWS = [30, 60, 90, 120];

/**
 * Today's plan — the hero (STUDY_PLAN_SPEC.md §4): concrete activities for
 * today, with a time filter so the student can say "I only have an hour" and
 * still get an honest, ordered answer.
 */
export function TodaySection({
  snapshot,
  onMessage,
  onStatus,
  onDelete,
}: {
  snapshot: PlanSnapshot;
  onMessage: (m: string) => void;
  onStatus: (id: string, status: "planned" | "in_progress" | "done" | "missed") => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [windowMinutes, setWindowMinutes] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const today: DayView = snapshot.days[0];
  const items = useMemo(() => today?.items ?? [], [today]);
  const open = items.filter((i) => i.status !== "done");
  const done = items.filter((i) => i.status === "done");

  const fitted = useMemo(
    () => (windowMinutes ? fitItemsToWindow(items, windowMinutes) : null),
    [items, windowMinutes]
  );
  const fitting = useMemo(() => {
    if (!fitted) return null;
    const inWindow = fitted.filter((f) => f.fits);
    return {
      inWindow,
      out: fitted.filter((f) => !f.fits),
      used: inWindow.reduce((s, f) => s + f.estMinutes, 0),
    };
  }, [fitted]);

  function regenerate() {
    start(async () => {
      const res = await regeneratePlan(undefined, "today");
      onMessage(res.message);
      if (res.ok) router.refresh();
    });
  }

  function add(title: string, minutes: number, activity: string) {
    start(async () => {
      const res = await addManualItem({
        title,
        date: new Date().toISOString(),
        estMinutes: minutes,
        activity,
        topicSlug: null,
      });
      onMessage(res.message);
      if (res.ok) {
        setAdding(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="surface plan-today" aria-labelledby="today-heading">
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <div>
          <h2 id="today-heading" className="display-sm" style={{ margin: 0 }}>
            <span aria-hidden="true">▦</span> Today
          </h2>
          <p className="list-sub" style={{ margin: "4px 0 0" }}>
            {formatMinutes(snapshot.todayMinutes)} planned · {formatMinutes(snapshot.todayDoneMinutes)} done ·{" "}
            {open.length} left
          </p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setAdding((a) => !a)} type="button" aria-expanded={adding}>
            + Add a task
          </button>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={regenerate} type="button">
            {pending ? "Rebuilding…" : "Regenerate today’s plan"}
          </button>
        </div>
      </div>

      {/* ---------------- Time-aware planning ---------------- */}
      <div className="plan-window">
        <span className="label">How much time do you have?</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Available time today">
          {WINDOWS.map((m) => (
            <button
              key={m}
              className="chip chip-sm"
              aria-pressed={windowMinutes === m}
              onClick={() => setWindowMinutes(windowMinutes === m ? null : m)}
              type="button"
            >
              {formatMinutes(m)}
            </button>
          ))}
          {windowMinutes ? (
            <button className="chip chip-sm" onClick={() => setWindowMinutes(null)} type="button">
              Show everything
            </button>
          ) : null}
        </div>
        {fitting ? (
          <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
            With {formatMinutes(windowMinutes ?? 0)} you can finish {fitting.inWindow.length} of {items.length}{" "}
            task{items.length === 1 ? "" : "s"} — {formatMinutes(fitting.used)} of work
            {fitting.out.length
              ? `, leaving ${fitting.out.length} for another sitting.`
              : ", which clears today."}
          </p>
        ) : null}
      </div>

      {adding ? (
        <AddTaskForm pending={pending} onCancel={() => setAdding(false)} onAdd={add} />
      ) : null}

      {snapshot.missedCount > 0 ? (
        <div className="alert alert-warn" style={{ marginBottom: "var(--sp-4)" }}>
          {snapshot.missedCount} session{snapshot.missedCount === 1 ? "" : "s"} went unfinished. Switch to{" "}
          <b>Catch-Up</b> and the planner moves them forward without piling them onto one day.
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nothing planned for today yet</div>
          <div>
            Add an exam or deadline, tell the planner how much time you have, and it will fill this in.
          </div>
        </div>
      ) : (
        <div className="plan-rows">
          {(fitting ? fitting.inWindow : items).map((item) => (
            <PlanItemRow
              key={item.id}
              item={item as PlanItemView}
              onStatus={onStatus}
              onDelete={onDelete}
            />
          ))}
          {fitting && fitting.out.length ? (
            <details className="plan-overflow">
              <summary>
                {fitting.out.length} task{fitting.out.length === 1 ? "" : "s"} that {windowMinutes} minutes does not cover
              </summary>
              <div className="plan-rows" style={{ marginTop: "var(--sp-3)" }}>
                {fitting.out.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item as PlanItemView}
                    onStatus={onStatus}
                    onDelete={onDelete}
                    windowNote={`Outside your ${formatMinutes(windowMinutes ?? 0)} window — start it anyway if you have more time.`}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}

      {done.length ? (
        <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
          {done.length} task{done.length === 1 ? "" : "s"} finished today. That counts towards your week.
        </p>
      ) : null}
    </section>
  );
}

function AddTaskForm({
  pending,
  onAdd,
  onCancel,
}: {
  pending: boolean;
  onAdd: (title: string, minutes: number, activity: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [activity, setActivity] = useState("teach_me");

  return (
    <div className="surface-tight plan-add" style={{ marginBottom: "var(--sp-4)" }}>
      <div className="field">
        <label className="label" htmlFor="plan-add-title">
          Task
        </label>
        <input
          id="plan-add-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Re-read the sepsis notes"
        />
      </div>
      <div className="row" style={{ marginTop: "var(--sp-3)" }}>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label className="label" htmlFor="plan-add-min">
            Minutes
          </label>
          <input
            id="plan-add-min"
            className="input"
            type="number"
            min={5}
            max={240}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label className="label" htmlFor="plan-add-activity">
            Type
          </label>
          <select
            id="plan-add-activity"
            className="input"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          >
            <option value="teach_me">Teach Me</option>
            <option value="quiz">Practice Questions</option>
            <option value="case">Case</option>
            <option value="flashcard">Flashcards</option>
            <option value="review">Review</option>
          </select>
        </div>
      </div>
      <div className="row" style={{ marginTop: "var(--sp-3)" }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={pending || !title.trim()}
          onClick={() => onAdd(title, minutes, activity)}
          type="button"
        >
          Add to today
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}