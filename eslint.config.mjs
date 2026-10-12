import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// BoardUI components are copied verbatim from the desktop client and carry
// disable comments for rules this config does not load; define them as no-ops
// there so the copies can stay identical.
const noop = { create: () => ({}) };
const boardUiRuleStubs = {
  'react-hooks': { rules: { 'exhaustive-deps': noop } },
  '@next/next': { rules: { 'no-img-element': noop } },
};

export default tseslint.config(
  { ignores: ['dist-client/**', 'dist-server/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/renderer/components/{application,base,foundations}/**/*.{ts,tsx}'],
    plugins: boardUiRuleStubs,
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['server/**/*.ts', 'scripts/**/*.mjs', '*.config.{ts,mts,js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
