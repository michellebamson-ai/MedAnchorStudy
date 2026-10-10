/**
 * Feature smoke tests run as the shared demo student.
 *
 * These suites exercise study logic (plan, progress, research, settings), not
 * authentication, and they call server actions directly rather than through a
 * browser, so they have no session cookie to present. They opt into the demo
 * identity here, which lets web/.env keep authentication switched on for real
 * use — the flag belongs to the test, not to the application.
 *
 * Authentication itself is covered separately and against real accounts:
 * check:extract signs up through Better Auth, smoke:materials does the same,
 * and check:bypass proves the flag cannot reach production.
 *
 * Note this reads process.env at call time, so importing this module first is
 * enough regardless of when the modules under test are evaluated.
 */
process.env.BYPASS_AUTH = "1";
