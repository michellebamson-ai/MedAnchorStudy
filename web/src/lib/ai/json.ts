/**
 * Tolerant JSON extraction from a language model's reply.
 *
 * Models wrap JSON in prose or fenced blocks often enough that a bare
 * `JSON.parse` fails in normal use. Everything here returns null rather than
 * throwing, because callers treat "unusable model output" as a signal to fall
 * back to the deterministic provider — not as an error worth surfacing to a
 * student mid-session.
 */

/** Strip ```json fences, then parse the largest balanced object/array found. */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;

  const unfenced = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const direct = tryParse<T>(unfenced);
  if (direct !== null) return direct;

  // Fall back to the first balanced {...} or [...] span.
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = unfenced.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < unfenced.length; i++) {
      const ch = unfenced[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const parsed = tryParse<T>(unfenced.slice(start, i + 1));
          if (parsed !== null) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

function tryParse<T>(candidate: string): T | null {
  try {
    const value: unknown = JSON.parse(candidate);
    return value === null ? null : (value as T);
  } catch {
    return null;
  }
}

/** Clamp a model-supplied number into 0..1 without trusting it blindly. */
export function clamp01(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

/** Narrow to plain objects, dropping nulls and arrays. */
export function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  const list = Array.isArray(value) ? value : [];
  return list.filter(
    (v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
  );
}