"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { answerQuestion, wrongToFlashcard } from "@/app/materials/actions";
import { QuizRunner } from "@/components/materials/questions-client";
import type { BankQuestion } from "@/components/materials/questions-client";

export interface PracticeQData {
  bank: BankQuestion[];
  topicOptions: Array<{ slug: string; title: string; weak: boolean; count: number }>;
  documents: Array<{ id: string; title: string }>;
  pastSets: Array<{
    sessionId: string;
    date: string;
    total: number;
    correct: number;
    questionIds: string[];
    wrongIds: string[];
  }>;
}

type QType = "practice" | "application" | "diagram";

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Questions tab (PRACTICE_SPEC.md): the wider mix across materials, shaped by
 * weak spots. Relaxed explains as you go; Timed holds everything to the end.
 */
export function PracticeQuestions({ data }: { data: PracticeQData }) {
  const [docId, setDocId] = useState("all");
  const [pickedTopics, setPickedTopics] = useState<string[]>([]);
  const [qtype, setQtype] = useState<QType>("practice");
  const [difficulty, setDifficulty] = useState(1);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<"relaxed" | "timed">("relaxed");
  const [run, setRun] = useState<BankQuestion[] | null>(null);
  const [timed, setTimed] = useState(false);
  const [message, setMessage] = useState("");

  const weakFirst = useMemo(() => {
    let list = data.bank;
    if (docId !== "all") list = list.filter((q) => q.documentId === docId);
    if (pickedTopics.length) list = list.filter((q) => q.topicSlug && pickedTopics.includes(q.topicSlug));
    if (qtype === "application") {
      const scenario = list.filter((q) => q.stem.length > 110);
      if (scenario.length) list = scenario;
    }
    if (qtype === "diagram") return [];
    const want = difficulty === 0 ? 1 : difficulty === 1 ? 3 : 5;
    const weak = list.filter((q) => q.topicSlug && data.topicOptions.find((t) => t.slug === q.topicSlug)?.weak);
    const rest = list.filter((q) => !weak.includes(q));
    const rank = (q: BankQuestion) => Math.abs(q.difficulty - want);
    return [...weak.sort((a, b) => rank(a) - rank(b)), ...rest.sort((a, b) => rank(a) - rank(b))];
  }, [data, docId, pickedTopics, qtype, difficulty]);

  function startWith(list: BankQuestion[], asTimed: boolean) {
    if (!list.length) {
      setMessage("No questions match that setup. Loosen a filter and try again.");
      return;
    }
    setMessage("");
    setRun(list.slice(0, count));
    setTimed(asTimed);
  }

  function start() {
    if (qtype === "diagram") {
      window.location.href = "/materials?tab=questions";
      return;
    }
    if (weakFirst.length < count) {
      setMessage(
        weakFirst.length === 0
          ? "No questions match that setup. Loosen a filter and try again."
          : `There isn't enough material for ${count} questions. Try ${weakFirst.length <= 10 ? weakFirst.length : 10}.`
      );
    } else setMessage("");
    startWith(weakFirst, mode === "timed");
  }

  if (run) {
    return timed ? (
      <TimedRunner questions={run} onBack={() => setRun(null)} />
    ) : (
      <QuizRunner questions={run} onBack={() => setRun(null)} onAgain={() => start()} />
    );
  }

  if (!data.bank.length) {
    return (
      <div className="surface" style={{ maxWidth: 560, textAlign: "center" }}>
        <h2 className="display-lg">Add a material and I’ll make questions from it</h2>
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Link className="btn btn-primary btn-sm" href="/materials?tab=upload">
            Go to Materials
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section>
        <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
          Suggested for you
        </h2>
        <div className="grid grid-3">
          {data.topicOptions
            .filter((t) => t.weak && t.count > 0)
            .slice(0, 3)
            .map((t) => (
              <div key={t.slug} className="surface">
                <span className="tag tag-review">Needs review</span>
                <h3 className="display-lg" style={{ marginTop: "var(--sp-2)" }}>
                  {t.title}
                </h3>
                <p className="list-sub">{t.count} questions</p>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: "var(--sp-3)" }}
                  onClick={() => {
                    setPickedTopics([t.slug]);
                    setDocId("all");
                    const list = data.bank.filter((q) => q.topicSlug === t.slug);
                    startWith(shuffle(list), false);
                  }}
                  type="button"
                >
                  Start
                </button>
              </div>
            ))}
        </div>
      </section>

      <section className="surface">
        <div className="row-between" style={{ gap: "var(--sp-4)" }}>
          <div>
            <span className="eyebrow">Quick set</span>
            <h2 className="display-lg">Five questions, right now</h2>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setCount(5);
              startWith(shuffle(weakFirst), false);
            }}
            type="button"
          >
            5 questions
          </button>
        </div>
      </section>

      <section className="surface">
        <span className="eyebrow">Build your own set</span>
        <h2 className="display-lg" style={{ marginBottom: "var(--sp-5)" }}>
          Mix materials and weak spots
        </h2>
        <div className="stack" style={{ gap: "var(--sp-5)" }}>
          <div>
            <span className="label">Material</span>
            <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Material">
              <button className="chip chip-sm" aria-pressed={docId === "all"} onClick={() => setDocId("all")} type="button">
                All
              </button>
              {data.documents.map((d) => (
                <button key={d.id} className="chip chip-sm" aria-pressed={docId === d.id} onClick={() => setDocId(d.id)} type="button">
                  {d.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Topics</span>
            <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Topics">
              {data.topicOptions.filter((t) => t.count > 0).map((t) => (
                <button
                  key={t.slug}
                  className="chip chip-sm"
                  aria-pressed={pickedTopics.includes(t.slug)}
                  onClick={() =>
                    setPickedTopics((p) => (p.includes(t.slug) ? p.filter((x) => x !== t.slug) : [...p, t.slug]))
                  }
                  type="button"
                >
                  {t.title} ({t.count}){t.weak ? " · Needs review" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-2">
            <div>
              <span className="label">Type</span>
              <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Type">
                {(
                  [
                    ["practice", "Practice questions"],
                    ["application", "Application questions"],
                    ["diagram", "Diagram labeling"],
                  ] as Array<[QType, string]>
                ).map(([v, label]) => (
                  <button key={v} className="chip chip-sm" aria-pressed={qtype === v} onClick={() => setQtype(v)} type="button">
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Difficulty (starts Medium, then adapts)</span>
              <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Difficulty">
                {["Easy", "Medium", "Hard"].map((d, i) => (
                  <button key={d} className="chip chip-sm" aria-pressed={difficulty === i} onClick={() => setDifficulty(i)} type="button">
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">How many</span>
              <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="How many">
                {[5, 10, 20, 30].map((n) => (
                  <button key={n} className="chip chip-sm" aria-pressed={count === n} onClick={() => setCount(n)} type="button">
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Mode</span>
              <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Mode">
                <button className="chip chip-sm" aria-pressed={mode === "relaxed"} onClick={() => setMode("relaxed")} type="button">
                  Relaxed
                </button>
                <button className="chip chip-sm" aria-pressed={mode === "timed"} onClick={() => setMode("timed")} type="button">
                  Timed
                </button>
              </div>
              <p className="hint" style={{ marginTop: 4 }}>
                {mode === "relaxed" ? "Hints and explanations after each answer." : "Exam-style: answers at the end."}
              </p>
            </div>
          </div>

          {message ? <div className="alert alert-warn">{message}</div> : null}

          <div>
            <button className="btn btn-primary" onClick={start} type="button">
              Start practice
            </button>
            <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
              {weakFirst.length} matching questions. Weak topics and due reviews come first.
            </p>
          </div>
        </div>
      </section>

      {data.pastSets.length > 0 ? (
        <section>
          <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
            Past sets
          </h2>
          <div className="stack-sm">
            {data.pastSets.map((s) => (
              <div key={s.sessionId} className="doc-row">
                <span style={{ flex: 1 }}>
                  <span className="list-title">Practice set · {new Date(s.date).toLocaleDateString()}</span>
                  <span className="list-sub" style={{ display: "block" }}>
                    {s.correct}/{s.total} correct
                  </span>
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const qs = s.questionIds
                      .map((id) => data.bank.find((q) => q.id === id))
                      .filter((q): q is BankQuestion => !!q);
                    startWith(qs.length ? qs : weakFirst, false);
                  }}
                  type="button"
                >
                  Redo
                </button>
                {s.wrongIds.length > 0 ? (
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const qs = s.wrongIds
                        .map((id) => data.bank.find((q) => q.id === id))
                        .filter((q): q is BankQuestion => !!q);
                      startWith(qs, false);
                    }}
                    type="button"
                  >
                    Review mistakes
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Timed mode: countdown, flagging, everything revealed at the end. */
function TimedRunner({ questions, onBack }: { questions: BankQuestion[]; onBack: () => void }) {
  const totalSeconds = questions.length * 90;
  const [left, setLeft] = useState(totalSeconds);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Array<number | null>>(() => questions.map(() => null));
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [pending, start] = useTransition();
  const [sessionId] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (submitted) return;
    if (left <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, submitted]);

  function submit() {
    if (pending || submitted) return;
    start(async () => {
      const out: boolean[] = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const correct = picks[i] === q.answerIndex;
        out.push(correct);
        await answerQuestion({ questionId: q.id, correct, topicSlug: q.topicSlug, sessionId, mode: "timed" });
        if (!correct) await wrongToFlashcard(q.id);
      }
      setResults(out);
      setSubmitted(true);
    });
  }

  const mm = Math.floor(Math.max(0, left) / 60);
  const ss = String(Math.max(0, left) % 60).padStart(2, "0");

  if (submitted) {
    const correct = results.filter(Boolean).length;
    return (
      <div style={{ maxWidth: 720 }}>
        <span className="eyebrow">Timed set complete</span>
        <h2 className="display-sm">
          {correct} of {questions.length} correct
        </h2>
        <div className="stack" style={{ marginTop: "var(--sp-6)" }}>
          {questions.map((q, i) => (
            <div key={q.id} className="surface-tight">
              <p style={{ fontWeight: 600, margin: "0 0 var(--sp-2)" }}>
                {i + 1}. {q.stem}
              </p>
              <p className="list-sub" style={{ margin: 0 }}>
                Your answer: {picks[i] == null ? "—" : q.choices[picks[i]!] ?? "—"} ·{" "}
                {results[i] ? "Correct" : `Correct answer: ${q.choices[q.answerIndex]}`}
              </p>
              <div className="quiz-explain">
                <b>Why</b>
                {q.explanation}
                {q.sourcePage ? (
                  <span className="finding-detail" style={{ display: "block", marginTop: 6 }}>
                    From your material: {q.sourcePage}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: "var(--sp-6)" }}>
          <button className="btn btn-primary" onClick={onBack} type="button">
            Practice again
          </button>
          <Link className="btn" href="/teach">
            Learn weak topics with the tutor
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <span className="review-counter">
          {index + 1}/{questions.length}
        </span>
        <span className={`badge ${left < 60 ? "badge-attention" : "badge-neutral"}`} aria-label="Time left">
          {mm}:{ss}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onBack} type="button" aria-label="Close practice">
          ✕
        </button>
      </div>

      <p className="quiz-stem">{q.stem}</p>
      <div className="stack-sm">
        {q.choices.map((c, i) => (
          <button
            key={i}
            className={`option${picks[index] === i ? " option-correct" : ""}`}
            onClick={() =>
              setPicks((p) => {
                const next = [...p];
                next[index] = i;
                return next;
              })
            }
            type="button"
          >
            <span className="option-marker">{String.fromCharCode(65 + i)}</span>
            <span>{c}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginTop: "var(--sp-5)" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setFlagged((f) => {
              const next = new Set(f);
              if (next.has(index)) next.delete(index);
              else next.add(index);
              return next;
            })
          }
          type="button"
          aria-pressed={flagged.has(index)}
        >
          {flagged.has(index) ? "★ Flagged" : "☆ Flag"}
        </button>
        <span className="spacer" />
        <button
          className="btn btn-sm"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          type="button"
        >
          ← Back
        </button>
        {index + 1 < questions.length ? (
          <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => i + 1)} type="button">
            Next →
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={submit} type="button">
            {pending ? "Marking…" : "Finish set"}
          </button>
        )}
      </div>

      <div className="chips" style={{ marginTop: "var(--sp-4)" }} aria-label="Jump to question">
        {questions.map((_, i) => (
          <button
            key={i}
            className="chip chip-sm"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            type="button"
            title={flagged.has(i) ? `Question ${i + 1} (flagged)` : `Question ${i + 1}`}
          >
            {flagged.has(i) ? `★${i + 1}` : i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
