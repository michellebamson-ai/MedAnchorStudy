"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkSoap,
  endComm,
  replyComm,
  type EndCommResult,
} from "@/app/practice/comm-actions";

export interface CommSessionConfig {
  scenarioId: string;
  title: string;
  character: string;
  characterLabel: string;
  kind: string;
  kindLabel: string;
  personality: string;
  challenge?: string;
  difficulty: number;
  mode: "text" | "voice";
  brief: string;
  opening: string;
  hiddenFacts: string[];
}

interface Msg {
  id: number;
  who: "student" | "character";
  text: string;
}

interface TraceEntry {
  empathy: number;
  questioning: number;
  clarity: number;
  notes: string[];
  text: string;
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
      setError("Microphone blocked: allow the microphone to speak. You can use text instead.");
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

const EXAM_SECONDS = 8 * 60;

/**
 * Conversation screen (PRACTICE_SPEC.md Communication): brief card, text or
 * voice conversation with an adaptive character, tools, then four-part
 * feedback with scores — plus OSCE checklist mode and SOAP practice.
 */
export function CommSession({
  config,
  onExit,
  soapOnly,
}: {
  config: CommSessionConfig;
  onExit: () => void;
  soapOnly?: boolean;
}) {
  const router = useRouter();
  const examMode = config.difficulty >= 4;
  const [mode, setMode] = useState<"text" | "voice">(config.mode);
  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, who: "character", text: config.opening },
  ]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [rapport, setRapport] = useState(0);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(EXAM_SECONDS);
  const [feedback, setFeedback] = useState<EndCommResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [soapResult, setSoapResult] = useState<{
    checks: Array<{ section: string; ok: boolean; note: string }>;
    model: string[];
  } | null>(null);
  const mic = useMic((t) => setDraft((d) => (d ? `${d} ${t}` : t)));
  const idRef = useRef(10);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  useEffect(() => {
    if (!examMode || feedback || paused || soapOnly) return;
    if (left <= 0) {
      end();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, examMode, feedback, paused, soapOnly]);

  // Voice mode reads the character aloud; visible bubbles are the captions,
  // and the full list below is the transcript.
  useEffect(() => {
    if (mode !== "voice") return;
    const last = messages[messages.length - 1];
    if (last?.who === "character") speak(last.text);
  }, [messages, mode]);

  async function send(text: string) {
    const answer = text.trim();
    if (!answer || typing || feedback) return;
    setDraft("");
    setError("");
    const transcript = messages.map((m) => ({ role: m.who, text: m.text }));
    setMessages((m) => [...m, { id: nextId(), who: "student", text: answer }]);
    setTyping(true);
    try {
      const res = await replyComm({
        scenarioId: config.scenarioId,
        personality: config.personality,
        character: config.character,
        kind: config.kind,
        brief: config.brief,
        hiddenFacts: config.hiddenFacts,
        revealed,
        rapport,
        challenge: config.challenge,
        examMode,
        transcript,
        answer,
      });
      setRapport(res.rapport);
      setRevealed(res.revealed);
      setTrace((t) => [
        ...t,
        { empathy: res.empathy, questioning: res.questioning, clarity: res.clarity, notes: res.notes, text: answer.slice(0, 200) },
      ]);
      setMessages((m) => [...m, { id: nextId(), who: "character", text: res.text }]);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setTyping(false);
    }
  }

  function end() {
    if (pending || feedback) return;
    start(async () => {
      try {
        const res = await endComm({
          scenarioId: config.scenarioId,
          transcript: messages.map((m) => ({ role: m.who, text: m.text })),
          revealed,
          trace,
          examMode,
        });
        setFeedback(res);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    });
  }

  function checkSoapNote() {
    start(async () => {
      try {
        const res = await checkSoap({ scenarioId: config.scenarioId, sections: soap });
        setSoapResult(res);
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  const mm = Math.floor(Math.max(0, left) / 60);
  const ss = String(Math.max(0, left) % 60).padStart(2, "0");

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="teach-topbar">
        <button className="icon-btn" onClick={onExit} type="button" aria-label="Back">
          <span aria-hidden="true">←</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="teach-name">
            {config.characterLabel} · {config.kindLabel}
          </div>
          <div className="teach-context">{config.title}</div>
        </div>
        {examMode ? (
          <span className={`badge ${left < 60 ? "badge-attention" : "badge-neutral"}`}>{mm}:{ss}</span>
        ) : (
          <button
            className="icon-btn"
            onClick={() => setMode(mode === "voice" ? "text" : "voice")}
            type="button"
            aria-label={mode === "voice" ? "Switch to text" : "Switch to voice"}
            title="Switch between voice and text"
          >
            <span aria-hidden="true">{mode === "voice" ? "🔊" : "◉"}</span>
          </button>
        )}
        {!feedback ? (
          <button className="btn btn-ghost btn-sm" onClick={end} disabled={pending} type="button">
            End session
          </button>
        ) : null}
      </div>

      {!soapOnly ? (
        <div className="surface-tight" style={{ marginBottom: "var(--sp-6)" }}>
          <span className="eyebrow">Brief</span>
          <p style={{ margin: "4px 0 0" }}>{examMode ? config.brief.split(".")[0] + "." : config.brief}</p>
          {examMode ? <p className="list-sub" style={{ marginTop: 4 }}>Exam mode: short brief, timed, no hints, feedback at the end.</p> : null}
        </div>
      ) : (
        <div className="surface-tight" style={{ marginBottom: "var(--sp-6)" }}>
          <span className="eyebrow">Case summary</span>
          <p style={{ margin: "4px 0 0" }}>{config.brief}</p>
          <p className="list-sub" style={{ marginTop: 4 }}>
            Write the SOAP note from this summary alone.
          </p>
        </div>
      )}

      {!soapOnly ? (
        <div className="tbubbles" aria-live="polite">
          {messages.map((m, i) =>
            m.who === "student" ? (
              <div key={m.id} className="tturn">
                <div className="tbubble tbubble-student">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="tturn">
                <div className="tbubble-row">
                  {i === 0 || messages[i - 1]?.who !== "student" ? (
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
                <div className="tbubble tbubble-tutor" aria-label="Character is responding">
                  <span className="typing" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      ) : null}

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {!feedback && !soapOnly ? (
        <>
          {!examMode ? (
            <div className="row" style={{ marginBottom: "var(--sp-3)" }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPaused((p) => !p)}
                type="button"
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <Link className="btn btn-ghost btn-sm" href="/teach">
                Ask the tutor →
              </Link>
              <span className="hint">Hint: ask one open question at a time.</span>
            </div>
          ) : null}

          {mode === "voice" ? (
            <div style={{ textAlign: "center", padding: "var(--sp-4) 0" }}>
              <button
                className="send-round"
                style={{ width: 72, height: 72, fontSize: "var(--fs-xl)" }}
                onClick={mic.toggle}
                type="button"
                aria-label={mic.live ? "Stop speaking" : "Speak"}
              >
                <span aria-hidden="true">{mic.live ? "■" : "◉"}</span>
              </button>
              <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
                {mic.live ? "Listening… tap to stop" : "Tap and speak — captions appear above"}
              </p>
              {draft ? (
                <div className="surface-tight" style={{ marginTop: "var(--sp-3)", textAlign: "left" }}>
                  <p style={{ margin: 0 }}>{draft}</p>
                  <div className="row" style={{ marginTop: "var(--sp-2)" }}>
                    <button className="btn btn-primary btn-sm" disabled={typing} onClick={() => send(draft)} type="button">
                      Send
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDraft("")} type="button">
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
              {mic.error ? <p className="hint">{mic.error}</p> : null}
            </div>
          ) : (
            <div className="composer-float">
              <input
                placeholder="Say it like you would to a real person…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                aria-label="Your message"
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
          )}
        </>
      ) : null}

      {paused && !feedback ? (
        <div className="surface" style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          <h3 className="display-lg">Paused — take a breath</h3>
          <p className="card-sub">The scenario waits. Think about your next question.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: "var(--sp-3)" }} onClick={() => setPaused(false)} type="button">
            Resume
          </button>
        </div>
      ) : null}

      {feedback ? (
        <div className="stack-lg" style={{ marginTop: "var(--sp-6)" }}>
          <div className="session-summary">
            <span className="eyebrow">Session feedback</span>
            <h3>How it went</h3>

            <div className="grid grid-4" style={{ marginBottom: "var(--sp-5)" }}>
              {(
                [
                  ["Clarity", feedback.scores.clarity],
                  ["Questioning", feedback.scores.questioning],
                  ["Empathy", feedback.scores.empathy],
                  ["Overall", feedback.scores.overall],
                ] as Array<[string, number]>
              ).map(([label, v]) => (
                <div key={label} className="surface-tight" style={{ textAlign: "center" }}>
                  <div className="stat-value" style={{ fontSize: "var(--fs-xl)" }}>
                    {v}%
                  </div>
                  <div className="list-sub">{label}</div>
                </div>
              ))}
            </div>

            <h4 className="card-title">What went well</h4>
            <ul className="summary-list">
              {feedback.wentWell.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>

            {feedback.missed.length > 0 ? (
              <>
                <h4 className="card-title">What was missed</h4>
                <ul className="summary-list">
                  {feedback.missed.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {feedback.rephrases.length > 0 ? (
              <>
                <h4 className="card-title">Said differently</h4>
                {feedback.rephrases.map((r) => (
                  <div key={r.said} className="quiz-explain">
                    <b>You said</b>“{r.said}”
                    <b style={{ marginTop: 6 }}>Try</b>
                    {r.better}
                  </div>
                ))}
              </>
            ) : null}

            {feedback.orderNote ? (
              <>
                <h4 className="card-title">Question order</h4>
                <p className="card-sub">{feedback.orderNote}</p>
              </>
            ) : null}

            {feedback.checklist.length > 0 ? (
              <>
                <h4 className="card-title">OSCE checklist</h4>
                <ul className="summary-list">
                  {feedback.checklist.map((c) => (
                    <li key={c.label}>
                      {c.done ? "✓" : "✗"} {c.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <h4 className="card-title">What to practise next</h4>
            <ul className="summary-list">
              {feedback.nextSteps.map((n) => (
                <li key={n}>{n}</li>
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

          <details className="surface">
            <summary className="card-title" style={{ cursor: "pointer" }}>
              Transcript with comments
            </summary>
            <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
              {messages.map((m, i) => (
                <div key={m.id}>
                  <p className="list-sub" style={{ margin: 0 }}>
                    <b>{m.who === "student" ? "You" : config.characterLabel}:</b> {m.text}
                  </p>
                  {m.who === "student" && trace[Math.floor(i / 2)]?.notes.length ? (
                    <p className="hint" style={{ margin: "2px 0 0" }}>
                      {trace[Math.floor(i / 2)].notes.join(" ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>

          <SoapPractice scenarioId={config.scenarioId} />
        </div>
      ) : null}
    </div>
  );
}

/** SOAP documentation practice — after a session, or standalone. */
export function SoapPractice({ scenarioId }: { scenarioId: string }) {
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [result, setResult] = useState<{
    checks: Array<{ section: string; ok: boolean; note: string }>;
    model: string[];
  } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="surface">
      <span className="eyebrow">Documentation practice</span>
      <h3 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
        Write the SOAP note
      </h3>
      <div className="stack-sm">
        {(
          [
            ["subjective", "Subjective — what was said and felt"],
            ["objective", "Objective — what was found and measured"],
            ["assessment", "Assessment — what you conclude"],
            ["plan", "Plan — what happens next"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="field">
            <label className="label" htmlFor={`soap-${key}`}>
              {label}
            </label>
            <textarea
              id={`soap-${key}`}
              className="textarea"
              style={{ minHeight: 72 }}
              value={soap[key]}
              onChange={(e) => setSoap((s) => ({ ...s, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: "var(--sp-4)" }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await checkSoap({ scenarioId, sections: soap });
              setResult(res);
            })
          }
          type="button"
        >
          {pending ? "Checking…" : "Check my note"}
        </button>
      </div>
      {result ? (
        <div style={{ marginTop: "var(--sp-5)" }}>
          {result.checks.map((c) => (
            <p key={c.section} className="card-sub">
              <b style={{ textTransform: "capitalize" }}>{c.section}:</b> {c.ok ? "✓" : "✗"} {c.note}
            </p>
          ))}
          <div className="review-box">
            <h4>What a good note looks like here</h4>
            {result.model.map((line, i) =>
              line.endsWith(":") ? (
                <h4 key={i} className="card-title" style={{ marginTop: "var(--sp-3)" }}>
                  {line}
                </h4>
              ) : (
                <p key={i} className="card-sub">
                  • {line}
                </p>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
