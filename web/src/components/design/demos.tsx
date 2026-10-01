"use client";

import { useEffect, useState } from "react";

/**
 * Theme switcher. Dark is the default; light is a pure token swap.
 *
 * The attribute must live on <html>, not a wrapper: `body` resolves its own
 * colour from the root tokens, so a scoped override would leave body-level
 * text (all headings, unstyled spans) in the old theme.
 */
export function ThemeToggle({ initial = "dark" }: { initial?: "dark" | "light" }) {
  const [theme, setTheme] = useState<"dark" | "light">(initial);

  // Honour `?theme=light` on first paint of this route.
  useEffect(() => {
    document.documentElement.dataset.theme = initial;
  }, [initial]);

  function apply(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("medanchor-theme", next);
    } catch {
      /* storage unavailable — theme still applies for this page view */
    }
  }

  return (
    <div className="row" style={{ gap: "var(--sp-2)" }}>
      <button
        className={theme === "dark" ? "btn btn-primary btn-sm" : "btn btn-sm"}
        onClick={() => apply("dark")}
        type="button"
      >
        Dark
      </button>
      <button
        className={theme === "light" ? "btn btn-primary btn-sm" : "btn btn-sm"}
        onClick={() => apply("light")}
        type="button"
      >
        Light
      </button>
    </div>
  );
}

/** 3D flip flashcard (PRD: active recall). */
export function FlipCardDemo() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="stack">
      <div className="flip-scene">
        <div
          className="flip"
          data-flipped={flipped}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Flashcard — activate to flip"
        >
          <div className="flip-face">
            <div>
              <div className="eyebrow">Front</div>
              <p style={{ fontWeight: 600 }}>Where does aldosterone exert its main effect?</p>
            </div>
          </div>
          <div className="flip-face flip-back">
            <div>
              <div className="eyebrow">Back</div>
              <p style={{ fontWeight: 600 }}>
                Distal tubule and collecting duct — reabsorb Na⁺, secrete K⁺ and H⁺.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => setFlipped((f) => !f)} type="button">
          Flip card
        </button>
        <span className="hint">Keyboard: Tab to focus, then Enter or Space.</span>
      </div>
    </div>
  );
}

/** Quiz option with annotated feedback (PRD §4.3 — explain why). */
export function QuizDemo() {
  const options = [
    { label: "Proximal tubule", correct: false, why: "Wrong site — this is where sodium is mostly reabsorbed, but aldosterone does not act here." },
    { label: "Distal tubule and collecting duct", correct: true, why: "Correct. Principal cells here reabsorb Na⁺ and secrete K⁺ and H⁺." },
    { label: "Loop of Henle", correct: false, why: "Site of action for loop diuretics, not aldosterone." },
  ];
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="stack-sm">
      {options.map((o, i) => {
        const isPicked = picked === i;
        const cls =
          picked === null
            ? "option"
            : o.correct
              ? "option option-correct"
              : isPicked
                ? "option option-wrong"
                : "option";
        return (
          <div key={o.label}>
            <button
              className={cls}
              onClick={() => setPicked(i)}
              disabled={picked !== null}
              type="button"
            >
              <span className="option-marker">{String.fromCharCode(65 + i)}</span>
              <span style={{ flex: 1 }}>
                {o.label}
                {picked !== null && o.correct ? (
                  <span className="badge badge-strong" style={{ marginLeft: "var(--sp-2)" }}>
                    Correct
                  </span>
                ) : null}
                {picked !== null && isPicked && !o.correct ? (
                  <span className="badge badge-attention" style={{ marginLeft: "var(--sp-2)" }}>
                    Your answer
                  </span>
                ) : null}
              </span>
            </button>
            {picked !== null ? <div className="annotation">{o.why}</div> : null}
          </div>
        );
      })}
      {picked !== null ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setPicked(null)} type="button">
          Reset
        </button>
      ) : null}
    </div>
  );
}

/** Tutor chat bubble + composer. */
export function ChatDemo() {
  const [messages, setMessages] = useState<{ who: "tutor" | "student"; text: string }[]>([
    { who: "tutor", text: "Let's start with the RAAS. What do you currently understand about it?" },
  ]);
  const [draft, setDraft] = useState("");

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { who: "student", text },
      {
        who: "tutor",
        text: text.length > 20
          ? "Good — that has substance. Going a level deeper: what is the main limitation of this measure?"
          : "Let's give you a way in. In one sentence, what problem does it help us with?",
      },
    ]);
    setDraft("");
  }

  return (
    <div className="stack">
      <div className="chat" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.who}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea
          className="textarea"
          placeholder="Explain in your own words…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          aria-label="Your answer"
        />
        <button className="btn btn-primary" onClick={send} type="button">
          Send
        </button>
      </div>
    </div>
  );
}
