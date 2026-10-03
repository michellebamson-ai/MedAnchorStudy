"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { answerStep, endCase, type PlayCase, type PlayStep } from "@/app/practice/case-actions";

interface StepResult {
  good: string[];
  missed: string[];
  why: string;
  gap: string | null;
  score: number;
}

interface EndSummary {
  wentWell: string[];
  missed: string[];
  gaps: string[];
  nextSteps: string[];
  score: number;
}

function useMic(onText: (t: string) => void) {
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<{ stop: () => void } | null>(null);

  function toggle() {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      setError("Voice isn't working right now. You can keep typing.");
      return;
    }
    if (live) {
      try {
        recRef.current?.stop();
      } catch {
        /* already stopped */
      }
      setLive(false);
      return;
    }
    try {
      const rec = new SR() as {
        lang: string;
        onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      rec.lang = "en-US";
      rec.onresult = (e) => onText(e.results[0][0].transcript);
      rec.onerror = () => {
        setError("Voice isn't working right now. You can keep typing.");
        setLive(false);
      };
      rec.onend = () => setLive(false);
      recRef.current = rec;
      rec.start();
      setLive(true);
      setError("");
    } catch {
      setError("Voice isn't working right now. You can keep typing.");
    }
  }

  return { live, error, toggle };
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 800)));
  } catch {
    /* no speech support */
  }
}

/**
 * Case runner (PRACTICE_SPEC.md Cases): progressive disclosure in floating
 * cards, decision + reasoning, feedback with gaps, notes, hints, voice.
 */
