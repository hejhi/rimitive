import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

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
      // Devtools extension specific ignores
      'packages/devtools-extension/.output/**',
      'packages/devtools-extension/.wxt/**',
      'packages/devtools-extension/public/**',
      'packages/devtools-extension/demo/**',
      // Standalone benchmark frameworks without tsconfig
      'packages/benchmarks/frameworks/**',
    ],
  },
  // Base JS/TS configuration
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // TypeScript type-checked rules only for TS files
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  // Test files and utilities don't need explicit return types
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/test-setup.ts',
      '**/test-utils.ts',
      '**/test-helpers.ts',
      '**/__tests__/**',
    ],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
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
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
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
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
    },
  },
  // Config files at package roots (not in tsconfig includes)
  {
    files: ['**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  // WXT devtools-extension specific overrides
  {
    files: [
      'packages/devtools-extension/**/*.ts',
      'packages/devtools-extension/**/*.tsx',
    ],
    languageOptions: {
      globals: {
        defineBackground: 'readonly',
        defineContentScript: 'readonly',
        browser: 'readonly',
        chrome: 'readonly',
      },
    },
  },
  // Disable type checking for WXT entry files in CI
  {
    files: [
      'packages/devtools-extension/entrypoints/background.ts',
      'packages/devtools-extension/entrypoints/content.content.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  // Test files don't need explicit return types
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  }
);
