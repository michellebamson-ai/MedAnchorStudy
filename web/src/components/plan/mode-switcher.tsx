"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MODES, type PlanMode } from "@/lib/planner";
import { setMode } from "@/app/plan/actions";

/**
 * Study modes (STUDY_PLAN_SPEC.md §7). Choosing one immediately rebuilds
 * today's plan with that emphasis and says what changed.
 */
export function ModeSwitcher({
  mode,
  onMessage,
}: {
  mode: PlanMode;
  onMessage: (m: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function choose(next: PlanMode) {
    setOpen(false);
    if (next === mode) return;
    start(async () => {
      const res = await setMode(next);
      onMessage(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="plan-modes" aria-labelledby="modes-heading">
      <div className="row-between" style={{ marginBottom: "var(--sp-3)" }}>
        <h2 id="modes-heading" className="section-title" style={{ margin: 0 }}>
          Study mode
        </h2>
        <span className="list-sub">{MODES[mode].blurb}</span>
      </div>
      <div className="chips" role="group" aria-label="Study mode">
        {Object.values(MODES).map((m) => (
          <button
            key={m.id}
            className="chip"
            aria-pressed={mode === m.id}
            disabled={pending}
            onClick={() => choose(m.id)}
            type="button"
            title={m.blurb}
          >
            {m.label}
          </button>
        ))}
        <button className="chip chip-sm" onClick={() => setOpen((o) => !o)} type="button" aria-expanded={open}>
          What do these do?
        </button>
      </div>
      {open ? (
        <ul className="plan-mode-help">
          {Object.values(MODES).map((m) => (
            <li key={m.id}>
              <b>{m.label}</b>
              <span>{m.blurb}</span>
              <span className="hint">
                ~{m.blockMinutes} min blocks · up to {m.maxPerDay} a day · looks {m.horizon} days ahead
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}