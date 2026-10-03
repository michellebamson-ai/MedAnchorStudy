"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  WORK_STEPS,
  type WorkStepId,
} from "@/components/tutor/assignment-model";
import {
  assignmentChat,
  completeStep,
  finishAssignment,
} from "@/app/teach/assignment-actions";

export interface AssignmentData {
  id: string;
  title: string;
  course: string | null;
  kind: string;
  dueAt: Date | null;
  status: string;
  notes: string | null;
  steps: unknown;
  materialIds: string[];
}

const STEP_GUIDE: Record<WorkStepId, { intro: string; prompt: string }> = {
  understand: {
    intro: "First, let's make sure you know exactly what is being asked.",
    prompt: "In your own words: what is this assignment asking you to do?",
  },
  research: {
    intro: "Now gather reliable sources. Prefer peer-reviewed work and guidelines; note who wrote each source, how recent it is, and how strong its evidence is.",
    prompt: "What is your research question, in one sentence?",
  },
  plan: {
    intro: "A good outline is half the work. We'll build it one part at a time.",
    prompt: "What are the parts of your outline so far?",
  },
  build: {
    intro: "You write; I react. Give me your main point and the evidence behind it.",
    prompt: "What is your main point, and what evidence supports it?",
  },
  check: {
    intro: "Time to stress-test the reasoning. Paste a paragraph and I'll find weak points, gaps and claims without evidence.",
    prompt: "Paste a paragraph you want checked.",
  },
  improve: {
    intro: "Paste a draft section and I'll comment on structure, clarity, evidence and reasoning — then you fix the rest.",
    prompt: "Paste the section you want feedback on.",
  },
};

const STEP_PILLS: Array<[string, string]> = [
  ["hint", "Hint"],
  ["explain", "Explain this"],
  ["example", "Show an example"],
  ["reasoning", "Check my reasoning"],
  ["source", "Find a source"],
  ["citations", "Check my citations"],
];

interface Msg {
  id: number;
  who: "tutor" | "student";
  text: string;
}

/**
 * Assignment workspace (TUTOR_SPEC.md §2): six steps in any order, chat with
 * the tutor in floating bubbles, guidance that never writes the work.
 */
