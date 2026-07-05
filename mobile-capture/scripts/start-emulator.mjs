import {
  buildAndroidEnv,
  printAndroidSdkSetupHelp,
  resolveAndroidSdkRoot,
} from './resolve-android-sdk.mjs';
import { ensureAndroidDevice } from './ensure-android-emulator.mjs';

const sdkRoot = resolveAndroidSdkRoot();
if (!sdkRoot) {
  printAndroidSdkSetupHelp();
  process.exit(1);
}

console.log(`Using Android SDK: ${sdkRoot}`);

try {
  await ensureAndroidDevice(sdkRoot);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
