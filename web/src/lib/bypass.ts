/**
 * Auth bypass flag — testing only, and fail-safe by design.
 *
 * Kept in its own module with zero imports so both server code (session.ts)
 * and client components (the demo banner) can read it safely.
 *
 * The footgun this closes: `BYPASS_AUTH=1` silently turns every visitor into
 * the same demo student, so a build that captured it would hand real accounts
 * and real uploads to a shared identity. Production now ignores it unless
 * someone opts in a second time, deliberately, by name.
 */
/** Warn once per process: this is read by every page, and a build would spam. */
let warnedSuppressed = false;
let warnedLive = false;

export function isBypassOn(): boolean {
  if (process.env.BYPASS_AUTH !== "1") return false;
  if (process.env.NODE_ENV !== "production") return true;
  // Production requires a second, explicit acknowledgement.
  if (process.env.ALLOW_DEMO_IN_PRODUCTION === "1") {
    if (!warnedLive) {
      warnedLive = true;
      console.warn(
        "[auth] DEMO BYPASS IS LIVE IN PRODUCTION. Every visitor is the shared demo student. " +
          "Unset BYPASS_AUTH and ALLOW_DEMO_IN_PRODUCTION before real users arrive."
      );
    }
    return true;
  }
  if (!warnedSuppressed) {
    warnedSuppressed = true;
    console.warn(
      "[auth] BYPASS_AUTH=1 was ignored because NODE_ENV=production. " +
        "Set ALLOW_DEMO_IN_PRODUCTION=1 only if you really mean to ship the demo identity."
    );
  }
  return false;
}

/** True when the flag is set but deliberately suppressed — worth surfacing in the UI. */
export function isBypassSuppressed(): boolean {
  return (
    process.env.BYPASS_AUTH === "1" &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_IN_PRODUCTION !== "1"
  );
}