export function AssignmentWorkspace({ assignment }: { assignment: AssignmentData }) {
  const router = useRouter();
  const done = new Set(((assignment.steps as { done?: string[] } | null)?.done ?? []) as string[]);
  const [step, setStep] = useState<WorkStepId>("understand");
  const [doneSteps, setDoneSteps] = useState<Set<string>>(done);
  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, who: "tutor", text: `${STEP_GUIDE.understand.intro} ${STEP_GUIDE.understand.prompt}` },
  ]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState<{ wentWell: string[]; workOn: string[]; nextSteps: string[] } | null>(null);
  const [pending, start] = useTransition();
  const idRef = useRef(10);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  function switchStep(s: WorkStepId) {
    setStep(s);
    setMessages((m) => [
      ...m,
      { id: (idRef.current += 1), who: "tutor", text: `${STEP_GUIDE[s].intro} ${STEP_GUIDE[s].prompt}` },
    ]);
  }

  async function send(text: string) {
    const answer = text.trim();
    if (!answer || typing || finished) return;
    setDraft("");
    setError("");
    const transcript = messages.slice(-8).map((m) => ({ role: m.who, text: m.text }));
    setMessages((m) => [...m, { id: (idRef.current += 1), who: "student", text: answer }]);
    setTyping(true);
    try {
      const res = await assignmentChat({ assignmentId: assignment.id, step, transcript, answer });
      setMessages((m) => [...m, { id: (idRef.current += 1), who: "tutor", text: res.text }]);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setTyping(false);
    }
  }

  function markDone() {
    start(async () => {
      const res = await completeStep(assignment.id, step);
      if (res.ok) {
        setDoneSteps(new Set(res.done));
        router.refresh();
      }
    });
  }

  function finish() {
    start(async () => {
      const res = await finishAssignment(assignment.id);
      setFinished(res);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="teach-topbar">
        <Link className="icon-btn" href="/teach?tab=assignments" aria-label="Back to assignments">
          <span aria-hidden="true">←</span>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="teach-name">{assignment.title}</div>
          <div className="teach-context">
            {[assignment.course, assignment.kind, assignment.dueAt ? `due ${new Date(assignment.dueAt).toLocaleDateString()}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>

      <div className="stepper" role="group" aria-label="Assignment steps" style={{ marginBottom: "var(--sp-6)" }}>
        {WORK_STEPS.map((s) => (
          <button
            key={s.id}
            className="step-tab"
            aria-current={step === s.id ? "step" : undefined}
            onClick={() => switchStep(s.id)}
            type="button"
          >
            {doneSteps.has(s.id) ? (
              <span className="step-check" aria-hidden="true">
                ✓
              </span>
            ) : null}
            {s.label}
          </button>
        ))}
      </div>

      <div className="tbubbles" aria-live="polite">
        {messages.map((m, i) =>
          m.who === "student" ? (
            <div key={m.id} className="tturn">
              <div className="tbubble tbubble-student">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="tturn">
              <div className="tbubble-row">
                {i === 0 || messages[i - 1]?.who !== "tutor" ? (
                  <span className="tutor-mark" aria-hidden="true">
                    ⚓
                  </span>
                ) : (
                  <span style={{ width: 26, flex: "none" }} aria-hidden="true" />
                )}
                <div className="tbubble tbubble-tutor">{m.text}</div>
              </div>
            </div>
          )
        )}
        {typing ? (
          <div className="tturn">
            <div className="tbubble-row">
              <span className="tutor-mark" aria-hidden="true">
                ⚓
              </span>
              <div className="tbubble tbubble-tutor" aria-label="Tutor is writing">
                <span className="typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {finished ? (
          <div className="session-summary">
            <span className="eyebrow">Assignment finished</span>
            <h3>How it went</h3>
            <h4 className="card-title">Went well</h4>
            <ul className="summary-list">
              {finished.wentWell.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <h4 className="card-title">Work on</h4>
            <ul className="summary-list">
              {finished.workOn.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="row" style={{ marginTop: "var(--sp-5)" }}>
              <Link className="btn btn-primary" href="/materials?tab=questions">
                Practice this
              </Link>
              <Link className="btn" href="/plan">
                Add review to my plan
              </Link>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {!finished ? (
        <>
          <div className="quickpills" role="group" aria-label="Quick actions">
            {STEP_PILLS.map(([kind, label]) => (
              <button
                key={kind}
                className="quickpill"
                onClick={() => {
                  const prompts: Record<string, string> = {
                    hint: "Give me a hint for this step.",
                    explain: "Explain this step in plain words.",
                    example: "Show me an example — about a different topic so I can't copy it.",
                    reasoning: `Check my reasoning so far: ${draft || "(I'll paste my text next)"}`,
                    source: "How do I judge whether a source is reliable for this?",
                    citations: "How should I check my citations and reference list?",
                  };
                  send(prompts[kind]);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="composer-float">
            <input
              placeholder="Write to the tutor…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send(draft);
                }
              }}
              aria-label="Write to the tutor"
            />
            <button
              className="send-round"
              onClick={() => send(draft)}
              disabled={!draft.trim() || typing}
              type="button"
              aria-label="Send"
            >
              <span aria-hidden="true">↑</span>
            </button>
          </div>

          <div className="row" style={{ marginTop: "var(--sp-4)" }}>
            <button className="btn btn-sm" disabled={pending} onClick={markDone} type="button">
              {doneSteps.has(step) ? "✓ Step done" : "Mark step done"}
            </button>
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={finish} type="button">
              Finish assignment
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
