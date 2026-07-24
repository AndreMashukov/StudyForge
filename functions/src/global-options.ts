/**
 * Must run before any onCall/onRequest registrations.
 * Imported first from index.ts so esbuild emits it before endpoint modules.
 */
import { setGlobalOptions } from 'firebase-functions';

/** Included in the esbuild bundle so bumping it forces a Cloud Functions source hash change. */
export const FUNCTIONS_SOURCE_REVISION = '2026-07-24-selective-1';

const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

setGlobalOptions({
  maxInstances: 10,
  region: 'asia-east1',
  enforceAppCheck: !runningInFunctionsEmulator,
});
