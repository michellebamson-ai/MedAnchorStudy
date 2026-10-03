"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  answerTeach,
  assistTeach,
  endTeach,
  startTeach,
  type SourceLabel,
  type TeachingStyle,
  type TurnMessage,
} from "@/app/teach/actions";
import type { Level } from "@/lib/ai/types";

export interface TeachSetupData {
  topics: Array<{ slug: string; title: string }>;
  materialTopics: Array<{ label: string; docId: string; docTitle: string; weak: boolean }>;
  last: { topic: string; needsWork: boolean } | null;
  defaultStyle: TeachingStyle;
  level: Level;
}

const STYLES: Array<{ v: TeachingStyle; label: string }> = [
  { v: "gentle", label: "Gentle guidance" },
  { v: "rapid_fire", label: "Rapid-fire" },
  { v: "exam_pressure", label: "Exam-style" },
  { v: "step_by_step", label: "Step-by-step" },
];

interface Msg {
  id: number;
  who: "tutor" | "student";
  text: string;
  source?: SourceLabel | null;
}

interface Session {
  topic: string;
  style: TeachingStyle;
  depth: number;
  difficulty: number;
  level: Level;
  documentId: string | null;
  materialTitle: string | null;
}

function SourceNote({ source }: { source: SourceLabel }) {
  if (source.type === "uploaded") {
    return <span className="source-tag source-uploaded">From your material{source.title ? `: ${source.title}` : ""}</span>;
  }
  if (source.type === "outside") {
    return <span className="source-tag source-external">Outside source</span>;
  }
  return <span className="source-tag source-ai">AI example</span>;
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
    const u = new SpeechSynthesisUtterance(text.slice(0, 600));
    window.speechSynthesis.speak(u);
  } catch {
    /* no speech support */
  }
}

/**
 * Teach Me (TUTOR_SPEC.md §1): intentional setup, then a floating-bubble
 * session that feels like being inside a lesson — not chatting with a bot.
 */
export function TeachFlow({ setup }: { setup: TeachSetupData }) {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <TeachSetup setup={setup} onStart={setSession} />;
  }
  return <TeachSession key={`${session.topic}-${session.style}`} setup={setup} config={session} onExit={() => setSession(null)} />;
}

