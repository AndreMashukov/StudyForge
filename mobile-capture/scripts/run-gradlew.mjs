import { spawnSync } from 'child_process';
import path from 'path';
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

const gradleArgs = process.argv.slice(2);
if (gradleArgs.length === 0) {
  console.error('Usage: node scripts/run-gradlew.mjs <gradle-task> [...]');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const gradlew = path.join(mobileCaptureRoot, 'android', isWindows ? 'gradlew.bat' : 'gradlew');

const result = spawnSync(gradlew, gradleArgs, {
  cwd: path.join(mobileCaptureRoot, 'android'),
  env: buildAndroidEnv(sdkRoot),
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
