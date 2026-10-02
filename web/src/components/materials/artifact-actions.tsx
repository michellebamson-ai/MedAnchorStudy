"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deriveFromArtifact, toggleFavorite } from "@/app/materials/actions";

/** Star toggle for notes and summaries. */
export function StarButton({ artifactId, favorite }: { artifactId: string; favorite: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(favorite);
  const router = useRouter();

  return (
    <button
      className="btn btn-sm"
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Remove star" : "Star this"}
      title={on ? "Remove star" : "Star this"}
      onClick={() =>
        start(async () => {
          const res = await toggleFavorite(artifactId);
          if (res.ok) {
            setOn(!on);
            router.refresh();
          }
        })
      }
      type="button"
    >
      <span aria-hidden="true" style={{ color: on ? "var(--warn)" : undefined }}>
        {on ? "★" : "☆"}
      </span>
    </button>
  );
}

/** "Make flashcards from this" / "Practice this" with result feedback. */
export function DeriveButtons({ artifactId }: { artifactId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  function run(kind: "flashcards" | "questions") {
    start(async () => {
      const res = await deriveFromArtifact(artifactId, kind);
      setMessage(res.message);
      router.refresh();
    });
  }

  return (
    <span className="row" style={{ gap: "var(--sp-2)" }}>
      <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run("flashcards")} type="button">
        Make flashcards from this
      </button>
      <button className="btn btn-sm" disabled={pending} onClick={() => run("questions")} type="button">
        Practice this
      </button>
      {message ? <span className="hint">{message}</span> : null}
    </span>
  );
}
