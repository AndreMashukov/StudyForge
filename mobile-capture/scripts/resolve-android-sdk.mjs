import fs from 'fs';
import os from 'os';
import path from 'path';

const mobileCaptureRoot = path.resolve(import.meta.dirname, '..');

function pathExists(candidate) {
  return typeof candidate === 'string' && candidate.length > 0 && fs.existsSync(candidate);
}

function isAndroidSdkRoot(candidate) {
  if (!pathExists(candidate)) {
    return false;
  }

  return (
    fs.existsSync(path.join(candidate, 'platform-tools', 'adb')) ||
    fs.existsSync(path.join(candidate, 'cmdline-tools')) ||
    fs.existsSync(path.join(candidate, 'build-tools'))
  );
}

export function resolveAndroidSdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    '/opt/homebrew/share/android-commandlinetools',
    '/usr/local/share/android-commandlinetools',
  ];

  for (const candidate of candidates) {
    if (isAndroidSdkRoot(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function ensureLocalProperties(sdkRoot) {
  const androidDir = path.join(mobileCaptureRoot, 'android');
  if (!fs.existsSync(androidDir)) {
    return;
  }

  const escaped = sdkRoot.replace(/\\/g, '\\\\');
  fs.writeFileSync(
    path.join(androidDir, 'local.properties'),
    `sdk.dir=${escaped}\n`,
  );
}

export function buildAndroidEnv(sdkRoot) {
  const platformTools = path.join(sdkRoot, 'platform-tools');
  const pathEntries = [platformTools, process.env.PATH].filter(Boolean);

  return {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    PATH: pathEntries.join(path.delimiter),
  };
}

export function printAndroidSdkSetupHelp() {
  console.error('Android SDK not found.');
  console.error('');
  console.error('Install one of:');
  console.error('  • Android Studio → SDK Manager (default: ~/Library/Android/sdk)');
  console.error('  • brew install --cask android-commandlinetools');
  console.error('');
  console.error('Then either export ANDROID_HOME or add to root .env.mobile:');
  console.error('  ANDROID_HOME=/path/to/android/sdk');
}
