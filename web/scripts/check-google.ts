/**
 * Proves the Google provider is genuinely trusted at runtime.
 *
 * A nested `socialProviders.google.accountLinking` is accepted silently and
 * then ignored, so compiling and building prove nothing here. This asserts on
 * the resolved options Better Auth itself will use.
 */
import { auth } from "../src/lib/auth";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("\nGOOGLE ACCOUNT-LINKING CHECKS\n");

  const ctx = await auth.$context;
  const opts = ctx.options as {
    account?: { accountLinking?: { enabled?: boolean; trustedProviders?: string[] } };
    socialProviders?: Record<string, unknown>;
  };

  const linking = opts.account?.accountLinking;

  console.log(`  socialProviders: ${Object.keys(opts.socialProviders ?? {}).join(", ") || "(none)"}`);
  console.log(`  account.accountLinking: ${JSON.stringify(linking)}\n`);

  check("google provider registered", !!opts.socialProviders?.google);
  check("accountLinking block exists", !!linking);
  check("accountLinking.enabled is true", linking?.enabled === true, String(linking?.enabled));
  check(
    "google is in trustedProviders",
    Array.isArray(linking?.trustedProviders) && linking.trustedProviders.includes("google"),
    JSON.stringify(linking?.trustedProviders)
  );

  // The nested form that silently does nothing, asserted absent so this exact
  // mistake cannot be reintroduced.
  const nested = (opts.socialProviders?.google as { accountLinking?: unknown } | undefined)?.accountLinking;
  check("no misplaced nested accountLinking", nested === undefined, String(nested));

  console.log("");
  if (failures) {
    console.log(`  ${failures} LINKING CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  GOOGLE ACCOUNT-LINKING CHECKS PASSED\n");
}

main();
