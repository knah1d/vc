import * as Sentry from '@sentry/react-native';

// EXPO_PUBLIC_SENTRY_DSN is safe to expose client-side — a DSN is a write-only
// endpoint identifier, not a secret (see https://docs.sentry.io/product/security/api-keys/).
// No-ops if unset, so local dev without a Sentry project still runs fine.
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn('EXPO_PUBLIC_SENTRY_DSN not set — crash reporting is disabled.');
    return;
  }
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
