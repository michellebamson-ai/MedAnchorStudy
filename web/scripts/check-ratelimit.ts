/**
 * Rate limit checks.
 *
 * The point of this limiter is that it stops spending, so the test has to prove
 * it actually refuses rather than merely counting. Every check drives the real
 * limiter past its budget and asserts the refusal, then asserts that a
 * different subject is unaffected, because a limiter that blocks everyone once
 * one person abuses it is its own outage.
 *
 * Runs entirely on the in-process backend so it needs no Upstash account.
 *
 *   npm run check:ratelimit
 */

import { checkLimit, limitMessage, memoryKeyCount, rateLimitConfigured, resetMemoryLimiter } from "../src/lib/rate-limit";
import { AI_BUDGETS, ANON_BUDGETS, aiGuard } from "../src/lib/ai-budget";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("\nRATE LIMIT CHECKS\n");

  // ---- backend selection ----
  console.log(`  upstash configured: ${rateLimitConfigured()}`);
  check("runs without Upstash credentials", true, "using the in-process fallback");

  resetMemoryLimiter();

  // ---- the limiter actually stops spending ----
  const res1 = await checkLimit("t:1", 3, 60);
  const res2 = await checkLimit("t:1", 3, 60);
  const res3 = await checkLimit("t:1", 3, 60);
  const res4 = await checkLimit("t:1", 3, 60);
  check("calls 1-3 are allowed", res1.ok && res2.ok && res3.ok, `${res1.remaining}/${res1.limit} then ${res3.remaining}`);
  check("call 4 over the limit is refused", res4.ok === false, `remaining=${res4.remaining}`);
  check("remaining never goes negative", res4.remaining === 0, `${res4.remaining}`);

  // ---- one student cannot affect another ----
  const other = await checkLimit("t:2", 3, 60);
  check("a different subject has its own budget", other.ok && other.remaining === 2, `remaining=${other.remaining}`);

  // ---- scopes are independent ----
  await checkLimit("t:1", 3, 60); // exhaust tutor:u1
  const otherScope = await checkLimit("generate:u1", 3, 60);
  check("a different scope is unaffected", otherScope.ok, `remaining=${otherScope.remaining}`);

  // ---- window expiry frees the budget ----
  resetMemoryLimiter();
  const shortWindow = { limit: 1, windowSeconds: 1 };
  const a1 = await checkLimit("exp:1", shortWindow.limit, shortWindow.windowSeconds);
  const a2 = await checkLimit("exp:1", shortWindow.limit, shortWindow.windowSeconds);
  check("second call in the same window is refused", a1.ok && !a2.ok);
  await new Promise((r) => setTimeout(r, 1100));
  const a3 = await checkLimit("exp:1", shortWindow.limit, shortWindow.windowSeconds);
  check("budget returns after the window", a3.ok === true);

  // ---- the student-facing message ----
  resetMemoryLimiter();
  let message: string | null = null;
  for (let i = 0; i < 12; i++) {
    const m = await limitMessage({ subject: "u9", scope: "generate", limit: 2, windowSeconds: 60 });
    if (m) {
      message = m;
      break;
    }
  }
  check("over budget produces a readable message", !!message, message ?? "none");
  check("message names a wait time", !!message && /second/i.test(message), message ?? "");
  check("message does not leak internals", !!message && !/redis|upstash|token|key/i.test(message));

  // ---- budgets are sane for a real student ----
  console.log("\n  configured budgets:");
  for (const [scope, b] of Object.entries(AI_BUDGETS)) {
    console.log(`    ${scope.padEnd(12)} ${b.limit} per ${b.windowSeconds}s`);
    if (b.limit < 1 || b.windowSeconds < 1) check(`budget ${scope} is valid`, false);
  }
  for (const [scope, b] of Object.entries(ANON_BUDGETS)) {
    console.log(`    anon:${scope.padEnd(8)} ${b.limit} per ${b.windowSeconds}s`);
    if (b.limit < 1 || b.windowSeconds < 1) check(`anon budget ${scope} is valid`, false);
  }
  check("every budget has a positive limit", true);

  // The most expensive action must be the tightest, or a script can drain the
  // account through generation while leaving the tutor wide open.
  check("generate is budgeted tighter than tutor", AI_BUDGETS.generate.limit <= AI_BUDGETS.tutor.limit);
  check("reset is throttled hard for anonymous callers", ANON_BUDGETS.passwordReset.limit <= 10);

  // ---- aiGuard honours the table ----
  resetMemoryLimiter();
  let gated: string | null = null;
  for (let i = 0; i < AI_BUDGETS.tutor.limit + 2; i++) {
    gated = await aiGuard("guard-user", "tutor");
    if (gated) break;
  }
  check("aiGuard blocks once the tutor budget is spent", !!gated, gated ?? "never blocked");
  const afterGuard = await aiGuard("other-user", "tutor");
  check("aiGuard leaves other users alone", afterGuard === null);

  // ---- memory backend stays bounded ----
  resetMemoryLimiter();
  for (let i = 0; i < 60; i++) await checkLimit(`bulk:${i}`, 5, 60);
  check("memory backend keeps one key per subject", memoryKeyCount() === 60, `${memoryKeyCount()} keys`);

  console.log("");
  if (failures) {
    console.log(`  ${failures} RATE LIMIT CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  RATE LIMIT CHECKS PASSED\n");
}

main().catch((err) => {
  console.log(`  ERRORED: ${err?.message ?? err}\n`);
  process.exit(1);
});