export function CaseRunner({
  attemptId,
  play,
  fromStep,
  onExit,
}: {
  attemptId: string;
  play: PlayCase;
  fromStep: number;
  onExit: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(Math.min(fromStep, Math.max(0, play.steps.length - 1)));
  const [decision, setDecision] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [result, setResult] = useState<StepResult | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [notes, setNotes] = useState("");
  const [voice, setVoice] = useState(false);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const mic = useMic((t) => setReasoning((r) => (r ? `${r} ${t}` : t)));
  const bottomRef = useRef<HTMLDivElement>(null);

  const step: PlayStep | undefined = play.steps[index];
  const done = index >= play.steps.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [index, result, summary]);

  useEffect(() => {
    if (voice && step && !result) speak(step.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, voice]);

  function submit() {
    if (!step || pending || result) return;
    if (!decision.trim() && step.choices.length) {
      setError("Pick an option first — then explain your thinking.");
      return;
    }
    if (!reasoning.trim()) {
      setError("Explain your reasoning in a sentence or two before moving on.");
      return;
    }
    setError("");
    start(async () => {
      try {
        const res = await answerStep({
          attemptId,
          stepIndex: index,
          decision: decision.trim() || "(typed answer)",
          reasoning: reasoning.trim(),
          usedHint,
        });
        setResult(res);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    });
  }

  function next() {
    if (index + 1 >= play.steps.length) {
      start(async () => {
        try {
          const res = await endCase(attemptId);
          setSummary(res);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
        }
      });
      return;
    }
    setIndex((i) => i + 1);
    setDecision("");
    setReasoning("");
    setResult(null);
    setUsedHint(false);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="teach-topbar">
        <button className="icon-btn" onClick={onExit} type="button" aria-label="Back to cases">
          <span aria-hidden="true">←</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="teach-name">{play.title}</div>
          <div className="teach-context">
            Step {Math.min(index + 1, play.steps.length)} of {play.steps.length}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={() => setVoice((v) => !v)}
          type="button"
          aria-label={voice ? "Turn voice off" : "Run this case by voice"}
          aria-pressed={voice}
          title="Run this case by voice"
        >
          <span aria-hidden="true">{voice ? "🔊" : "◉"}</span>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onExit} type="button" aria-label="Close case">
          ✕
        </button>
      </div>

      <div className="steps" style={{ marginBottom: "var(--sp-6)" }} aria-hidden="true">
        {play.steps.map((s, i) => (
          <span
            key={s.index}
            className="step-pip"
            data-state={i < index ? "done" : i === index ? "current" : "todo"}
          />
        ))}
      </div>

      {/* Earlier cards stay above so the student can look back. */}
      <div className="stack" aria-live="polite">
        {play.steps.slice(0, index).map((s) => (
          <div key={s.index} className="surface-tight" style={{ opacity: 0.75 }}>
            <span className="eyebrow">Step {s.index + 1}</span>
            <p style={{ margin: 0 }}>{s.prompt}</p>
          </div>
        ))}

        {!done && step ? (
          <div className="surface" key={step.index}>
            <span className="eyebrow">
              Step {index + 1} · {play.generated ? "AI-made scenario" : "Teaching case"}
            </span>
            <p className="quiz-stem" style={{ fontSize: "var(--fs-lg)" }}>
              {step.prompt}
            </p>

            {step.choices.length > 0 ? (
              <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
                {step.choices.map((c, i) => (
                  <button
                    key={c}
                    className={`option${!result && decision === c ? " option-correct" : ""}`}
                    disabled={!!result || pending}
                    onClick={() => setDecision(c)}
                    type="button"
                  >
                    <span className="option-marker">{String.fromCharCode(65 + i)}</span>
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="field" style={{ marginTop: "var(--sp-4)" }}>
                <label className="label" htmlFor="case-decision">Your decision</label>
                <input
                  id="case-decision"
                  className="input"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  disabled={!!result}
                  placeholder="What do you decide?"
                />
              </div>
            )}

            <div className="field" style={{ marginTop: "var(--sp-4)" }}>
              <label className="label" htmlFor="case-reasoning">Explain your reasoning</label>
              <textarea
                id="case-reasoning"
                className="textarea"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                disabled={!!result}
                placeholder="Why — in a sentence or two."
              />
            </div>

            <div className="row" style={{ marginTop: "var(--sp-3)" }}>
              {step.hint && !result ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setUsedHint(true);
                    setReasoning((r) => r);
                  }}
                  type="button"
                  title={step.hint}
                >
                  Hint{usedHint ? ` — ${step.hint}` : ""}
                </button>
              ) : null}
              <button className="btn btn-ghost btn-sm" onClick={() => mic.toggle()} type="button">
                {mic.live ? "■ Stop" : "◉ Speak"}
              </button>
              <Link className="btn btn-ghost btn-sm" href="/teach">
                Ask the tutor →
              </Link>
            </div>
            {mic.error ? <p className="hint" style={{ marginTop: 4 }}>{mic.error}</p> : null}

            {error ? <div className="alert alert-danger" style={{ marginTop: "var(--sp-3)" }}>{error}</div> : null}

            {!result ? (
              <div style={{ marginTop: "var(--sp-4)" }}>
                <button className="btn btn-primary" disabled={pending} onClick={submit} type="button">
                  {pending ? "Checking…" : "Submit decision"}
                </button>
              </div>
            ) : (
              <div className="quiz-explain">
                <b>
                  {result.score >= 0.6 ? "Good decision." : "Worth reconsidering."}{" "}
                  ({Math.round(result.score * 100)}%)
                </b>
                {result.good.length > 0 ? <p>What was good: {result.good.join(", ")}.</p> : null}
                {result.missed.length > 0 ? <p>What was missed: {result.missed.join(", ")}.</p> : null}
                <p>{result.why}</p>
                {result.gap ? (
                  <p>
                    <span className="tag tag-review">Knowledge gap</span>{" "}
                    <Link href="/teach">Ask the tutor about this →</Link>
                  </p>
                ) : null}
                <button className="btn btn-primary btn-sm" style={{ marginTop: "var(--sp-3)" }} onClick={next} type="button">
                  {index + 1 >= play.steps.length ? "Finish case" : "Next step"}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {summary ? (
          <div className="session-summary">
            <span className="eyebrow">Case complete</span>
            <h3>How it went</h3>
            {summary.wentWell.map((w) => (
              <p key={w} className="card-sub">{w}</p>
            ))}
            {summary.missed.map((m) => (
              <p key={m} className="card-sub">{m}</p>
            ))}
            {summary.gaps.map((g) => (
              <p key={g} className="card-sub">{g}</p>
            ))}
            <h4 className="card-title">Next steps</h4>
            <ul className="summary-list">
              {summary.nextSteps.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <div className="row" style={{ marginTop: "var(--sp-5)" }}>
              <Link className="btn btn-primary" href="/teach">
                Learn this with the tutor
              </Link>
              <button className="btn" onClick={onExit} type="button">
                Try another case
              </button>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="surface-tight" style={{ marginTop: "var(--sp-6)" }}>
        <label className="label" htmlFor="case-notes">Notes box — jot down thoughts</label>
        <textarea
          id="case-notes"
          className="textarea"
          style={{ minHeight: 64, marginTop: "var(--sp-2)" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Differential ideas, things to check…"
        />
      </div>
    </div>
  );
}
