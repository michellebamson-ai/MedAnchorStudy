import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for AI and other expensive work.
 *
 * Why this exists: every AI call in the app is a server action that spends real
 * money on Groq, Gemini or Claude. There are around fifty of them across seven
 * files, and until now any signed-in student could call them as fast as the
 * browser could fire requests. One bored student could drain a day's Groq quota
 * in minutes, and Gemini's free tier is capped at twenty requests a day.
 *
 * Backed by Upstash Redis so the limit is shared across every server instance.
 * When no Upstash credentials are configured it falls back to an in-process
 * counter, which still protects a single-machine development run and the tests,
 * and is honestly reported as weaker: it resets on restart and does not work
 * across instances.
 *
 * Keys are built from the signed-in user where possible. Anonymous callers fall
 * back to a coarse identifier, because rate limiting that requires sign-in
 * would not limit the sign-up and reset-password endpoints at all.
 */

type EnvLike = Record<string, string | undefined>;

function env(): EnvLike {
  return process.env;
}

export interface LimitResult {
  /** False means the caller is over budget and should be turned away. */
  ok: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window resets. */
  reset: number;
  /** "upstash" when shared counters are in use, "memory" for the local fallback. */
  backend: "upstash" | "memory";
}

export function rateLimitConfigured(): boolean {
  return !!(env().UPSTASH_REDIS_REST_URL ?? "").trim() && !!(env().UPSTASH_REDIS_REST_TOKEN ?? "").trim();
}

type Limiter = Ratelimit;

const limiters = new Map<string, Limiter>();

function getLimiter(limit: number, windowSeconds: number): Limiter | null {
  if (!rateLimitConfigured()) return null;
  const cacheKey = `${limit}:${windowSeconds}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;

  const redis = new Redis({
    url: (env().UPSTASH_REDIS_REST_URL ?? "").trim(),
    token: (env().UPSTASH_REDIS_REST_TOKEN ?? "").trim(),
  });

  const limiter = new Ratelimit({
    redis,
    // Sliding window: a fixed window lets someone burn two budgets by
    // straddling the boundary.
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: "medanchor:rl",
    analytics: false,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

/** In-process fallback. One map, bounded, so it cannot grow without limit. */
const memory = new Map<string, { count: number; reset: number }>();
const MEMORY_MAX_KEYS = 10_000;

async function limitInMemory(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = memory.get(key);

  if (!existing || existing.reset <= now) {
    if (memory.size >= MEMORY_MAX_KEYS) {
      // Cheap eviction: drop the oldest few entries.
      const oldest = [...memory.entries()].sort((a, b) => a[1].reset - b[1].reset).slice(0, 100);
      for (const [k] of oldest) memory.delete(k);
    }
    const fresh = { count: 1, reset: now + windowMs };
    memory.set(key, fresh);
    return { ok: true, limit, remaining: limit - 1, reset: fresh.reset, backend: "memory" };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return {
    ok: existing.count <= limit,
    limit,
    remaining,
    reset: existing.reset,
    backend: "memory",
  };
}

/**
 * Count one call against `key` and say whether it is allowed.
 *
 * Never throws. A rate limiter that can take the site down is worse than no
 * limiter, so any failure opens the gate and is visible in the return value.
 */
export async function checkLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<LimitResult> {
  const limiter = getLimiter(limit, windowSeconds);
  if (!limiter) return limitInMemory(key, limit, windowSeconds);

  try {
    const res = await limiter.limit(key);
    return {
      ok: res.success,
      limit: res.limit,
      remaining: Math.max(0, res.remaining),
      reset: res.reset,
      backend: "upstash",
    };
  } catch {
    // Redis unreachable. Do not lock the student out of their own revision.
    return { ok: true, limit, remaining: limit, reset: Date.now() + windowSeconds * 1000, backend: "memory" };
  }
}

export interface GuardOptions {
  /** Stable identity, usually the user id. */
  subject: string;
  /** Namespaces the bucket, e.g. "ai:generate". */
  scope: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Convenience wrapper for the common case: returns null when allowed, or a
 * message to show the student when not.
 */
export async function limitMessage(opts: GuardOptions): Promise<string | null> {
  const res = await checkLimit(`${opts.scope}:${opts.subject}`, opts.limit, opts.windowSeconds);
  if (res.ok) return null;
  const seconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  return `You're using this faster than the plan allows. Try again in about ${seconds} second${
    seconds === 1 ? "" : "s"
  }.`;
}

/** Test seam. */
export function resetMemoryLimiter(): void {
  memory.clear();
}

/** Test seam. */
export function memoryKeyCount(): number {
  return memory.size;
}