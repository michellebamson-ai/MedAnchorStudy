"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNMENT_TYPES } from "@/components/tutor/assignment-model";
import { createAssignment } from "@/app/teach/assignment-actions";

/**
 * Assignment start screen (TUTOR_SPEC.md §2). Paste the brief, pick type /
 * course / deadline / materials, see started assignments, Start.
 */
export function AssignmentSetup({
  courses,
  documents,
  assignments,
}: {
  courses: string[];
  documents: Array<{ id: string; title: string }>;
  assignments: Array<{
    id: string;
    title: string;
    course: string | null;
    kind: string;
    dueAt: Date | null;
    status: string;
    steps: unknown;
  }>;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [kind, setKind] = useState<string>("");
  const [course, setCourse] = useState(courses[0] ?? "");
  const [customCourse, setCustomCourse] = useState("");
  const [due, setDue] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function startNow() {
    if (pending) return;
    setError("");
    start(async () => {
      const res = await createAssignment({
        brief,
        kind,
        course: course === "__other" ? customCourse : course,
        dueAt: due,
        materialIds: materials,
      });
      if (!res.ok || !res.id) {
        setError(res.message);
        return;
      }
      router.push(`/teach?tab=assignments&assignment=${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <section className="surface">
        <span className="eyebrow">Add an assignment</span>
        <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
          What are you working on?
        </h2>
        <div className="field">
          <label className="label" htmlFor="brief">Paste your assignment question or brief</label>
          <textarea
            id="brief"
            className="textarea"
            style={{ minHeight: 120 }}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Discuss the role of ACE inhibitors in heart failure management (2000 words)…"
          />
        </div>
        <div className="row" style={{ marginTop: "var(--sp-3)" }}>
          <span className="hint">Or:</span>
          <button className="btn btn-sm" type="button" onClick={() => router.push("/materials?tab=upload")}>
            Upload a file
          </button>
          <span className="hint">Photo capture arrives with the mobile apps.</span>
        </div>
        <div className="row" style={{ marginTop: "var(--sp-2)" }}>
          {["Moodle", "Canvas", "Blackboard"].map((lms) => (
            <button
              key={lms}
              className="btn btn-sm"
              type="button"
              onClick={() => setError(`We couldn't connect to ${lms}. Try again.`)}
            >
              Import from {lms}
            </button>
          ))}
        </div>
      </section>

      <section>
        <span className="label">Type</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Assignment type">
          {ASSIGNMENT_TYPES.map((t) => (
            <button key={t} className="chip" aria-pressed={kind === t} onClick={() => setKind(t)} type="button">
              {t}
            </button>
          ))}
        </div>
      </section>

      <section>
        <span className="label">Course</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Course">
          {courses.map((c) => (
            <button key={c} className="chip chip-sm" aria-pressed={course === c} onClick={() => setCourse(c)} type="button">
              {c}
            </button>
          ))}
          <button
            className="chip chip-sm"
            aria-pressed={course === "__other"}
            onClick={() => setCourse("__other")}
            type="button"
          >
            Other…
          </button>
        </div>
        {course === "__other" ? (
          <input
            className="input"
            style={{ marginTop: "var(--sp-2)", maxWidth: 320 }}
            placeholder="Type the course…"
            value={customCourse}
            onChange={(e) => setCustomCourse(e.target.value)}
            aria-label="Other course"
          />
        ) : null}
      </section>

      <section className="grid grid-2">
        <div className="field">
          <label className="label" htmlFor="due">Deadline — goes to your Study Plan</label>
          <input id="due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div>
          <span className="label">Materials the tutor may use</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Materials">
            {documents.length === 0 ? (
              <span className="hint">No materials yet.</span>
            ) : (
              documents.slice(0, 8).map((d) => (
                <button
                  key={d.id}
                  className="chip chip-sm"
                  aria-pressed={materials.includes(d.id)}
                  onClick={() =>
                    setMaterials((m) => (m.includes(d.id) ? m.filter((x) => x !== d.id) : [...m, d.id]))
                  }
                  type="button"
                >
                  {d.title}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div>
        <button className="btn btn-primary btn-block" style={{ minHeight: 54 }} disabled={pending} onClick={startNow} type="button">
          {pending ? "Starting…" : "Start"}
        </button>
      </div>

      {assignments.length > 0 ? (
        <section>
          <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
            Your assignments
          </h2>
          <div className="stack-sm">
            {assignments.map((a) => {
              const done = ((a.steps as { done?: string[] } | null)?.done ?? []).length;
              return (
                <button
                  key={a.id}
                  className="doc-row"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                  onClick={() => router.push(`/teach?tab=assignments&assignment=${a.id}`)}
                  type="button"
                >
                  <span style={{ flex: 1 }}>
                    <span className="list-title">{a.title}</span>
                    <span className="list-sub" style={{ display: "block" }}>
                      {[a.course, a.kind, a.dueAt ? `due ${new Date(a.dueAt).toLocaleDateString()}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="progress-line" style={{ marginTop: 6 }}>
                      <i style={{ width: `${Math.round((done / 6) * 100)}%` }} />
                    </span>
                    <span className="list-sub">{done} of 6 steps done</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="card-sub">
          Add an assignment to begin. I’ll help you work through it step by step.
        </p>
      )}
    </div>
  );
}
