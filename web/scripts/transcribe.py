"""
Speech-to-text for recorded lectures.

Reads audio as base64 on stdin, writes JSON on stdout. Audio never touches
disk, which matters because it is a student's lecture and it is being handled
on a machine they do not control.

    {"audioBase64": "...", "language": null, "model": "base"}

Segmentation matters more than it looks. Medical teaching is full of
multi-syllable terms that a general speech model renders as confident
nonsense, so segment boundaries and timings are preserved and returned rather
than flattened into one blob: a student can jump to the moment a drug was named
instead of scrubbing through a wall of text.

The model is loaded once per process and the script exits afterwards, so a
long upload cannot pin memory between requests. Model size is a deliberate
trade: "base" is the smallest that is still usable on clinical vocabulary, and
the choice is overridable per request.
"""

import base64
import io
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

# Keep the maths libraries from spawning a thread per core. On a laptop that
# oversubscribes the CPU and makes transcription slower, not faster.
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("CT2_NUM_THREADS", "4")

# A lecture is long. Refusing early is clearer than dying after four minutes.
MAX_BYTES = 60 * 1024 * 1024
ALLOWED_MODELS = {"tiny", "base", "small", "medium"}


def fail(message):
    json.dump({"ok": False, "error": message}, sys.stdout)
    sys.exit(1)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON input: {exc}")

    encoded = (payload.get("audioBase64") or "").strip()
    if not encoded:
        fail("no audio supplied")

    # Tolerate a data URL prefix from a browser FileReader.
    if encoded.startswith("data:"):
        encoded = encoded.split(",", 1)[1] if "," in encoded else ""

    if len(encoded) > MAX_BYTES * 2:
        fail("that recording is too long to transcribe in one piece")

    try:
        blob = base64.b64decode(encoded, validate=False)
    except Exception:
        fail("audio could not be decoded")

    if len(blob) < 1024:
        fail("that file is too small to be audio")

    model_name = (payload.get("model") or "base").strip().lower()
    if model_name not in ALLOWED_MODELS:
        model_name = "base"

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        fail(f"faster-whisper is not installed: {exc}")

    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception as exc:
        fail(f"could not load the '{model_name}' speech model: {exc}")

    try:
        segments, info = model.transcribe(
            io.BytesIO(blob),
            language=payload.get("language") or None,
            vad_filter=True,          # drop silence, which otherwise invents words
            vad_parameters={"min_silence_duration_ms": 500},
            beam_size=5,
            condition_on_previous_text=False,  # stops one hallucination cascading
            temperature=0.0,          # no sampling, so output is reproducible
        )

        out = []
        words = 0
        for seg in segments:
            text = (seg.text or "").strip()
            if not text:
                continue
            words += len(text.split())
            out.append({
                "start": round(float(seg.start), 2),
                "end": round(float(seg.end), 2),
                "text": text,
            })

        duration = float(getattr(info, "duration", 0) or 0)
        detected = getattr(info, "language", None)

        json.dump({
            "ok": True,
            "text": " ".join(s["text"] for s in out),
            "segments": out,
            "duration": round(duration, 1),
            "language": detected,
            "languageProbability": round(float(getattr(info, "language_probability", 0) or 0), 3),
            "words": words,
            "model": model_name,
            "segments_kept": len(out),
        }, sys.stdout)

    except Exception as exc:
        fail(f"transcription failed: {exc}")


if __name__ == "__main__":
    main()