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
  {
    // Legacy battle playback code predates the React Compiler lint rules.
    // TODO(stream 1-engine): fix these files and remove this override.
    files: ['src/widgets/battle-arena/**'],
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
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
  ]),
]);

export default eslintConfig;