function TeachSetup({
  setup,
  onStart,
}: {
  setup: TeachSetupData;
  onStart: (s: Session) => void;
}) {
  const [topic, setTopic] = useState("");
  const [pickedDoc, setPickedDoc] = useState<string | null>(null);
  const [style, setStyle] = useState<TeachingStyle>(setup.defaultStyle);
  const [depth, setDepth] = useState(1);
  const [difficulty, setDifficulty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mic = useMic((t) => setTopic(t));

  const chosenTopic = topic.trim() || setup.materialTopics.find((m) => m.docId === pickedDoc)?.label || "";

  async function begin(topicText: string, documentId: string | null) {
    const t = topicText.trim();
    if (!t) {
      setError("Type a topic or pick one from your materials.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await startTeach({
        topic: t,
        style,
        depth: depth === 0 ? 2 : depth === 1 ? 3 : 5,
        difficulty: difficulty === 0 ? 1 : difficulty === 1 ? 3 : 5,
        documentId,
      });
      onStart({
        topic: t,
        style,
        depth,
        difficulty: difficulty === 0 ? 1 : difficulty === 1 ? 3 : 5,
        level: res.level,
        documentId,
        materialTitle: res.materialTitle,
      });
      // Stash the opening turn for the session screen.
      (window as unknown as { __teachOpening?: unknown }).__teachOpening = res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="field" style={{ marginBottom: "var(--sp-6)" }}>
        <label className="label" htmlFor="teach-topic" style={{ fontSize: "var(--fs-md)" }}>
          What do you want to learn?
        </label>
        <div className="row" style={{ marginTop: "var(--sp-2)" }}>
          <input
            id="teach-topic"
            className="input"
            style={{ flex: 1, minHeight: 52, fontSize: "var(--fs-md)" }}
            placeholder="Type any topic…"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setPickedDoc(null);
            }}
          />
          <button
            className="btn"
            data-live={mic.live}
            onClick={mic.toggle}
            type="button"
            aria-label="Say the topic"
            title="Say the topic"
          >
            <span aria-hidden="true">{mic.live ? "■" : "◉"}</span>
          </button>
        </div>
        {mic.error ? <p className="hint" style={{ marginTop: 4 }}>{mic.error}</p> : null}
      </div>

      {setup.materialTopics.length > 0 ? (
        <div style={{ marginBottom: "var(--sp-6)" }}>
          <span className="label">From your materials</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Topics from your materials">
            {setup.materialTopics.slice(0, 8).map((m) => (
              <button
                key={m.docId + m.label}
                className="chip"
                aria-pressed={pickedDoc === m.docId && !topic.trim()}
                onClick={() => {
                  setPickedDoc(m.docId);
                  setTopic("");
                }}
                type="button"
              >
                {m.label}
                {m.weak ? <span className="tag tag-review" style={{ marginLeft: 6 }}>Needs review</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="card-sub" style={{ marginBottom: "var(--sp-6)" }}>
          Pick a topic to begin. Add a material in Materials and the tutor can teach from it.
        </p>
      )}

      {setup.last ? (
        <div className="surface-tight" style={{ marginBottom: "var(--sp-6)" }}>
          <span className="card-sub">
            Last time: <b>{setup.last.topic}</b> {setup.last.needsWork ? "needed work" : "went well"}.
          </span>{" "}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => begin(setup.last!.topic, null)}
            type="button"
          >
            Continue it →
          </button>
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: "var(--sp-6)" }}>
        <div>
          <span className="label">Teaching style</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Teaching style">
            {STYLES.map((s) => (
              <button key={s.v} className="chip chip-sm" aria-pressed={style === s.v} onClick={() => setStyle(s.v)} type="button">
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Depth</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Depth">
            {["Brief", "Standard", "Deep"].map((d, i) => (
              <button key={d} className="chip chip-sm" aria-pressed={depth === i} onClick={() => setDepth(i)} type="button">
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "var(--sp-8)" }}>
        <span className="label">Difficulty (adapts as you answer)</span>
        <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Difficulty">
          {["Easy", "Medium", "Hard"].map((d, i) => (
            <button key={d} className="chip chip-sm" aria-pressed={difficulty === i} onClick={() => setDifficulty(i)} type="button">
              {d}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="alert alert-danger" style={{ marginBottom: "var(--sp-4)" }}>{error}</div> : null}

      <button
        className="btn btn-primary btn-block"
        style={{ minHeight: 54 }}
        disabled={busy}
        onClick={() => begin(chosenTopic, pickedDoc && !topic.trim() ? pickedDoc : null)}
        type="button"
      >
        {busy ? "Starting…" : "Start"}
      </button>
    </div>
  );
}

type Summary = { gotRight: string[]; workOn: string[]; nextSteps: string[] };

function TeachSession({
  setup,
  config,
  onExit,
}: {
  setup: TeachSetupData;
  config: Session;
  onExit: () => void;
}) {
  const router = useRouter();
  const opening = (window as unknown as { __teachOpening?: {
    turn: { text: string; question?: string; hints?: string[]; expectedTerms?: string[] };
    source: SourceLabel;
  } }).__teachOpening;

  const [messages, setMessages] = useState<Msg[]>(() => {
    const seed: Msg[] = [];
    if (opening) {
      seed.push({ id: 1, who: "tutor", text: opening.turn.text, source: opening.source });
      if (opening.turn.question) {
        seed.push({ id: 2, who: "tutor", text: opening.turn.question, source: null });
      }
    }
    return seed;
  });
  const [currentHints, setCurrentHints] = useState<string[]>(opening?.turn.hints ?? []);
  const [expectedTerms, setExpectedTerms] = useState<string[]>(opening?.turn.expectedTerms ?? []);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(1);
  const [difficulty, setDifficulty] = useState(config.difficulty);
  const [scores, setScores] = useState<number[]>([]);
  const [hits, setHits] = useState<string[]>([]);
  const [misses, setMisses] = useState<string[]>([]);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [voiceOn, setVoiceOn] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ending, setEnding] = useState(false);
  const idRef = useRef(10);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mic = useMic((t) => setDraft((d) => (d ? `${d} ${t}` : t)));

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  function pushTutor(text: string, source: SourceLabel | null) {
    setMessages((m) => [...m, { id: nextId(), who: "tutor", text, source }]);
    if (voiceOn) speak(text);
  }

  async function send() {
    const answer = draft.trim();
    if (!answer || typing || summary) return;
    setDraft("");
    setError("");
    const transcript: TurnMessage[] = messages.slice(-8).map((m) => ({ role: m.who, text: m.text }));
    setMessages((m) => [...m, { id: nextId(), who: "student", text: answer }]);
    setTyping(true);
    try {
      const res = await answerTeach({
        topic: config.topic,
        style: config.style,
        depth: config.depth,
        difficulty,
        level: config.level,
        documentId: config.documentId,
        transcript,
        answer,
        turn,
        expectedTerms,
      });
      setScores((s) => [...s, res.score]);
      setHits((h) => [...h, ...res.hit]);
      setMisses((m) => [...m, ...res.missing]);
      setKeyPoints((k) => [...k, ...res.hit.filter((t) => !k.includes(t))].slice(-8));
      setDifficulty(res.difficulty);
      setTurn((t) => t + 1);
      setCurrentHints(res.next.hints ?? []);
      setExpectedTerms(res.next.expectedTerms ?? []);

      const lines = [
        res.score >= 0.75 ? "That's right." : res.score >= 0.45 ? "Partly right." : "Not quite — let's fix it.",
        res.feedback,
      ];
      if (res.misconceptions.length) {
        lines.push(`Watch out: ${res.misconceptions.join("; ")}.`);
      }
      pushTutor(lines.join(" "), res.source);
      if (res.next.question) {
        pushTutor(res.next.question, null);
      } else if (res.next.text) {
        pushTutor(res.next.text, res.source);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setTyping(false);
    }
  }

  async function assist(kind: "hint" | "idk" | "explain" | "example" | "diagram" | "practice") {
    if (typing || summary) return;
    setTyping(true);
    setError("");
    try {
      const lastQ = [...messages].reverse().find((m) => m.who === "tutor")?.text ?? config.topic;
      const res = await assistTeach({
        kind,
        topic: config.topic,
        style: config.style,
        level: config.level,
        question: lastQ,
        hint: currentHints[0],
      });
      pushTutor(res.text, res.source);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setTyping(false);
    }
  }

  async function end() {
    if (ending || summary) return;
    setEnding(true);
    try {
      const res = await endTeach({
        topic: config.topic,
        style: config.style,
        turns: turn,
        scores,
        hit: hits,
        missing: misses,
      });
      setSummary(res);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setEnding(false);
    }
  }

  const styleLabel = STYLES.find((s) => s.v === config.style)?.label ?? config.style;

  return (
    <div className="teach-layout">
      <div className="teach-main">
        <div className="teach-topbar">
          <button className="icon-btn" onClick={onExit} type="button" aria-label="Back to Teach Me setup">
            <span aria-hidden="true">←</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="teach-name">
              MedAnchor Tutor
              <span className="online-dot" aria-hidden="true" />
              <span className="teach-context">Online</span>
            </div>
            <div className="teach-context">
              {config.topic} · {styleLabel}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => setVoiceOn((v) => !v)}
            type="button"
            aria-label={voiceOn ? "Turn voice off" : "Turn voice on"}
            aria-pressed={voiceOn}
            title="Read tutor messages aloud"
          >
            <span aria-hidden="true">{voiceOn ? "🔊" : "◉"}</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={end} disabled={ending} type="button">
            End session
          </button>
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
                  <div className="tbubble tbubble-tutor">
                    {m.text}
                    {m.source ? (
                      <span className="src">
                        <SourceNote source={m.source} />
                      </span>
                    ) : null}
                  </div>
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

          {summary ? (
            <div className="session-summary">
              <span className="eyebrow">Session summary</span>
              <h3>How it went</h3>
              {summary.gotRight.length > 0 ? (
                <>
                  <h4 className="card-title">You got right</h4>
                  <ul className="summary-list">
                    {summary.gotRight.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {summary.workOn.length > 0 ? (
                <>
                  <h4 className="card-title">Work on</h4>
                  <ul className="summary-list">
                    {summary.workOn.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <h4 className="card-title">Next steps</h4>
              <ul className="summary-list">
                {summary.nextSteps.map((n) => (
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
          ) : null}

          <div ref={bottomRef} />
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        {!summary ? (
          <>
            <div className="quickpills" role="group" aria-label="Quick actions">
              {(
                [
                  ["hint", "Hint"],
                  ["idk", "I don't know"],
                  ["explain", "Explain differently"],
                  ["example", "Give an example"],
                  ["diagram", "Show a diagram"],
                  ["practice", "Practice question"],
                ] as const
              ).map(([kind, label]) => (
                <button key={kind} className="quickpill" onClick={() => assist(kind)} type="button">
                  {label}
                </button>
              ))}
            </div>

            <div className="composer-float">
              <input
                placeholder="Type your answer…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                aria-label="Type your answer"
              />
              <button
                className="mic-btn"
                data-live={mic.live}
                onClick={mic.toggle}
                type="button"
                aria-label="Speak your answer"
                title="Speak your answer"
              >
                <span aria-hidden="true">{mic.live ? "■" : "◉"}</span>
              </button>
              <button
                className="send-round"
                onClick={send}
                disabled={!draft.trim() || typing}
                type="button"
                aria-label="Send answer"
              >
                <span aria-hidden="true">↑</span>
              </button>
            </div>
            {mic.error ? <p className="hint" style={{ marginTop: 4 }}>{mic.error}</p> : null}
          </>
        ) : (
          <div className="row" style={{ marginTop: "var(--sp-4)" }}>
            <button className="btn" onClick={onExit} type="button">
              Back to setup
            </button>
            <Link className="btn btn-ghost" href="/dashboard">
              Dashboard
            </Link>
          </div>
        )}
      </div>

      <aside className="teach-side" aria-label="Session context">
        <div className="surface-tight">
          <span className="eyebrow">Teaching from</span>
          <p className="list-title" style={{ margin: "4px 0 0" }}>
            {config.materialTitle ?? "General knowledge"}
          </p>
          {config.materialTitle ? (
            <span className="source-tag source-uploaded" style={{ marginTop: 6 }}>
              Your material
            </span>
          ) : (
            <span className="source-tag source-ai" style={{ marginTop: 6 }}>
              AI example
            </span>
          )}
        </div>
        <div className="surface-tight">
          <span className="eyebrow">Key points so far</span>
          {keyPoints.length === 0 ? (
            <p className="list-sub" style={{ margin: "4px 0 0" }}>
              Answer questions and the important terms will collect here.
            </p>
          ) : (
            <ul className="summary-list" style={{ marginTop: 4 }}>
              {keyPoints.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface-tight">
          <span className="eyebrow">Session</span>
          <p className="list-sub" style={{ margin: "4px 0 0" }}>
            Turn {turn} · {styleLabel} ·{" "}
            {difficulty <= 2 ? "Easy" : difficulty >= 4 ? "Hard" : "Medium"}
          </p>
          <Link className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} href="/evidence">
            Check the evidence →
          </Link>
        </div>
      </aside>
    </div>
  );
}
