"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAvailability } from "@/app/plan/actions";
import { formatMinutes } from "@/lib/planner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PRESETS = [30, 45, 60, 90, 120];

/**
 * Available study hours (STUDY_PLAN_SPEC.md §9). Per-weekday minutes, because
 * "10h a week" on a night shift is not the same as 10h across five evenings.
 */
export function AvailabilityForm({
  dayMinutes,
  weeklyHours,
  dailyGoalMinutes,
  onClose,
  onMessage,
}: {
  dayMinutes: number[];
  weeklyHours: number;
  dailyGoalMinutes: number;
  onClose: () => void;
  onMessage: (m: string) => void;
}) {
  const router = useRouter();
  const [days, setDays] = useState<number[]>(() => {
    const base = Array.from({ length: 7 }, (_, i) => dayMinutes[i] ?? 0);
    return base.some((m) => m > 0) ? base : [60, 60, 60, 60, 60, 90, 120];
  });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const total = days.reduce((s, m) => s + m, 0);

  function setDay(i: number, value: number) {
    setDays((d) => d.map((v, j) => (j === i ? Math.max(0, Math.min(300, value || 0)) : v)));
  }

  function applyPreset(minutes: number) {
    setDays((d) => d.map((v) => (v > 0 ? minutes : 0)));
  }

  function save() {
    if (pending) return;
    setError("");
    start(async () => {
      const res = await saveAvailability({
        dayMinutes: days,
        weeklyHours: Math.round(total / 60),
        dailyGoalMinutes,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onMessage(res.message);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="palette-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="availability-title">
        <div className="modal-head">
          <h2 id="availability-title" className="display-lg" style={{ margin: 0 }}>
            Your available study hours
          </h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="card-sub" style={{ marginTop: 0 }}>
            The planner never schedules more than you say you have. Be realistic — an over-full week is how
            plans collapse.
          </p>

          <div className="chips" style={{ margin: "var(--sp-4) 0" }} role="group" aria-label="Quick set">
            <span className="label" style={{ alignSelf: "center" }}>
              Set every study day to
            </span>
            {PRESETS.map((m) => (
              <button key={m} className="chip chip-sm" onClick={() => applyPreset(m)} type="button">
                {formatMinutes(m)}
              </button>
            ))}
          </div>

          <div className="plan-avail">
            {DAYS.map((label, i) => (
              <div className="plan-avail-row" key={label}>
                <label className="label" htmlFor={`avail-${i}`}>
                  {label}
                </label>
                <input
                  id={`avail-${i}`}
                  className="input plan-avail-input"
                  type="number"
                  min={0}
                  max={300}
                  step={15}
                  value={days[i] ?? 0}
                  onChange={(e) => setDay(i, Number(e.target.value))}
                />
                <span className="hint">min</span>
                {days[i] > 0 ? (
                  <span className="list-sub">
                    {(() => {
                      const start = new Date();
                      start.setHours(19, 0, 0, 0);
                      const end = new Date(start.getTime() + days[i] * 60000);
                      return `≈ ${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
                    })()}
                  </span>
                ) : (
                  <span className="hint">rest day</span>
                )}
              </div>
            ))}
          </div>

          <div className="alert alert-info" style={{ marginTop: "var(--sp-4)" }}>
            That is <b>{(total / 60).toFixed(1)} hours a week</b> across {days.filter((m) => m > 0).length}{" "}
            day{days.filter((m) => m > 0).length === 1 ? "" : "s"} — currently set as {weeklyHours}h. Saving rebuilds
            the week around these hours.
          </div>

          {error ? <div className="alert alert-danger" style={{ marginTop: "var(--sp-3)" }}>{error}</div> : null}

          <div className="row" style={{ marginTop: "var(--sp-4)" }}>
            <button className="btn btn-primary" disabled={pending || total <= 0} onClick={save} type="button">
              {pending ? "Rebuilding…" : "Save and rebuild my week"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}