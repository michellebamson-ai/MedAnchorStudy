"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { gradeCard } from "@/app/materials/actions";
import { ListenButton } from "@/components/materials/listen-button";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  topicSlug: string | null;
  topicTitle: string | null;
  cardType: string;
}

/**
 * Review screen (MATERIALS_SPEC.md §5): counter, big card, tap to flip,
 * Wrong / Correct, listen, and an end screen with score, topics and next
 * steps. Grading flows into SM-2, mastery, the planner and progress.
 */
export function ReviewRunner({
  title,
  cards,
  signedIn,
  backHref,
}: {
  title: string;
  cards: ReviewCard[];
  signedIn: boolean;
  backHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean; topic: string | null }>>([]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  const done = index >= cards.length;
  const card = !done ? cards[index] : null;

  function grade(correct: boolean) {
    if (!card || pending) return;
    if (!signedIn) {
      // Browse-only: move on without recording.
      setResults((r) => [...r, { id: card.id, correct, topic: card.topicTitle }]);
      setIndex((i) => i + 1);
      setFlipped(false);
      return;
    }
    start(async () => {
      const res = await gradeCard(card.id, correct ? "good" : "forgot", card.topicSlug);
      setMessage(res.message);
      setResults((r) => [...r, { id: card.id, correct, topic: card.topicTitle }]);
      setIndex((i) => i + 1);
      setFlipped(false);
    });
  }

  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const missedTopics = [...new Set(results.filter((r) => !r.correct).map((r) => r.topic).filter(Boolean))];
    const goodTopics = [...new Set(results.filter((r) => r.correct).map((r) => r.topic).filter(Boolean))];
    const wrongIds = results.filter((r) => !r.correct).map((r) => r.id);

    return (
      <div className="review-stage">
        <span className="eyebrow">Review complete</span>
        <h2 className="display-sm">
          {correct} of {total} correct
        </h2>
        <p className="lede">
          {pct >= 80 ? "Strong session." : pct >= 50 ? "Getting there." : "Worth another pass."}{" "}
          Next review: tomorrow.
        </p>
        {goodTopics.length > 0 ? (
          <p className="card-sub">
            Went well: {goodTopics.slice(0, 3).join(", ")}
          </p>
        ) : null}
        {missedTopics.length > 0 ? (
          <p className="card-sub">
            To review: {missedTopics.slice(0, 3).join(", ")}
          </p>
        ) : null}
        <div className="row" style={{ justifyContent: "center", marginTop: "var(--sp-6)" }}>
          {wrongIds.length > 0 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                const wrong = cards.filter((c) => wrongIds.includes(c.id));
                // Restart with only the missed cards.
                setResults([]);
                setIndex(0);
                setFlipped(false);
                // Swap the deck in place.
                cards.splice(0, cards.length, ...wrong);
              }}
              type="button"
            >
              Review wrong cards
            </button>
          ) : null}
          <Link className="btn" href="/materials?tab=questions">
            Practice this
          </Link>
          <Link className="btn btn-ghost" href={backHref}>
            Back to decks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="review-stage">
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <span className="review-counter">
          {index + 1}/{cards.length}
        </span>
        <Link className="btn btn-ghost btn-sm" href={backHref} aria-label="Close review">
          ✕
        </Link>
      </div>

      <h2 className="display-sm" style={{ marginBottom: "var(--sp-4)" }}>
        {title}
      </h2>

      <div
        className="review-card"
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Answer shown. Activate to hide." : "Question shown. Activate to flip."}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
      >
        <div>
          <div className="eyebrow">{flipped ? "Answer" : card?.cardType === "term" ? "Term" : "Question"}</div>
          <p style={{ margin: 0 }}>{flipped ? card?.back : card?.front}</p>
          {!flipped ? <p className="hint" style={{ marginTop: "var(--sp-3)" }}>Tap to flip</p> : null}
        </div>
      </div>

      {flipped ? (
        <>
          <div className="row" style={{ justifyContent: "center", marginTop: "var(--sp-3)" }}>
            <ListenButton text={`${card?.front ?? ""}. ${card?.back ?? ""}`} />
            <Link className="btn btn-ghost btn-sm" href="/teach">
              Ask the tutor →
            </Link>
          </div>
          <div className="review-grade">
            <button className="btn btn-wrong" disabled={pending} onClick={() => grade(false)} type="button">
              Wrong
            </button>
            <button className="btn btn-correct" disabled={pending} onClick={() => grade(true)} type="button">
              Correct
            </button>
          </div>
          {message ? <p className="hint" style={{ marginTop: "var(--sp-3)" }}>{message}</p> : null}
        </>
      ) : null}
    </div>
  );
}
