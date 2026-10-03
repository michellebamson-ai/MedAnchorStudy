"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  analyzeData,
  answerBioCheck,
  conceptsFromMaterials,
  explainConcept,
  generateStudyPlan,
  methodologyChat,
  reviewPaper,
  saveMethodology,
  suggestTest,
  type ConceptContent,
} from "@/app/research/biostat-actions";

/** Persistent "Explain a statistical concept…" entry. */
export function ExplainBox({ signedIn }: { signedIn: boolean }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<ConceptContent | null>(null);
  const [pending, start] = useTransition();

  const topics = [
    "p-value", "chi-square", "t-test", "regression", "correlation", "anova",
    "relative-risk", "odds-ratio", "confidence-intervals",
  ];

  function explain(slug: string) {
    start(async () => {
      const c = await explainConcept(slug);
      setResult(c);
    });
  }

  function search() {
    const t = q.trim().toLowerCase();
    const hit = topics.find((s) => s.replace(/-/g, " ").includes(t) || t.includes(s.replace(/-/g, " ")));
    if (hit) explain(hit);
    else {
      setResult({
        title: q.trim(),
        fromModule: false,
        definition: "",
        whenToUse: null,
        formula: null,
        example: "",
        mistakes: [],
        check: null,
      });
    }
  }

  return (
    <section className="surface">
      <div className="row">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Explain a statistical concept…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          aria-label="Explain a statistical concept"
        />
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={search} type="button">
          {pending ? "…" : "Explain"}
        </button>
      </div>
      {result ? (
        <div style={{ marginTop: "var(--sp-5)" }}>
          {result.definition ? (
            <ConceptBody content={result} signedIn={signedIn} slug={q.trim().toLowerCase().replace(/[^a-z]+/g, "-")} />
          ) : (
            <p className="card-sub">
              Nothing on “{q.trim()}” yet — try the library below, e.g. p-value, chi-square or regression.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Concept page: definition, use, formula, example, mistakes, practice check. */
export function ConceptView({ slug, content, signedIn }: { slug: string; content: ConceptContent; signedIn: boolean }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
        ← Library
      </Link>
      <span className="eyebrow">Statistics library</span>
      <h1 className="display-sm" style={{ marginBottom: "var(--sp-2)" }}>
        {content.title}
      </h1>
      <p className="row" style={{ gap: 6, marginBottom: "var(--sp-6)" }}>
        <span className={`source-tag ${content.fromModule ? "source-uploaded" : "source-ai"}`}>
          {content.fromModule ? "Study guide" : "AI example"}
        </span>
      </p>
      <ConceptBody content={content} signedIn={signedIn} slug={slug} />
    </div>
  );
}

function ConceptBody({ content, signedIn, slug }: { content: ConceptContent; signedIn: boolean; slug: string }) {
  const [answer, setAnswer] = useState("");
  const [graded, setGraded] = useState<{ score: number; feedback: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="stack">
      <div className="note-body">
        <p>{content.definition}</p>
        {content.whenToUse ? (
          <>
            <h4>When to use it</h4>
            <p>{content.whenToUse}</p>
          </>
        ) : null}
      </div>
      {content.formula ? <div className="formula-box">{content.formula}</div> : null}
      {content.example ? (
        <div className="surface-tight">
          <span className="eyebrow">Healthcare example</span>
          <p style={{ margin: "4px 0 0" }}>{content.example}</p>
        </div>
      ) : null}
      {content.mistakes.length > 0 ? (
        <div>
          <h4 className="card-title">Common mistakes</h4>
          <ul className="summary-list">
            {content.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {content.check ? (
        <div className="surface-tight">
          <h4 className="card-title">Check yourself</h4>
          <p>{content.check.question}</p>
          <div className="row" style={{ marginTop: "var(--sp-2)" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer in a sentence…"
              aria-label="Your answer"
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={!answer.trim() || pending || !signedIn}
              onClick={() =>
                start(async () => {
                  const g = await answerBioCheck(slug, answer, content.check!.keywords);
                  setGraded(g);
                })
              }
              type="button"
            >
              Check
            </button>
          </div>
          {!signedIn ? <p className="hint" style={{ marginTop: 4 }}>Sign in so checks count toward your progress.</p> : null}
          {graded ? (
            <div className="quiz-explain">
              <b>{Math.round(graded.score * 100)}%</b>
              {graded.feedback}
              {content.check.answer ? <span style={{ display: "block", marginTop: 6 }}>{content.check.answer}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Link className="btn btn-ghost btn-sm" href="/teach">
        Ask the Tutor →
      </Link>
    </div>
  );
}

/** "I need to choose a statistical test" — variables in, recommendation out. */
export function TestPicker() {
  const [outcome, setOutcome] = useState("");
  const [groups, setGroups] = useState("");
  const [paired, setPaired] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<{ test: string; reasoning: string; steps: string[] } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ maxWidth: 680 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
        ← Biostatistics
      </Link>
      <span className="eyebrow">Test picker</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-5)" }}>
        What are you comparing?
      </h2>
      <div className="stack">
        <div className="field">
          <label className="label" htmlFor="tp-outcome">What are you measuring (the outcome)?</label>
          <input id="tp-outcome" className="input" placeholder="e.g. blood pressure (numeric), cured yes/no" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">How many groups?</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Groups">
            {["Two groups", "Three or more", "No groups — relationship"].map((g) => (
              <button key={g} className="chip chip-sm" aria-pressed={groups === g} onClick={() => setGroups(g)} type="button">
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Paired measurements (same people twice)?</span>
          <div className="chips" style={{ marginTop: "var(--sp-2)" }} role="group" aria-label="Paired">
            {["Yes, paired", "No, independent"].map((g) => (
              <button key={g} className="chip chip-sm" aria-pressed={paired === g} onClick={() => setPaired(g)} type="button">
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="tp-goal">What do you want to know?</label>
          <input id="tp-goal" className="input" placeholder="e.g. whether the drug lowers pressure" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div>
          <button
            className="btn btn-primary"
            disabled={pending || !outcome.trim()}
            onClick={() =>
              start(async () => {
                const r = await suggestTest({ outcome, groups, paired, goal });
                setResult(r);
              })
            }
            type="button"
          >
            {pending ? "Thinking…" : "Recommend a test"}
          </button>
        </div>
      </div>
      {result ? (
        <div className="surface" style={{ marginTop: "var(--sp-6)" }}>
          <span className="eyebrow">Recommendation</span>
          <h3 className="display-lg">{result.test}</h3>
          <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>{result.reasoning}</p>
          {result.steps.length > 0 ? (
            <>
              <h4 className="card-title" style={{ marginTop: "var(--sp-4)" }}>How to run it</h4>
              <ol className="note-body" style={{ paddingLeft: "var(--sp-6)" }}>
                {result.steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: "var(--sp-2)" }}>{s}</li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Analyzing Data: paste/upload a table → real descriptives + interpretation. */
export function DataAnalyzer({ signedIn }: { signedIn: boolean }) {
  const [table, setTable] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{
    columns: string[];
    rows: number;
    numeric: Record<string, { n: number; mean: number; median: number; sd: number; min: number; max: number }>;
    preview: string[][];
    chart: { labels: string[]; values: number[]; label: string } | null;
    suggestion: string;
    interpretation: string[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function analyze() {
    if (!table.trim()) {
      setMessage("Paste a table first — header row plus data rows.");
      return;
    }
    start(async () => {
      const res = await analyzeData({ tableText: table, researchQuestion: question });
      setMessage(res.message);
      if (res.ok && res.analysis) setResult(res.analysis);
    });
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
        ← Biostatistics
      </Link>
      <span className="eyebrow">Analyzing data</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-3)" }}>
        What does your data say?
      </h2>
      <p className="card-sub">
        Paste a table (or CSV) — header row first. Photos can’t be read yet: retype or paste the
        numbers and the whole pipeline works.
      </p>
      <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
        <div className="field">
          <label className="label" htmlFor="da-q">Research question</label>
          <input id="da-q" className="input" placeholder="e.g. does the drug lower systolic pressure?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="da-t">Data (CSV or pasted table)</label>
          <textarea
            id="da-t"
            className="textarea"
            style={{ minHeight: 140, fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}
            placeholder={"group,systolic\ncontrol,142\ntreated,128"}
            value={table}
            onChange={(e) => setTable(e.target.value)}
          />
        </div>
        {!signedIn ? <p className="hint">Sign in so analyses count toward your progress.</p> : null}
        {message ? <div className={`alert ${result ? "alert-ok" : "alert-danger"}`}>{message}</div> : null}
        <div>
          <button className="btn btn-primary" disabled={pending} onClick={analyze} type="button">
            {pending ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="stack" style={{ marginTop: "var(--sp-8)" }}>
          <section>
            <h3 className="display-lg" style={{ marginBottom: "var(--sp-3)" }}>
              Descriptives ({result.rows} rows)
            </h3>
            <table>
              <thead>
                <tr><th>Column</th><th>n</th><th>Mean</th><th>Median</th><th>SD</th><th>Min</th><th>Max</th></tr>
              </thead>
              <tbody>
                {Object.entries(result.numeric).map(([c, d]) => (
                  <tr key={c}>
                    <td>{c}</td><td>{d.n}</td><td>{d.mean}</td><td>{d.median}</td><td>{d.sd}</td><td>{d.min}</td><td>{d.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.keys(result.numeric).length === 0 ? (
              <p className="card-sub">No numeric columns found — descriptives need numbers.</p>
            ) : null}
          </section>

          {result.chart ? (
            <section>
              <h3 className="display-lg" style={{ marginBottom: "var(--sp-3)" }}>
                {result.chart.label}
              </h3>
              <BarChart labels={result.chart.labels} values={result.chart.values} />
            </section>
          ) : null}

          <section className="surface">
            <span className="eyebrow">Suggested test</span>
            <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{result.suggestion}</p>
          </section>

          <section>
            <h3 className="display-lg" style={{ marginBottom: "var(--sp-3)" }}>
              What this means, step by step
            </h3>
            <ol className="note-body" style={{ paddingLeft: "var(--sp-6)" }}>
              {result.interpretation.map((s, i) => (
                <li key={i} style={{ marginBottom: "var(--sp-2)" }}>{s}</li>
              ))}
            </ol>
            <Link className="btn btn-ghost btn-sm" href="/teach">
              Ask the Tutor →
            </Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function BarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="surface" role="img" aria-label={`Bar chart: ${labels.map((l, i) => `${l} ${values[i]}`).join(", ")}`}>
      <div className="stack-sm">
        {labels.map((l, i) => (
          <div key={l} className="row" style={{ gap: "var(--sp-3)" }}>
            <span className="list-sub" style={{ width: 120, flex: "none" }}>{l}</span>
            <span className="bar" style={{ flex: 1 }}>
              <i style={{ width: `${Math.round((values[i] / max) * 100)}%` }} />
            </span>
            <span className="list-title" style={{ width: 64, textAlign: "right" }}>{values[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reviewing a Paper: text in, structured appraisal out. */
export function PaperReviewer({ signedIn, documents }: { signedIn: boolean; documents: Array<{ id: string; title: string }> }) {
  const [docId, setDocId] = useState("");
  const [text, setText] = useState("");
  const [review, setReview] = useState<Record<string, string[]> | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await reviewPaper({ documentId: docId || undefined, pastedText: text || undefined });
      setMessage(res.message);
      if (res.ok && res.review) setReview(res.review);
    });
  }

  const TITLES: Record<string, string> = {
    summary: "Study summary",
    methods: "Methodology breakdown",
    findings: "Main findings",
    limitations: "Limitations",
    quality: "Strengths, weaknesses & overall quality",
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
        ← Biostatistics
      </Link>
      <span className="eyebrow">Reviewing a paper</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-3)" }}>
        Appraise it like a reviewer
      </h2>
      <p className="card-sub">
        Pick an uploaded paper, or paste the abstract and text. PDFs that won’t parse say so
        honestly — pasting the text always works.
      </p>
      {documents.length > 0 ? (
        <div className="chips" style={{ marginTop: "var(--sp-3)" }} role="group" aria-label="Paper">
          {documents.map((d) => (
            <button key={d.id} className="chip chip-sm" aria-pressed={docId === d.id} onClick={() => setDocId(docId === d.id ? "" : d.id)} type="button">
              {d.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="field" style={{ marginTop: "var(--sp-4)" }}>
        <label className="label" htmlFor="pr-text">Or paste the text / DOI link</label>
        <textarea
          id="pr-text"
          className="textarea"
          style={{ minHeight: 140 }}
          placeholder="Paste the abstract or full text here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {!signedIn ? <p className="hint" style={{ marginTop: 4 }}>Sign in so reviews count toward your progress.</p> : null}
      {message ? <div className={`alert ${review ? "alert-ok" : "alert-warn"}`} style={{ marginTop: "var(--sp-3)" }}>{message}</div> : null}
      <div style={{ marginTop: "var(--sp-3)" }}>
        <button className="btn btn-primary" disabled={pending} onClick={run} type="button">
          {pending ? "Reviewing…" : "Review paper"}
        </button>
      </div>

      {review ? (
        <div className="stack" style={{ marginTop: "var(--sp-8)" }}>
          {Object.entries(review).map(([key, lines]) => (
            <section key={key}>
              <h3 className="display-lg" style={{ marginBottom: "var(--sp-3)" }}>
                {TITLES[key] ?? key}
              </h3>
              <ul className="note-body" style={{ paddingLeft: "var(--sp-6)" }}>
                {lines.map((l, i) => (
                  <li key={i} style={{ marginBottom: "var(--sp-2)" }}>{l}</li>
                ))}
              </ul>
            </section>
          ))}
          <Link className="btn btn-ghost btn-sm" href="/teach">
            Ask the Tutor →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Writing Methodology: chat review ending in a savable section. */
export function MethodologyChat({ signedIn }: { signedIn: boolean }) {
  const [messages, setMessages] = useState<Array<{ who: "tutor" | "student"; text: string }>>([
    { who: "tutor", text: "Describe your plan — design, population, measurements, analysis — and I'll review it piece by piece." },
  ]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [saved, setSaved] = useState("");
  const [pending, start] = useTransition();

  async function send() {
    const text = draft.trim();
    if (!text || typing) return;
    setDraft("");
    setMessages((m) => [...m, { who: "student", text }]);
    setTyping(true);
    try {
      const res = await methodologyChat({
        transcript: messages.map((m) => ({ role: m.who, text: m.text })),
        message: text,
      });
      setMessages((m) => [...m, { who: "tutor", text: res.text }]);
    } finally {
      setTyping(false);
    }
  }

  function save() {
    const studentText = messages.filter((m) => m.who === "student").map((m) => m.text).join("\n\n");
    start(async () => {
      const { saveMethodology } = await import("@/app/research/biostat-actions");
      const res = await saveMethodology(studentText);
      setSaved(res.message);
    });
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
        ← Biostatistics
      </Link>
      <span className="eyebrow">Writing methodology</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-5)" }}>
        You write. The tutor reacts.
      </h2>
      <div className="tbubbles" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className="tturn">
            {m.who === "student" ? (
              <div className="tbubble tbubble-student">{m.text}</div>
            ) : (
              <div className="tbubble-row">
                <span className="tutor-mark" aria-hidden="true">⚓</span>
                <div className="tbubble tbubble-tutor">{m.text}</div>
              </div>
            )}
          </div>
        ))}
        {typing ? (
          <div className="tturn">
            <div className="tbubble-row">
              <span className="tutor-mark" aria-hidden="true">⚓</span>
              <div className="tbubble tbubble-tutor" aria-label="Tutor is writing">
                <span className="typing" aria-hidden="true"><i /><i /><i /></span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {!signedIn ? <p className="hint">Sign in so this counts toward your progress.</p> : null}
      <div className="composer-float">
        <input
          placeholder="Describe your plan…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          aria-label="Describe your plan"
        />
        <button className="send-round" onClick={send} disabled={!draft.trim() || typing} type="button" aria-label="Send">
          <span aria-hidden="true">↑</span>
        </button>
      </div>
      <div className="row" style={{ marginTop: "var(--sp-4)" }}>
        <button className="btn btn-sm" disabled={pending} onClick={save} type="button">
          Save my methodology section
        </button>
        {saved ? <span className="hint">{saved}</span> : null}
      </div>
    </div>
  );
}

/** Designing a Study: guided form ending in a shareable plan document. */
export function StudyPlanBuilder({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ goal: "", population: "", measurements: "", design: "", analysis: "", ethics: "", deadline: "" });
  const [plan, setPlan] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function build() {
    start(async () => {
      const { generateStudyPlan } = await import("@/app/research/biostat-actions");
      const res = await generateStudyPlan(form);
      setMessage(res.message);
      if (res.ok && res.plan) {
        setPlan(res.plan);
        router.refresh();
      }
    });
  }

  const fields: Array<[keyof typeof form, string, string]> = [
    ["goal", "Research goal", "e.g. does hand-hygiene auditing improve compliance on surgical wards?"],
    ["population", "Population", "e.g. nurses and doctors on two surgical wards"],
    ["measurements", "Measurements", "e.g. observed hand-hygiene opportunities, compliance rate"],
    ["design", "Possible designs", "e.g. before-after with a control ward"],
    ["analysis", "Analysis plan", "e.g. compare compliance rates with chi-square"],
    ["ethics", "Ethics", "e.g. audit approval, no patient identifiers recorded"],
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <Link className="btn btn-ghost btn-sm" href="/research?tab=biostat" style={{ marginBottom: "var(--sp-4)" }}>
        ← Biostatistics
      </Link>
      <span className="eyebrow">Designing a study</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-3)" }}>
        From goal to ethics, one part at a time
      </h2>
      <div className="stack-sm">
        {fields.map(([k, label, ph]) => (
          <div key={k} className="field">
            <label className="label" htmlFor={`sp-${k}`}>{label}</label>
            <textarea id={`sp-${k}`} className="textarea" style={{ minHeight: 64 }} placeholder={ph} value={form[k]} onChange={set(k)} />
          </div>
        ))}
        <div className="field">
          <label className="label" htmlFor="sp-deadline">Deadline (optional — goes to Study Plan)</label>
          <input id="sp-deadline" className="input" type="date" value={form.deadline} onChange={set("deadline")} />
        </div>
      </div>
      {!signedIn ? <p className="hint" style={{ marginTop: 4 }}>Sign in to build and save study plans.</p> : null}
      {message ? <div className={`alert ${plan ? "alert-ok" : "alert-danger"}`} style={{ marginTop: "var(--sp-3)" }}>{message}</div> : null}
      <div style={{ marginTop: "var(--sp-3)" }}>
        <button className="btn btn-primary" disabled={pending} onClick={build} type="button">
          {pending ? "Building…" : "Build my study plan"}
        </button>
      </div>
      {plan ? (
        <div className="surface" style={{ marginTop: "var(--sp-6)" }}>
          <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
            <h3 className="display-lg">Study plan document</h3>
            <button className="btn btn-sm" onClick={() => window.print()} type="button">
              Print / share
            </button>
          </div>
          <div className="note-body">
            {plan.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Concepts surfaced from the student's own materials. */
export function MaterialsConcepts({
  documents,
  initial,
}: {
  documents: Array<{ id: string; title: string }>;
  initial: Array<{ topic: string; slug: string; why: string }> | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [matches, setMatches] = useState<Array<{ topic: string; slug: string; why: string }> | null>(initial);
  const [message, setMessage] = useState(initial ? "" : "Pick materials to surface the statistics inside them.");
  const [pending, start] = useTransition();

  function run() {
    if (!picked.length) {
      setMessage("Pick at least one material.");
      return;
    }
    start(async () => {
      const res = await conceptsFromMaterials(picked);
      setMessage(res.message);
      setMatches(res.matches ?? []);
    });
  }

  return (
    <section>
      <div className="section-head">
        <h2 className="section-title">From my materials</h2>
      </div>
      <div className="chips" role="group" aria-label="Materials">
        {documents.map((d) => (
          <button
            key={d.id}
            className="chip chip-sm"
            aria-pressed={picked.includes(d.id)}
            onClick={() => setPicked((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))}
            type="button"
          >
            {d.title}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "var(--sp-3)" }}>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={run} type="button">
          {pending ? "Reading…" : "Surface concepts"}
        </button>
        {message ? <p className="hint" style={{ marginTop: "var(--sp-2)" }}>{message}</p> : null}
      </div>
      {matches && matches.length > 0 ? (
        <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
          {matches.map((m) => (
            <div key={m.slug} className="doc-row">
              <span style={{ flex: 1 }}>
                <span className="list-title">{m.topic}</span>
                <span className="list-sub" style={{ display: "block" }}>{m.why}</span>
              </span>
              <Link className="btn btn-sm" href={`/research?tab=biostat&concept=${m.slug}`}>
                Explain
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
