import { spawnSync } from 'child_process';
import path from 'path';
import { ensureAndroidDevice } from './ensure-android-emulator.mjs';
import {
  buildAndroidEnv,
  ensureLocalProperties,
  printAndroidSdkSetupHelp,
  resolveAndroidSdkRoot,
} from './resolve-android-sdk.mjs';

const mobileCaptureRoot = path.resolve(import.meta.dirname, '..');
const sdkRoot = resolveAndroidSdkRoot();

if (!sdkRoot) {
  printAndroidSdkSetupHelp();
  process.exit(1);
}

ensureLocalProperties(sdkRoot);
console.log(`Using Android SDK: ${sdkRoot}`);

try {
  await ensureAndroidDevice(sdkRoot);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const result = spawnSync('npx', ['expo', 'run:android', ...process.argv.slice(2)], {
  cwd: mobileCaptureRoot,
  env: buildAndroidEnv(sdkRoot),
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
