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
