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
    account?: { accountLinking?: { enabled?: boolean; trustedProviders?: string[]; requireLocalEmailVerified?: boolean; disableImplicitLinking?: boolean } };
    socialProviders?: Record<string, unknown>;
  };

  const linking = opts.account?.accountLinking;

  console.log(`  socialProviders: ${Object.keys(opts.socialProviders ?? {}).join(", ") || "(none)"}`);
  console.log(`  account.accountLinking: ${JSON.stringify(linking)}\n`);

  check("google provider registered", !!opts.socialProviders?.google);
  check("accountLinking block exists", !!linking);
  check("accountLinking.enabled is true", linking?.enabled === true, String(linking?.enabled));
  check("google is in trustedProviders", Array.isArray(linking?.trustedProviders) && linking.trustedProviders.includes("google"), JSON.stringify(linking?.trustedProviders));

  // The gate that actually blocked linking: with this left at its default of
  // true, any account whose local emailVerified is false is refused even when
  // the provider is trusted. See link-account.mjs.
  check(
    "requireLocalEmailVerified is false",
    linking?.requireLocalEmailVerified === false,
    String(linking?.requireLocalEmailVerified)
  );
  check(
    "disableImplicitLinking is not set",
    (linking as { disableImplicitLinking?: boolean } | undefined)?.disableImplicitLinking !== true
  );

  // Reproduce the real decision against this project's actual data shape.
  const { prisma } = await import("../src/lib/prisma");
  const unverified = await prisma.user.count({ where: { emailVerified: false } });
  const wouldBlock =
    (linking?.requireLocalEmailVerified ?? true) && unverified > 0;
  check(
    "no local account can be blocked by the local-verification gate",
    !wouldBlock,
    `${unverified} unverified accounts present`
  );
  await prisma.$disconnect();

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
