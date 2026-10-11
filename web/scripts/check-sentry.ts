/**
 * Sentry checks.
 *
 * The failure mode this guards against is silent: an SDK wired in with the
 * wrong options still typechecks, still builds, and quietly reports nothing,
 * so the student hears about the crash before the developer does. Every check
 * here asserts the wiring is actually capable of reporting.
 *
 *   npm run check:sentry
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function main() {
  console.log("\nSENTRY WIRING CHECKS\n");

  // ---- the SDK is installed and importable ----
  let sdkOk = true;
  let hasCapture = false;
  let hasCaptureRequestError = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require("@sentry/nextjs");
    hasCapture = typeof sentry.captureException === "function";
    hasCaptureRequestError = typeof sentry.captureRequestError === "function";
  } catch {
    sdkOk = false;
  }
  check("@sentry/nextjs is installed and importable", sdkOk);
  check("SDK exposes captureException", hasCapture);
  check("SDK exposes captureRequestError", hasCaptureRequestError);

  // ---- files exist where Next.js expects them ----
  for (const f of ["instrumentation.ts", "instrumentation-client.ts", "next.config.ts"]) {
    check(`${f} exists`, existsSync(join(root, f)));
  }

  // ---- server initialisation reads the DSN ----
  const inst = read("instrumentation.ts");
  check("server init reads SENTRY_DSN", inst.includes("SENTRY_DSN"));
  check("server init calls Sentry.init", /Sentry\.init\(/.test(inst));
  check("server reports environment", inst.includes("environment"));
  check("onRequestError is exported", /export const onRequestError/.test(inst));
  check(
    "onRequestError is the SDK handler, not a stub",
    inst.includes("Sentry.captureRequestError"),
    "a stub would compile and never report anything"
  );
  // Match the option itself, not the word in the comment explaining its removal.
  check("no personal data is sent", !/\bsendDefaultPii\s*:/.test(inst), "v11 does not send PII by default");

  // ---- browser initialisation ----
  const client = read("instrumentation-client.ts");
  check("browser init calls Sentry.init", /Sentry\.init\(/.test(client));
  check("browser init reads a DSN", client.includes("SENTRY_DSN"));

  // ---- build config uploads source maps ----
  const config = read("next.config.ts");
  check("next.config uses withSentryConfig", config.includes("withSentryConfig"));
  check("source-map upload is silent without a token", config.includes("SENTRY_AUTH_TOKEN"));
  check("no dead beforeSend left in the build config", !/beforeSend/.test(config));

  // ---- documented ----
  const example = read(".env.example");
  check("SENTRY_DSN documented in .env.example", example.includes("SENTRY_DSN"));
  check("source-map variables documented", example.includes("SENTRY_AUTH_TOKEN"));
  check("points at the secret helper, not a chat paste", example.includes("npm run secret"));

  // ---- honest about being off ----
  const dsn = (process.env.SENTRY_DSN ?? "").trim();
  if (dsn) {
    console.log("\n  SENTRY_DSN is set — errors will be reported.");
  } else {
    console.log("\n  SENTRY_DSN is not set, so Sentry stays dormant.");
    console.log("  This is expected and safe: the app makes no network calls to Sentry.");
    console.log("  To switch it on: npm run secret -- SENTRY_DSN");
  }

  console.log("");
  if (failures) {
    console.log(`  ${failures} SENTRY CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  SENTRY WIRING CHECKS PASSED\n");
}

main();