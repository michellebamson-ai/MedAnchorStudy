"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDeadline, updateDeadline, type DeadlineView } from "@/app/plan/actions";

const KINDS: Array<[string, string]> = [
  ["exam", "Exam"],
  ["assignment", "Assignment"],
  ["presentation", "Presentation"],
  ["project", "Project"],
  ["revision", "Revision block"],
];

/** Add / edit a deadline (STUDY_PLAN_SPEC.md §6). Chips, not dropdowns. */
export function DeadlineForm({
  editing,
  onClose,
  onMessage,
}: {
  editing: DeadlineView | null;
  onClose: () => void;
  onMessage: (m: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [kind, setKind] = useState(editing?.kind ?? "exam");
  const [course, setCourse] = useState(editing?.course ?? "");
  const [date, setDate] = useState(editing ? editing.date.slice(0, 10) : "");
  const [notes, setNotes] = useState(editing?.notes && editing.notes !== "Managed in the AI Tutor" ? editing.notes : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (pending) return;
    setError("");
    start(async () => {
      const payload = { title, kind, course, date, notes };
      const res = editing ? await updateDeadline(editing.id, payload) : await addDeadline(payload);
      onMessage(res.message);
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="palette-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deadline-form-title">
        <div className="modal-head">
          <h2 id="deadline-form-title" className="display-lg" style={{ margin: 0 }}>
            {editing ? "Edit deadline" : "Add exam or deadline"}
          </h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="stack-sm">
            <div className="field">
              <label className="label" htmlFor="dl-title">
                Title
              </label>
              <input
                id="dl-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pharmacology midterm"
              />
            </div>

            <div className="field">
              <span className="label">Type</span>
              <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Deadline type">
                {KINDS.map(([v, label]) => (
                  <button key={v} className="chip chip-sm" aria-pressed={kind === v} onClick={() => setKind(v)} type="button">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="dl-date">
                Date
              </label>
              <input id="dl-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="field">
              <label className="label" htmlFor="dl-course">
                Course or subject <span className="hint">(optional)</span>
              </label>
              <input
                id="dl-course"
                className="input"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Pharmacology"
              />
              <span className="hint">
                Linking a course lets the planner schedule that course&apos;s topics. Matching happens on the
                course name and your deadline title.
              </span>
            </div>

            <div className="field">
              <label className="label" htmlFor="dl-notes">
                Notes <span className="hint">(optional)</span>
              </label>
              <textarea
                id="dl-notes"
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Chapters to cover, rooms, anything the planner should know."
              />
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}

            <div className="row">
              <button className="btn btn-primary" disabled={pending} onClick={save} type="button">
                {pending ? "Saving…" : editing ? "Save changes" : "Add and rebuild plan"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}