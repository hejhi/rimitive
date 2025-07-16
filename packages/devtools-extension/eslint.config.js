import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import globals from 'globals';
import autoImports from './.wxt/eslint-auto-imports.mjs';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/*.d.ts.map',
      '**/coverage/**',
      '**/temp/**',
      '**/.turbo/**',
      '.output/**',
      '.wxt/**',
      'demo/**',
    ],
  },
  // Base JS/TS configuration
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // WXT auto-imports
  autoImports,
  // TypeScript type-checked rules only for TS files
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: 'readonly',
        browser: 'readonly',
      },
    },
  },
  // React-specific configuration
  {
    files: ['**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // JavaScript files configuration (no type checking)
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        browser: 'readonly',
      },
    },
  },
);