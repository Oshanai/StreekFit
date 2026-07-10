/**
 * Expo config plugin: make the generated iOS project build from a path that
 * contains spaces (this repo lives in ".../streek fit").
 *
 * The Expo template's "Bundle React Native code and images" phase ends with a
 * bare backtick execution — the resolved path to react-native-xcode.sh is
 * word-split at the space and the build dies with
 * "bash: /Users/…/streek: No such file or directory".
 * We wrap that invocation in quotes: `…` → "$(…)".
 *
 * (The matching podspec-level fixes for expo-constants / expo-updates live in
 * patches/ via patch-package — podspecs are read from node_modules, not from
 * the generated project, so a config plugin can't reach them.)
 */

const { withXcodeProject } = require('expo/config-plugins');

const BACKTICK_LINE =
  '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`';
const QUOTED_LINE =
  '\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"';

module.exports = function withSpaceSafePaths(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (phase && typeof phase.shellScript === 'string' && phase.shellScript.includes(BACKTICK_LINE)) {
        phase.shellScript = phase.shellScript.replace(BACKTICK_LINE, QUOTED_LINE);
      }
    }
    return cfg;
  });
};
