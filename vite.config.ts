import path from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [cloudflare()],
	publicDir: false,
	esbuild: {
		jsx: 'automatic',
		jsxImportSource: 'remix/component',
	},
	build: {
		target: 'es2022',
		outDir: 'public',
		emptyOutDir: false,
		rollupOptions: {
			input: path.resolve('client/entry.tsx'),
			output: {
				entryFileNames: 'client-entry.js',
				chunkFileNames: 'assets/[name].js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
})
