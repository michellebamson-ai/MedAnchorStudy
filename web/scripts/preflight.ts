/** Deployment preflight CLI. See src/lib/preflight.ts for the checks. */
import { blockers, runPreflight } from "../src/lib/preflight";

function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* running outside the project directory is fine */
  }

  // This is a deployment gate, so evaluate as production would — otherwise a
  // local dev bypass would read as safe to ship.
  const env = { ...process.env, NODE_ENV: "production" };
  const checks = runPreflight(env);
  const bad = blockers(checks);
  const warnings = checks.filter((c) => !c.ok && !c.blocker);

  console.log("\nMedAnchor Study — deployment preflight (evaluating as production)\n");
  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.blocker ? "FAIL" : "WARN";
    console.log(`  [${mark}] ${c.name.padEnd(34)} ${c.detail}`);
    if (!c.ok && c.fix) console.log(`         fix: ${c.fix}`);
  }

  console.log("");
  if (warnings.length) console.log(`  ${warnings.length} warning(s) — worth knowing, not shipping blockers.`);
  if (bad.length) {
    console.log(`\n  ${bad.length} BLOCKER(S). Do not deploy yet:\n`);
    for (const c of bad) console.log(`    - ${c.name}: ${c.detail}${c.fix ? `\n      ${c.fix}` : ""}`);
    console.log("");
    process.exit(1);
  }
  console.log("  No blockers. Clear to deploy.\n");
}

main();