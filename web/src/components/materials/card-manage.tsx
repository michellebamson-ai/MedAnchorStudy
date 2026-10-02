"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCard, deleteCard, updateCard } from "@/app/materials/actions";

/** "Add a card" — front, back, type. */
export function CardForm({ documentId }: { documentId?: string }) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardType, setCardType] = useState("qa");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} type="button">
        Add a card
      </button>
    );
  }

  return (
    <form
      className="surface stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const form = new FormData();
          form.append("front", front);
          form.append("back", back);
          form.append("cardType", cardType);
          if (documentId) form.append("documentId", documentId);
          const res = await createCard(form);
          setMessage(res.message);
          if (res.ok) {
            setFront("");
            setBack("");
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <h3 className="card-title">New card</h3>
      <div className="field">
        <label className="label" htmlFor="card-front">Front</label>
        <input
          className="input"
          id="card-front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Question, term, or formula"
          required
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="card-back">Back</label>
        <textarea
          className="textarea"
          id="card-back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Answer, meaning, or worked example"
          required
        />
      </div>
      <div className="field">
        <span className="label">Type</span>
        <div className="chips" role="group" aria-label="Card type">
          {[
            ["qa", "Question"],
            ["term", "Term"],
            ["formula", "Formula"],
            ["concept", "Concept"],
          ].map(([v, label]) => (
            <button
              key={v}
              className="chip chip-sm"
              aria-pressed={cardType === v}
              onClick={() => setCardType(v)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {message ? <div className="alert alert-danger">{message}</div> : null}
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={pending} type="submit">
          {pending ? "Adding…" : "Add card"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** One card row: flip preview, edit, note, delete. */
export function CardRow({
  card,
}: {
  card: { id: string; front: string; back: string; cardType: string; note: string | null };
}) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [note, setNote] = useState(card.note ?? "");
  const [showNote, setShowNote] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save(patch: { front?: string; back?: string; note?: string }) {
    start(async () => {
      await updateCard(card.id, patch);
      setEditing(false);
      setShowNote(false);
      router.refresh();
    });
  }

  return (
    <div className="doc-row" style={{ alignItems: "flex-start" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <span className="stack-sm">
            <input className="input" value={front} onChange={(e) => setFront(e.target.value)} aria-label="Front" />
            <textarea className="textarea" value={back} onChange={(e) => setBack(e.target.value)} aria-label="Back" />
            <span className="row">
              <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => save({ front, back })} type="button">
                Save
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} type="button">
                Cancel
              </button>
            </span>
          </span>
        ) : (
          <>
            <span className="list-title">{card.front}</span>
            <span className="list-sub" style={{ display: "block" }}>
              {card.back.slice(0, 120)}
              {card.back.length > 120 ? "…" : ""}
            </span>
            <span className="tag" style={{ marginTop: 4 }}>
              {card.cardType}
            </span>
            {card.note ? (
              <span className="list-sub" style={{ display: "block", marginTop: 4 }}>
                Note: {card.note}
              </span>
            ) : null}
          </>
        )}
        {showNote && !editing ? (
          <span className="stack-sm" style={{ marginTop: "var(--sp-2)" }}>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note on this card…"
              aria-label="Card note"
            />
            <span className="row">
              <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => save({ note })} type="button">
                Save note
              </button>
            </span>
          </span>
        ) : null}
      </span>
      {!editing ? (
        <span className="row" style={{ gap: 4 }}>
          <button className="btn btn-sm" onClick={() => setEditing(true)} type="button">
            Edit
          </button>
          <button className="btn btn-sm" onClick={() => setShowNote((s) => !s)} type="button">
            Note
          </button>
          <button
            className="btn btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (confirm("Delete this card?")) {
                  await deleteCard(card.id);
                  router.refresh();
                }
              })
            }
            type="button"
          >
            Delete
          </button>
        </span>
      ) : null}
    </div>
  );
}
