// ESLint (flat config) — Fehlerklassen, die im Browser still scheitern:
// undefinierte Namen, doppelte Schlüssel, unerreichbarer Code.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'data/**', 'dist/**', 'graphify-out/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'detail/**/*.js', 'service-worker.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker, Chart: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
