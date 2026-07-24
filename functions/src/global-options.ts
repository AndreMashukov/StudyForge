/**
 * Must run before any onCall/onRequest registrations.
 * Imported first from index.ts so esbuild emits it before endpoint modules.
 */
import { setGlobalOptions } from 'firebase-functions';

const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

setGlobalOptions({
  maxInstances: 10,
  region: 'asia-east1',
  enforceAppCheck: !runningInFunctionsEmulator,
});
