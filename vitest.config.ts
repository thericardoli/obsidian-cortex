import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		globals: true,
	},
	resolve: {
		alias: {
			'@src': resolve(__dirname, 'src'),
			'@tests': resolve(__dirname, 'tests'),
		},
	},
});
