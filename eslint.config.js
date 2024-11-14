// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dusa.mjs',
      'dist/',
      'lib/',
      'docs/dist/',
      'docs/src/env.d.ts',
      'docs/.astro/types.d.ts',
    ],
  },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);

/*

module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs', 'env.d.ts'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh'],
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  };
  
  */
