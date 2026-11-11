import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// What a page may load, and from where. If someone ever gets markup
			// into a page, the browser still refuses to run their script or send
			// data to their server. SvelteKit adds a fresh nonce for its own
			// inline script on every page. Styles allow 'unsafe-inline' because
			// src/app.html and Svelte's transitions use style attributes.
			// Adding Cloudflare Turnstile will need https://challenges.cloudflare.com
			// in script-src and in a new frame-src.
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'font-src': ['self'],
					// data: for small images Vite inlines; GitHub for the avatar on /about
					'img-src': ['self', 'data:', 'https://avatars.githubusercontent.com', 'https://github.com'],
					// Recordings of words, on Wikimedia Commons
					'media-src': ['https://upload.wikimedia.org'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			},

			// The site runs on Cloudflare Workers; wrangler.jsonc says how.
			adapter: adapter()
		})
	]
});
