/**
 * Temporary auth bypass flag (testing only).
 *
 * Kept in its own module with zero imports so both server code (session.ts)
 * and client components (shell banner) can read it safely.
 */
export function isBypassOn(): boolean {
  return process.env.BYPASS_AUTH === "1";
}
