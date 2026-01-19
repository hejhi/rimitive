import rootConfig from '../../eslint.config.js';

export default [
  ...rootConfig,
  // Endpoint package - no need for explicit return types
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];
