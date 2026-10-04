/**
 * The auth bypass must never reach production by accident.
 *
 * This is a security-relevant guard, so it is a real test rather than a
 * one-off check: a regression here would hand every visitor the same account.
 */
import { isBypassOn, isBypassSuppressed } from "../src/lib/bypass";

type Env = Record<string, string | undefined>;

const CASES: Array<[string, Env, boolean, boolean]> = [
  // [label, env, expected bypassOn, expected suppressed]
  ["no flag at all", { NODE_ENV: "development" }, false, false],
  ["dev + flag", { BYPASS_AUTH: "1", NODE_ENV: "development" }, true, false],
  ["dev + flag=0", { BYPASS_AUTH: "0", NODE_ENV: "development" }, false, false],
  // The important ones: production ignores the flag...
  ["production + flag only", { BYPASS_AUTH: "1", NODE_ENV: "production" }, false, true],
  // ...unless someone opts in a second time, deliberately.
  [
    "production + explicit override",
    { BYPASS_AUTH: "1", NODE_ENV: "production", ALLOW_DEMO_IN_PRODUCTION: "1" },
    true,
    false,
  ],
  // The override alone is not enough.
  ["production + override only", { NODE_ENV: "production", ALLOW_DEMO_IN_PRODUCTION: "1" }, false, false],
  ["production, nothing set", { NODE_ENV: "production" }, false, false],
];

const KEYS = ["BYPASS_AUTH", "NODE_ENV", "ALLOW_DEMO_IN_PRODUCTION"];
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function withEnv(env: Env) {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
}

function main() {
  let failures = 0;
  // console.warn noise from the guard itself is expected; keep the output readable.
  const realWarn = console.warn;
  console.warn = () => undefined;

  for (const [label, env, wantOn, wantSuppressed] of CASES) {
    withEnv(env);
    const on = isBypassOn();
    const suppressed = isBypassSuppressed();
    const ok = on === wantOn && suppressed === wantSuppressed;
    if (!ok) failures += 1;
    realWarn(
      `${ok ? "PASS" : "FAIL"}  ${label.padEnd(30)} bypassOn=${String(on).padEnd(5)} suppressed=${suppressed}`
    );
  }

  console.warn = realWarn;
  withEnv(original as Env);

  if (failures) {
    console.error(`\nFAILED: ${failures} bypass guard case(s) wrong`);
    process.exit(1);
  }
  console.log("\nBYPASS GUARD CHECKS PASSED");
}

main();