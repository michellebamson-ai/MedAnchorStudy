"use client";

import Link from "next/link";

/**
 * Empty / early state (PROGRESS_SPEC.md §9). Sets expectations honestly: this
 * page needs a little activity before it can say anything useful.
 */
export function EmptyState() {
  return (
    <section className="surface prog-empty" aria-labelledby="prog-empty-heading">
      <span className="eyebrow">Just getting started</span>
      <h2 id="prog-empty-heading" className="display-lg" style={{ margin: "var(--sp-2) 0" }}>
        Your learning loop is just starting
      </h2>
      <p className="card-sub">
        Complete a few sessions in AI Tutor, Practice, or Materials and this page will begin showing
        personalized insights and next steps. Nothing here is guessed — every status comes from signals you
        actually produced.
      </p>
      <div className="row" style={{ marginTop: "var(--sp-6)" }}>
        <Link className="btn btn-primary" href="/plan">
          Go to Today&apos;s Plan
        </Link>
        <Link className="btn" href="/teach">
          Start AI Tutor
        </Link>
      </div>
      <ul className="prog-empty-list">
        <li>
          <b>Teach Me</b> — a guided session shows what you understand and what you are guessing.
        </li>
        <li>
          <b>Practice questions</b> — accuracy and the questions you miss both count.
        </li>
        <li>
          <b>Cases</b> — decision quality, which is where shaky knowledge usually shows.
        </li>
        <li>
          <b>Flashcards</b> — retention over time, feeding the spaced-review schedule.
        </li>
      </ul>
    </section>
  );
}