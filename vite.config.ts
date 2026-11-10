import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { withPwa } from '@vite-pwa/sveltekit';
import type { Plugin } from 'vite';

const isolationHeaders = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp'
};

// SvelteKits Preview-Server ignoriert `preview.headers` → eigene Middleware,
// damit lokal dieselben Isolations-Header gelten wie auf Cloudflare.
const crossOriginIsolation: Plugin = {
	name: 'cross-origin-isolation',
	configureServer(server) {
		server.middlewares.use((_req, res, next) => {
			for (const [k, v] of Object.entries(isolationHeaders)) res.setHeader(k, v);
			next();
		});
	},
	configurePreviewServer(server) {
		server.middlewares.use((_req, res, next) => {
			for (const [k, v] of Object.entries(isolationHeaders)) res.setHeader(k, v);
			next();
		});
	}
};

export default defineConfig({
	plugins: [
		crossOriginIsolation,
		withPwa(
			{
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter({ fallback: '404.html' })
			},
			{
				registerType: 'autoUpdate',
				strategies: 'generateSW',
				injectRegister: false,
				kit: { adapterFallback: '404.html', trailingSlash: 'never' },
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				manifest: {
					name: 'Rookie – Chess Trainer',
					short_name: 'Rookie',
					description: 'Free chess trainer: play, puzzles, openings and endgames.',
					lang: 'en',
					start_url: '/',
					scope: '/',
					display: 'standalone',
					orientation: 'any',
					background_color: '#f6f3ee',
					theme_color: '#e2583e',
					categories: ['games', 'education'],
					icons: [
						{ src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
						{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
						{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
						{
							src: '/maskable-icon-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				generateSW: {
					// App-Shell, Schrift und Engine vorab speichern → startet komplett offline
					globPatterns: ['**/*.{woff2,wasm}', '**/openings.json'],
					globIgnores: ['**/*vietnamese*', '**/sw.js', '**/workbox-*.js'],
					navigateFallback: '/',
					cleanupOutdatedCaches: true,
					// Puzzle-Pakete erst bei Bedarf speichern (ab Phase 1)
					runtimeCaching: [
						{
							urlPattern: ({ url }) =>
								url.pathname.startsWith('/puzzles/') && url.pathname.endsWith('.json'),
							handler: 'CacheFirst',
							options: {
								cacheName: 'puzzle-packs',
								expiration: { maxEntries: 400 }
							}
						}
					]
				},
				devOptions: { enabled: false }
			}
		)
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
