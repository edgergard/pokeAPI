import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Static export: next/image optimization is off (`images.unoptimized`), plain <img> is intended.
      '@next/next/no-img-element': 'off',
    },
  },
  // Turns off stylistic rules that conflict with Prettier. Keep it after other configs.
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    '.claude/skills/**',
    '.claude/worktrees/**',
  ]),
]);

export default eslintConfig;
