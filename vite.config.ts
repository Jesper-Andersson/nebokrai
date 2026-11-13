import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { editText } from './scripts/edit-text/plugin.ts';
import { RADIO_ORIGINS } from './src/lib/radio.ts';

export default defineConfig({
	plugins: [
		// Click a text on a page and change it, in `npm run dev` only
		// (scripts/edit-text/plugin.ts, src/lib/dev/TextEditor.svelte)
		editText(),
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
			// https://challenges.cloudflare.com is Cloudflare Turnstile, the bot
			// check of the report form: its script, and the frame the script draws
			// the check in. Nothing else may be framed.
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self', 'https://challenges.cloudflare.com'],
					'style-src': ['self', 'unsafe-inline'],
					'font-src': ['self'],
					// data: for small images Vite inlines; GitHub for the avatar on /about
					'img-src': ['self', 'data:', 'https://avatars.githubusercontent.com', 'https://github.com'],
					// The letters' recordings, the site's own (static/audio/letters);
					// recordings of words, on Wikimedia Commons; and the radio's
					// stations, each played from its own server (src/lib/radio.ts)
					'media-src': ['self', 'https://upload.wikimedia.org', ...RADIO_ORIGINS],
					// AnkiConnect on the visitor's own computer (src/lib/anki-connect.ts)
					'connect-src': ['self', 'http://127.0.0.1:8765'],
					'frame-src': ['https://challenges.cloudflare.com'],
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
