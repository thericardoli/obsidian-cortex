// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // Base configuration
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],

  // Import sorting plugin
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports (e.g., import 'module')
            ['^\\u0000'],
            // External packages (node_modules)
            ['^@?\\w'],
            // Internal aliases ($lib, etc.)
            ['^\\$'],
            // Parent imports (../)
            ['^\\.\\.'],
            // Sibling imports (./)
            ['^\\./'],
            // Type imports
            ['^.+\\u0000$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  // Global ignores
  {
    ignores: [
      'main.js',
      '*.js.map',
      'node_modules/**',
      '.obsidian/**',
      'dist/**',
      'build/**',
      '*.mjs',
      'esbuild.config.mjs',
      'version-bump.mjs',
    ],
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-prototype-builtins': 'off',
    },
  },

  // Svelte files configuration
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'svelte/no-at-html-tags': 'off',
      'svelte/valid-compile': 'warn',
    },
  },
]);
