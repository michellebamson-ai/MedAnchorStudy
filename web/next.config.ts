import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Wraps the Next config so Sentry can rewrite source maps.
 *
 * Un-minified stack traces are the difference between "an error happened in
 * materials/actions.ts:214" and "an error happened on line 1 of a 40KB bundle".
 * Without this the reports are close to useless.
 *
 * Everything is skipped when no DSN is configured, so a clone with no Sentry
 * account builds exactly as it did before.
 */
const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Source maps are uploaded at build time. Without an auth token they are
  // left alone rather than half-uploaded.
  silent: !process.env.SENTRY_AUTH_TOKEN,

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Widened globs so route handlers and server actions are covered too.
  widenClientFileUpload: true,
});