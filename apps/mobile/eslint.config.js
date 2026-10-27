const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  { ignores: ['functions/**', '.tools/**', 'dist/**', 'coverage/**', 'node_modules.previous/**'] },
]);
