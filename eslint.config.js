import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import storybookPlugin from 'eslint-plugin-storybook';

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
        project: ['./tsconfig.json', './packages/*/tsconfig.json', './packages/examples/*/tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      // Temporarily disable strict type checking for browser/chrome APIs
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
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
  // Storybook configuration
  ...storybookPlugin.configs['flat/recommended'],
);