// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    rules: {
      // Reanimated shared values are mutated via `.value =` by design;
      // this rule (React Compiler) false-positives on every animation.
      'react-hooks/immutability': 'off',
    },
  },
]);
