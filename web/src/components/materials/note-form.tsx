"use client";

import { useActionState } from "react";
import { saveNote, type ActionResult } from "@/app/materials/actions";

/**
 * "Add my own note" (MATERIALS_SPEC.md §3). Plain form — title, material,
 * body. Editing an app note saves a new version marked Edited; the original
 * stays untouched.
 */
export function NoteForm({
  documents,
  preselectedDoc,
}: {
  documents: Array<{ id: string; title: string }>;
  preselectedDoc?: string;
}) {
  const [state, action, pending] = useActionState(
    (_prev: ActionResult | null, form: FormData) => saveNote(form),
    null
  );

  return (
    <section className="surface" id="compose">
      <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
        Write a note
      </h2>
      <form action={action} className="stack-sm">
        <div className="field">
          <label className="label" htmlFor="note-title">
            Title
          </label>
          <input
            className="input"
            id="note-title"
            name="title"
            placeholder="e.g. RAAS in my own words"
            required
          />
        </div>
        <div className="field">
          <label className="label">Material (optional)</label>
          {documents.length > 0 ? (
            <div className="chips" role="group" aria-label="Material" style={{ marginTop: "var(--sp-2)" }}>
              <label className="row" style={{ gap: 6, cursor: "pointer" }}>
                <input type="radio" name="documentId" value="" defaultChecked={!preselectedDoc} />
                <span className="hint">None</span>
              </label>
              {documents.slice(0, 6).map((d) => (
                <label key={d.id} className="row" style={{ gap: 6, cursor: "pointer" }}>
                  <input type="radio" name="documentId" value={d.id} defaultChecked={d.id === preselectedDoc} />
                  <span className="hint">{d.title}</span>
                </label>
              ))}
            </div>
          ) : (
            <span className="hint">No materials yet — the note will stand alone.</span>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="note-body">
            Note
          </label>
          <textarea
            className="textarea"
            id="note-body"
            name="body"
            style={{ minHeight: 160 }}
            placeholder={"Start with a heading on its own line, like:\n# What RAAS does\nThen explain it plainly…"}
            required
          />
          <span className="hint">Lines starting with # become headings.</span>
        </div>
        {state && !state.ok ? <div className="alert alert-danger">{state.message}</div> : null}
        {state?.ok ? <div className="alert alert-ok">{state.message}</div> : null}
        <div>
          <button className="btn btn-primary btn-sm" disabled={pending} type="submit">
            {pending ? "Saving…" : "Save note"}
          </button>
        </div>
      </form>
    </section>
  );
}
