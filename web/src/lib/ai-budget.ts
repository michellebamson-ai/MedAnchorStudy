import { limitMessage } from "@/lib/rate-limit";

/**
 * AI spending budgets, in one place.
 *
 * The numbers are deliberately generous for a single human and tight enough to
 * stop a script. A student revising hard will not notice these; a loop hitting
 * an endpoint a thousand times will stop almost immediately.
 *
 * Windows are short because these are interactive actions: someone clicking
 * "generate" repeatedly is either confused or automating.
 */
export interface Budget {
  limit: number;
  windowSeconds: number;
}

export const AI_BUDGETS: Record<string, Budget> = {
  // Document generation is the most expensive thing in the app: it can loop
  // over six topics and four artifact kinds in a single click.
  generate: { limit: 10, windowSeconds: 60 },
  analyze: { limit: 15, windowSeconds: 60 },
  // A tutoring turn is one model call.
  tutor: { limit: 30, windowSeconds: 60 },
  assist: { limit: 40, windowSeconds: 60 },
  case: { limit: 20, windowSeconds: 60 },
  roleplay: { limit: 60, windowSeconds: 60 },
  // Literature search hits three external APIs; the app already caches for ten
  // minutes, so this mainly stops cache-busting.
  search: { limit: 30, windowSeconds: 60 },
  evidence: { limit: 10, windowSeconds: 60 },
  biostat: { limit: 20, windowSeconds: 60 },
  assignment: { limit: 20, windowSeconds: 60 },
  // Uploads cost OCR CPU and storage.
  upload: { limit: 20, windowSeconds: 60 },
};

/** Cheap anonymous buckets for endpoints that must work before sign-in. */
export const ANON_BUDGETS: Record<string, Budget> = {
  // Stops one script from emailing every address in the world via reset.
  passwordReset: { limit: 5, windowSeconds: 300 },
  signUp: { limit: 10, windowSeconds: 300 },
};

/**
 * Returns null when the call is allowed, or the message to show the student.
 *
 * `subject` should be the user id where known. Callers that only have an
 * address or nothing at all should pass a coarse identifier, because a limiter
 * that ignores anonymous traffic is no protection at all.
 */
export async function aiGuard(
  subject: string,
  scope: keyof typeof AI_BUDGETS
): Promise<string | null> {
  const budget = AI_BUDGETS[scope] ?? { limit: 20, windowSeconds: 60 };
  return limitMessage({ subject, scope, limit: budget.limit, windowSeconds: budget.windowSeconds });
}

export async function anonGuard(
  subject: string,
  scope: keyof typeof ANON_BUDGETS
): Promise<string | null> {
  const budget = ANON_BUDGETS[scope] ?? { limit: 5, windowSeconds: 300 };
  return limitMessage({ subject, scope, limit: budget.limit, windowSeconds: budget.windowSeconds });
}