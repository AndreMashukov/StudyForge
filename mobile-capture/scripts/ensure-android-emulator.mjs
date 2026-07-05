import { spawn, spawnSync } from 'child_process';
import {
  buildAndroidEnv,
  resolveAndroidSdkRoot,
} from './resolve-android-sdk.mjs';

const DEFAULT_AVD = 'StudyForgeCapture';
const BOOT_TIMEOUT_MS = 180_000;

function runAdb(args, sdkRoot) {
  const adb = `${sdkRoot}/platform-tools/adb`;
  return spawnSync(adb, args, {
    env: buildAndroidEnv(sdkRoot),
    encoding: 'utf8',
  });
}

function listConnectedDevices(sdkRoot) {
  const result = runAdb(['devices'], sdkRoot);
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('offline'))
    .map((line) => line.split('\t')[0])
    .filter(Boolean);
}

function isBootComplete(sdkRoot) {
  const result = runAdb(['shell', 'getprop', 'sys.boot_completed'], sdkRoot);
  return result.stdout.trim() === '1';
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function startEmulator(sdkRoot, avdName) {
  const emulatorBin = `${sdkRoot}/emulator/emulator`;
  console.log(`Starting Android emulator "${avdName}"…`);

  const child = spawn(
    emulatorBin,
    ['-avd', avdName, '-no-snapshot-save'],
    {
      env: buildAndroidEnv(sdkRoot),
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();
}

export async function ensureAndroidDevice(sdkRoot) {
  const avdName = process.env.STUDYFORGE_ANDROID_AVD ?? DEFAULT_AVD;
  let devices = listConnectedDevices(sdkRoot);

  if (devices.length === 0) {
    startEmulator(sdkRoot, avdName);
    const waitResult = runAdb(['wait-for-device'], sdkRoot);
    if (waitResult.status !== 0) {
      throw new Error('Timed out waiting for emulator to connect via adb.');
    }
  }

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    devices = listConnectedDevices(sdkRoot);
    if (devices.length > 0 && isBootComplete(sdkRoot)) {
      console.log(`Android device ready: ${devices[0]}`);
      return devices[0];
    }
    await sleep(2000);
  }

  throw new Error(
    'Emulator started but did not finish booting within 3 minutes. Retry once it is fully up.',
  );
}
