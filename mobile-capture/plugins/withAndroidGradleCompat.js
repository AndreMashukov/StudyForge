const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Pin Gradle 8.14.3 — Gradle 9 + foojay 0.5.0 breaks RN 0.83 until upstream bumps foojay. */
function withGradleWrapperCompat(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        'gradle/wrapper/gradle-wrapper.properties',
      );
      const content = fs.readFileSync(file, 'utf8');
      const next = content.replace(
        /distributionUrl=.*gradle-[\d.]+-bin\.zip/,
        'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip',
      );
      fs.writeFileSync(file, next);
      return config;
    },
  ]);
}

module.exports = function withAndroidGradleCompat(config) {
  return withGradleWrapperCompat(config);
};
