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
					// wasm-unsafe-eval lets the Import page compile sql.js, the SQLite that
					// reads an Anki deck in the browser. It allows WebAssembly only, not eval().
					'script-src': ['self', 'wasm-unsafe-eval', 'https://challenges.cloudflare.com'],
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

			// '*' turns SvelteKit's check on where a write comes from off. It
			// runs before the site's own (`mayWrite`, called in src/hooks.server.ts),
			// takes a list of exact origins only, and so refused the browser
			// extension's saves: every Firefox install has an origin of its own.
			// The site's check covers all that this one did, and JSON writes too.
			csrf: { trustedOrigins: ['*'] },

			// In `npm run dev` only: hold Alt+X and click anything on a page, and
			// the editor opens the component that drew it. SvelteKit hands this
			// option on to vite-plugin-svelte.
			inspector: true,

			// The site runs on Cloudflare Workers; wrangler.jsonc says how.
			adapter: adapter()
		})
	]
});
