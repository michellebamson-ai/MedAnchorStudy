import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry initialisation.
 *
 * Does nothing at all unless SENTRY_DSN is set, so a developer can clone the
 * project and run it with no Sentry account and never touch the network.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Without this, every error would arrive with no way to tell which student
  // or which revision hit it.
  environment: process.env.NODE_ENV,

  // Sample rather than record everything: keeps the free quota usable and stops
  // noisy errors burying real ones.
  tracesSampleRate: 0.1,

  // Errors are worth all of them.
  sampleRate: 1.0,

  // v11 no longer sends personal data by default, so a student's email and
  // study content cannot end up in someone else's error report. The old
  // sendDefaultPii option was removed from the SDK for that reason.

  beforeSend(event) {
    // Expected, handled failures are noise. Dropping them keeps the free quota
    // readable instead of burying real faults under deployment artefacts.
    if (event.exception?.values?.[0]?.type === "ChunkLoadError") {
      return null;
    }
    return event;
  },
});

/**
 * Next.js 15+ reports uncaught errors here rather than through the older
 * instrumentation hook, so this is the one that actually catches route errors.
 */
export const onRequestError = Sentry.captureRequestError;