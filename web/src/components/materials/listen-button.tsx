"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Listen" button (MATERIALS_SPEC.md §3/§4). Reads the text aloud with the
 * browser's speech synthesis — no server, no key, works offline. The visible
 * text on the page doubles as the transcript (spec: captions/transcript show
 * while it plays); the current sentence is highlighted as it is spoken.
 */
export function ListenButton({
  text,
  rates = false,
}: {
  text: string;
  rates?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [sentence, setSentence] = useState(-1);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* no speech support */
      }
    };
  }, []);

  function stop() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setPlaying(false);
    setSentence(-1);
  }

  function play() {
    if (!("speechSynthesis" in window) || !sentences.length) return;
    stop();
    let i = 0;
    const speakNext = () => {
      if (i >= sentences.length) {
        setPlaying(false);
        setSentence(-1);
        return;
      }
      const u = new SpeechSynthesisUtterance(sentences[i]);
      u.rate = rate;
      const n = i;
      u.onend = () => {
        i += 1;
        speakNext();
      };
      u.onerror = () => {
        setPlaying(false);
        setSentence(-1);
      };
      utterRef.current = u;
      setSentence(n);
      window.speechSynthesis.speak(u);
    };
    setPlaying(true);
    speakNext();
  }

  return (
    <span className="row" style={{ gap: "var(--sp-2)" }}>
      <button
        className="btn btn-sm"
        onClick={() => (playing ? stop() : play())}
        type="button"
        aria-label={playing ? "Stop reading aloud" : "Listen to this"}
      >
        <span aria-hidden="true">{playing ? "■" : "♪"}</span> Listen
      </button>
      {rates ? (
        <span className="chips" role="group" aria-label="Reading speed">
          {[
            ["slow", 0.8],
            ["normal", 1],
            ["fast", 1.25],
          ].map(([label, r]) => (
            <button
              key={label as string}
              className="chip chip-sm"
              aria-pressed={rate === r}
              onClick={() => setRate(r as number)}
              type="button"
            >
              {label as string}
            </button>
          ))}
        </span>
      ) : null}
      {sentence >= 0 && sentences[sentence] ? (
        <span className="hint" aria-live="polite">
          “{sentences[sentence].slice(0, 90)}{sentences[sentence].length > 90 ? "…" : ""}”
        </span>
      ) : null}
    </span>
  );
}
