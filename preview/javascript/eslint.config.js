// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const IGNORED = ['dist/**', 'coverage/**', '**/*.gen.ts', 'public/vendor/**'];

/**
 * Flat config for the storefront.
 * FIXME: re-enable `no-explicit-any` after the payments SDK ships typings.
 */
export default tseslint.config(
  { ignores: IGNORED },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='fetch']", message: 'Use the api client.' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'max-depth': ['warn', 4],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'vitest.setup.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.js'],
    languageOptions: { globals: globals.node },
    ...tseslint.configs.disableTypeChecked,
  },
);
