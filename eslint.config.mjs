import js from '@eslint/js';
import * as espree from 'espree';
import tsParser from '@typescript-eslint/parser';
import vitest from '@vitest/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

	export default [
		{
			ignores: [
				'dist/',
				'build/',
				'.svelte-kit/',
				'.vite/',
				'coverage/',
				'node_modules/',
				'main.js',
				'eslint.config.*',
				'esbuild.config.*',
				'version-bump.*',
			],
		},

	js.configs.recommended,
	...ts.configs.recommended,
	...ts.configs.recommendedTypeChecked,
	{
		files: ['**/*.{ts,tsx,mts,cts}'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-misused-promises': [
				'error',
				{ checksVoidReturn: { attributes: false } },
			],
		},
	},
	...svelte.configs.recommended,
	...svelte.configs.prettier,
	{
		files: ['**/*.svelte'],
		languageOptions: {
			globals: { ...globals.browser },
			parser: svelteParser,
			parserOptions: {
				// Ensure type-aware rules also run inside Svelte files
				parser: tsParser,
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte'],
			},
		},
		rules: {},
	},

	{
		// Node-flavored JS config files -> use espree
		files: [
			'**/*.{config,conf}.{js,mjs,cjs}',
			'esbuild.config.*',
			'eslint.config.*',
			'version-bump.*',
		],
		languageOptions: {
			parser: espree,
			globals: { ...globals.node },
		},
	},
	{
		// Node-flavored TS config files -> keep TS type-aware
		files: [
			'**/*.{config,conf}.{ts}',
			'vitest.config.*',
		],
		languageOptions: {
			globals: { ...globals.node },
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	{
		// Use espree for plain JS/MJS so TS typed rules don't apply
		files: ['**/*.{js,cjs,mjs}'],
		languageOptions: {
			parser: espree,
		},
	},

	{
		files: ['**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,cjs,mjs}', 'tests/**/*'],
		plugins: { vitest },
		rules: {
			...vitest.configs.recommended.rules,
		},
		languageOptions: {
			globals: {
				...vitest.environments.env.globals,
			},
		},
	},
	{
		rules: {
			'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
			'no-debugger': 'error',
		},
	},
	eslintConfigPrettier,
];
