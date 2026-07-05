import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const mobileCaptureRoot = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(mobileCaptureRoot, 'package.json'));

const pkgPath = require.resolve('@react-native/gradle-plugin/package.json', {
  paths: [mobileCaptureRoot],
});
const settingsFile = path.join(path.dirname(pkgPath), 'settings.gradle.kts');
const content = fs.readFileSync(settingsFile, 'utf8');
const patched = content.replace(
  'org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")',
  'org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")',
);

if (patched === content) {
  if (content.includes('foojay-resolver-convention").version("1.0.0")')) {
    process.exit(0);
  }
  console.warn(
    'Could not patch @react-native/gradle-plugin settings.gradle.kts (unexpected format).',
  );
  process.exit(0);
}

fs.writeFileSync(settingsFile, patched);
console.log('Patched @react-native/gradle-plugin: foojay-resolver-convention 0.5.0 → 1.0.0');
