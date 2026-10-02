"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { answerQuestion, wrongToFlashcard } from "@/app/materials/actions";

export interface BankQuestion {
  id: string;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  topicSlug: string | null;
  topicTitle: string | null;
  sourcePage: string | null;
  difficulty: number;
  documentId: string | null;
}

export interface PastSet {
  sessionId: string;
  date: string;
  total: number;
  correct: number;
  questionIds: string[];
  wrongIds: string[];
}

type QType = "practice" | "application" | "diagram";

/**
 * Practice Questions (MATERIALS_SPEC.md §6). Setup → runner → results.
 * Diagram labeling uses the student's own uploaded images: describe and label
 * what the diagram shows, graded against the material's own terms.
 */
export function QuestionsClient({
  documents,
  imageDocs,
  topicOptions,
  bank,
  pastSets,
  emptyHint,
}: {
  documents: Array<{ id: string; title: string }>;
  imageDocs: Array<{ id: string; title: string; subject: string | null }>;
  topicOptions: Array<{ slug: string; title: string; weak: boolean; count: number }>;
  bank: BankQuestion[];
  pastSets: PastSet[];
  emptyHint: ReactNode;
}) {
  const [docId, setDocId] = useState<string>("all");
  const [pickedTopics, setPickedTopics] = useState<string[]>([]);
  const [qtype, setQtype] = useState<QType>("practice");
  const [difficulty, setDifficulty] = useState(1);
  const [count, setCount] = useState(10);
  const [diagramDoc, setDiagramDoc] = useState(imageDocs[0]?.id ?? "");
  const [run, setRun] = useState<BankQuestion[] | null>(null);
  const [runMode, setRunMode] = useState<"practice" | "diagram">("practice");
  const [message, setMessage] = useState("");

  const pool = useMemo(() => {
    let list = bank;
    if (docId !== "all") list = list.filter((q) => q.documentId === docId);
    if (pickedTopics.length) list = list.filter((q) => q.topicSlug && pickedTopics.includes(q.topicSlug));
    // Application questions are scenario stems — longer, situation-first.
    if (qtype === "application") {
      const scenario = list.filter((q) => q.stem.length > 110);
      if (scenario.length) list = scenario;
    }
    const want = difficulty === 0 ? 1 : difficulty === 1 ? 3 : 5;
    return [...list].sort((a, b) => Math.abs(a.difficulty - want) - Math.abs(b.difficulty - want));
  }, [bank, docId, pickedTopics, qtype, difficulty]);

  function startWith(list: BankQuestion[]) {
    if (!list.length) {
      setMessage("This material is too short for that many questions. Try 10.");
      return;
    }
    setMessage("");
    setRun(list.slice(0, count));
    setRunMode("practice");
  }

  function start() {
    if (qtype === "diagram") {
      if (!diagramDoc) {
        setMessage("Upload a diagram or photo first — diagram labeling needs one of your images.");
        return;
      }
      setMessage("");
      setRunMode("diagram");
      setRun([]);
      return;
    }
    if (pool.length < count) {
      setMessage(
        pool.length === 0
          ? "No questions match that setup. Loosen a filter and try again."
          : `This material is too short for ${count} questions. Try ${pool.length <= 10 ? pool.length : 10}.`
      );
    } else setMessage("");
    startWith(pool);
  }

  if (run) {
    return runMode === "diagram" ? (
      <DiagramRunner
        imageDocs={imageDocs}
        diagramDoc={diagramDoc}
        onBack={() => setRun(null)}
      />
    ) : (
      <QuizRunner
        questions={run}
        onBack={() => setRun(null)}
        onAgain={() => start()}
      />
    );
  }

  if (!bank.length) return <>{emptyHint}</>;

  return (
    <div className="stack-lg">
      <section className="surface">
        <span className="eyebrow">Start a practice set</span>
        <h2 className="display-lg" style={{ marginBottom: "var(--sp-5)" }}>
          What should we quiz you on?
        </h2>

        <div className="stack" style={{ gap: "var(--sp-5)" }}>
          <div>
            <span className="label">Material</span>
            <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Material">
              <button className="chip chip-sm" aria-pressed={docId === "all"} onClick={() => setDocId("all")} type="button">
                All
              </button>
              {documents.map((d) => (
                <button
                  key={d.id}
                  className="chip chip-sm"
                  aria-pressed={docId === d.id}
                  onClick={() => setDocId(d.id)}
                  type="button"
                >
                  {d.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Topics</span>
            <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Topics">
              {topicOptions.filter((t) => t.count > 0).map((t) => (
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
            {qtype === "diagram" ? (
              <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Diagram">
                {imageDocs.length === 0 ? (
                  <span className="hint">No images uploaded yet — diagram labeling needs one of your images.</span>
                ) : (
                  imageDocs.map((d) => (
                    <button
                      key={d.id}
                      className="chip chip-sm"
                      aria-pressed={diagramDoc === d.id}
                      onClick={() => setDiagramDoc(d.id)}
                      type="button"
                    >
                      {d.title}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-2">
            <div>
              <span className="label">Difficulty</span>
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
                {[10, 20, 30].map((n) => (
                  <button key={n} className="chip chip-sm" aria-pressed={count === n} onClick={() => setCount(n)} type="button">
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {message ? <div className="alert alert-warn">{message}</div> : null}

          <div>
            <button className="btn btn-primary" onClick={start} type="button">
              Start practice
            </button>
            <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
              {pool.length} matching question{pool.length === 1 ? "" : "s"} available.
            </p>
          </div>
        </div>
      </section>

      {pastSets.length > 0 ? (
        <section>
          <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
            Past sets
          </h2>
          <div className="stack-sm">
            {pastSets.map((s) => (
              <PastSetRow
                key={s.sessionId}
                set={s}
                bank={bank}
                onRedo={(ids) => {
                  const qs = ids.map((id) => bank.find((q) => q.id === id)).filter((q): q is BankQuestion => !!q);
                  setRunMode("practice");
                  startWith(qs.length ? qs : pool);
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PastSetRow({
  set,
  bank,
  onRedo,
}: {
  set: PastSet;
  bank: BankQuestion[];
  onRedo: (ids: string[]) => void;
}) {
  const pct = set.total ? Math.round((set.correct / set.total) * 100) : 0;
  const date = new Date(set.date).toLocaleDateString();
  return (
    <div className="doc-row">
      <span style={{ flex: 1 }}>
        <span className="list-title">
          Practice set · {date}
        </span>
        <span className="list-sub" style={{ display: "block" }}>
          {set.correct}/{set.total} correct ({pct}%)
        </span>
      </span>
      <button className="btn btn-sm" onClick={() => onRedo(set.questionIds)} type="button">
        Redo
      </button>
      {set.wrongIds.length > 0 ? (
        <button className="btn btn-sm" onClick={() => onRedo(set.wrongIds)} type="button">
          Review mistakes
        </button>
      ) : null}
    </div>
  );
}

/** MCQ runner: counter, hint, check, annotated answer, next, results. */
export function QuizRunner({
  questions,
  onBack,
  onAgain,
}: {
  questions: BankQuestion[];
  onBack: () => void;
  onAgain: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [sessionId] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  const done = index >= questions.length;
  const q = !done ? questions[index] : null;

  function check() {
    if (!q || picked === null || pending) return;
    const correct = picked === q.answerIndex;
    start(async () => {
      await answerQuestion({
        questionId: q.id,
        correct,
        topicSlug: q.topicSlug,
        sessionId,
        mode: "practice",
      });
      if (!correct) {
        await wrongToFlashcard(q.id);
        setWrongIds((w) => [...w, q.id]);
      }
      setResults((r) => [...r, correct]);
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setPicked(null);
    setShowHint(false);
  }

  if (done) {
    const correct = results.filter(Boolean).length;
    const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
    return (
      <div className="review-stage">
        <span className="eyebrow">Set complete</span>
        <h2 className="display-sm">
          {correct} of {results.length} correct ({pct}%)
        </h2>
        <p className="lede">
          {wrongIds.length
            ? "Wrong answers were saved as flashcards — they’ll come back for review. Times go to your Study Plan."
            : "Clean set. Review times still go to your Study Plan."}
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: "var(--sp-6)" }}>
          {wrongIds.length > 0 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                const wrong = questions.filter((x) => wrongIds.includes(x.id));
                setResults([]);
                setWrongIds([]);
                setIndex(0);
                setPicked(null);
                questions.splice(0, questions.length, ...wrong);
              }}
              type="button"
            >
              Review wrong answers
            </button>
          ) : null}
          <button className="btn" onClick={onAgain} type="button">
            Practice again
          </button>
          <button className="btn btn-ghost" onClick={onBack} type="button">
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  const answered = results.length > index;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <span className="review-counter">
          {index + 1}/{questions.length}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onBack} type="button" aria-label="Close practice">
          ✕
        </button>
      </div>

      <p className="quiz-stem">{q?.stem}</p>
      {q?.topicTitle ? <p className="list-sub" style={{ marginBottom: "var(--sp-4)" }}>{q.topicTitle}</p> : null}

      <div className="stack-sm">
        {(q?.choices ?? []).map((c, i) => {
          const isAnswer = answered && i === q?.answerIndex;
          const isWrongPick = answered && picked === i && i !== q?.answerIndex;
          return (
            <button
              key={i}
              className={`option${isAnswer ? " option-correct" : ""}${isWrongPick ? " option-wrong" : ""}`}
              disabled={answered || pending}
              onClick={() => setPicked(i)}
              type="button"
            >
              <span className="option-marker">{String.fromCharCode(65 + i)}</span>
              <span>{c}</span>
            </button>
          );
        })}
      </div>

      {!answered ? (
        <div className="row" style={{ marginTop: "var(--sp-5)" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHint((s) => !s)} type="button">
            {showHint ? "Hide hint" : "Show hint"}
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" disabled={picked === null || pending} onClick={check} type="button">
            Check answer
          </button>
        </div>
      ) : null}

      {showHint && !answered ? (
        <div className="quiz-explain">
          <b>Hint</b>
          Think about what the question is really asking — eliminate the option that doesn’t fit
          {q?.topicTitle ? ` ${q.topicTitle.toLowerCase()}` : " the concept"} first.
        </div>
      ) : null}

      {answered ? (
        <div className="quiz-explain">
          <b>{results[index] ? "Correct." : "Not quite."}</b>
          {q?.explanation}
          {q?.sourcePage ? (
            <span className="finding-detail" style={{ display: "block", marginTop: 6 }}>
              From your material: {q.sourcePage}
            </span>
          ) : null}
          <span className="row" style={{ marginTop: "var(--sp-3)" }}>
            <Link className="btn btn-ghost btn-sm" href="/teach">
              Ask the tutor →
            </Link>
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={next} type="button">
              {index + 1 >= questions.length ? "See results" : "Next"}
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Diagram labeling from the student's own uploaded images. */
function DiagramRunner({
  imageDocs,
  diagramDoc,
  onBack,
}: {
  imageDocs: Array<{ id: string; title: string; subject: string | null }>;
  diagramDoc: string;
  onBack: () => void;
}) {
  const doc = imageDocs.find((d) => d.id === diagramDoc) ?? imageDocs[0];
  const [answer, setAnswer] = useState("");
  const [graded, setGraded] = useState<{ score: number; feedback: string } | null>(null);
  const [pending, start] = useTransition();

  if (!doc) {
    return (
      <div className="alert alert-warn">
        No images uploaded yet. <button className="btn btn-ghost btn-sm" onClick={onBack} type="button">Back</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <span className="eyebrow">Diagram labeling · {doc.title}</span>
        <button className="btn btn-ghost btn-sm" onClick={onBack} type="button" aria-label="Close practice">
          ✕
        </button>
      </div>

      <div className="surface" style={{ textAlign: "center", marginBottom: "var(--sp-5)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/materials/file/${doc.id}`}
          alt={`Diagram from ${doc.title}`}
          style={{ maxWidth: "100%", borderRadius: "var(--r-md)" }}
        />
      </div>

      <p className="quiz-stem">What does this diagram show? Label its key parts.</p>
      <div className="field" style={{ marginTop: "var(--sp-4)" }}>
        <label className="label" htmlFor="diagram-answer">Your labels</label>
        <textarea
          id="diagram-answer"
          className="textarea"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="e.g. Top left is…, the arrow shows…"
          disabled={!!graded}
        />
      </div>

      {!graded ? (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <button
            className="btn btn-primary"
            disabled={!answer.trim() || pending}
            onClick={() =>
              start(async () => {
                const { gradeDiagram } = await import("@/app/materials/actions");
                const res = await gradeDiagram(doc.id, answer);
                setGraded(res);
              })
            }
            type="button"
          >
            {pending ? "Checking…" : "Check answer"}
          </button>
        </div>
      ) : (
        <div className="quiz-explain">
          <b>Score: {Math.round(graded.score * 100)}%</b>
          {graded.feedback}
          <span className="row" style={{ marginTop: "var(--sp-3)" }}>
            <Link className="btn btn-ghost btn-sm" href="/teach">
              Ask the tutor →
            </Link>
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={onBack} type="button">
              Back to setup
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
