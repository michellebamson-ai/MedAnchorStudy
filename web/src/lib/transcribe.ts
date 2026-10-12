/**
 * Speech-to-text for recorded lectures.
 *
 * Audio is the format students are most likely to actually have: a phone
 * recording of the lecture they are currently sitting in. Before this, an
 * upload returned "Audio is not transcribed yet", which meant the single most
 * convenient input was the one the app refused.
 *
 * Runs locally through faster-whisper on CPU. A student's lecture never leaves
 * the machine, which matters for anything recorded in a clinical placement.
 *
 * Degrades rather than throws. No Python, no model, or a timeout all come back
 * as a reason, and the caller can tell the student what to do instead.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  ok: boolean;
  /** False when the engine could not be reached, as opposed to hearing nothing. */
  ran: boolean;
  error?: string;
  text?: string;
  segments?: TranscriptSegment[];
  duration?: number;
  language?: string | null;
  languageProbability?: number;
  words?: number;
  model?: string;
}

/**
 * Transcription is slow enough to be a denial-of-service risk if it were
 * unbounded. Roughly 18x faster than real time on a laptop CPU for the base
 * model, so an hour of audio is minutes of work. This allows a long lecture
 * while still refusing the pathological case.
 */
const TIMEOUT_MS = 15 * 60 * 1000;
const MAX_BYTES = 60 * 1024 * 1024;

function pythonCandidates(): string[] {
  const fromEnv = process.env.PYTHON_PATH?.trim();
  const localAppData = process.env.LOCALAPPDATA;
  const candidates: string[] = [];
  if (fromEnv) candidates.push(fromEnv);
  if (localAppData) {
    for (const minor of ["313", "312", "311", "310"]) {
      candidates.push(path.join(localAppData, "Programs", "Python", `Python${minor}`, "python.exe"));
    }
  }
  candidates.push("python", "python3", "py");
  return candidates;
}

let cached: string | null | undefined;

async function findPython(): Promise<string | null> {
  if (cached !== undefined) return cached;
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
  if (!existsSync(scriptPath)) {
    cached = null;
    return null;
  }
  const candidates = pythonCandidates().filter((c) => (path.isAbsolute(c) ? existsSync(c) : true));
  for (const candidate of candidates) {
    const ok = await new Promise<boolean>((resolve) => {
      execFile(
        candidate,
        ["-c", "import faster_whisper"],
        { timeout: 20_000, windowsHide: true },
        (error) => resolve(!error)
      );
    });
    if (ok) {
      cached = candidate;
      return candidate;
    }
  }
  cached = null;
  return null;
}

/** Transcribe an audio buffer. Never throws. */
export async function transcribeAudio(
  buffer: Buffer,
  options: { model?: string; language?: string } = {}
): Promise<Transcript> {
  if (!buffer?.length) return { ok: false, ran: false, error: "That recording was empty." };
  if (buffer.length > MAX_BYTES) {
    return {
      ok: false,
      ran: false,
      error: "That recording is longer than an hour. Split it into parts and upload them separately.",
    };
  }

  const python = await findPython();
  if (!python) {
    return {
      ok: false,
      ran: false,
      error:
        "Speech-to-text needs Python with faster-whisper installed. Run: pip install faster-whisper",
    };
  }

  const payload = JSON.stringify({
    audioBase64: buffer.toString("base64"),
    model: options.model ?? process.env.WHISPER_MODEL ?? "base",
    language: options.language ?? null,
  });

  return new Promise((resolve) => {
    const child = execFile(
      python,
      [path.join(process.cwd(), "scripts", "transcribe.py")],
      {
        timeout: TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, PYTHONWARNINGS: "ignore" },
      },
      (error, stdout, stderr) => {
        const text = String(stdout ?? "").trim();
        if (!text) {
          resolve({
            ok: false,
            ran: false,
            error: error
              ? `Transcription failed: ${(error as Error).message.slice(0, 200)}`
              : `Transcription produced no output.${stderr ? ` ${String(stderr).trim().slice(0, 150)}` : ""}`,
          });
          return;
        }
        try {
          const parsed = JSON.parse(text) as Transcript;
          // An empty transcript from audio that does contain speech means the
          // model heard nothing usable. Saying "transcribed" would be a lie.
          if (parsed.ok && !parsed.words) {
            parsed.ok = false;
            parsed.error = "No speech was detected in that recording. It may be silent or music only.";
          }
          resolve({ ...parsed, ran: true });
        } catch {
          resolve({ ok: false, ran: false, error: "Transcription returned unreadable output." });
        }
      }
    );

    child.stdin?.write(payload);
    child.stdin?.end();
  });
}

export function resetTranscriptionCache(): void {
  cached = undefined;
}