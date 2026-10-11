import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry initialisation.
 *
 * Only loaded in the browser, and only when a DSN is configured. No DSN means
 * no network calls and no overhead.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
});