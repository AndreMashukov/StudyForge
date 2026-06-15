const path = require('path');
const fs = require('fs');

const workspaceRoot = path.resolve(__dirname, '..');
const rootNodeModules = path.join(workspaceRoot, 'node_modules');

/** Native modules installed at the workspace root (NX monorepo). */
const hoistedNativePackages = [
  '@react-native-async-storage/async-storage',
  'react-native-gesture-handler',
  'react-native-mmkv',
  'react-native-nitro-modules',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-worklets',
];

function resolvePackageRoot(packageName) {
  const directPath = path.join(rootNodeModules, packageName);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  try {
    return path.dirname(
      require.resolve(`${packageName}/package.json`, { paths: [workspaceRoot] })
    );
  } catch {
    return null;
  }
}

/** @type {import('@react-native-community/cli-types').Config} */
module.exports = {
  dependencies: Object.fromEntries(
    hoistedNativePackages
      .map((packageName) => [packageName, resolvePackageRoot(packageName)])
      .filter((entry) => entry[1] != null)
      .map(([packageName, root]) => [packageName, { root }])
  ),
};
