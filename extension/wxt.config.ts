import { defineConfig } from 'wxt';

// One code base, two builds: Manifest V3 for Chrome and WXT's default for
// Firefox. The only site the extension talks to is nebokrai.app, and only
// from the background script, so the site needs no CORS headers.
export default defineConfig({
	modules: ['@wxt-dev/module-svelte'],
	// The site's own modules import each other as `#lib/…`
	alias: { '#lib': '../src/lib' },
	manifest: {
		name: 'Nebokrai: Ukrainian pop-up dictionary',
		description: 'Double-click a Ukrainian word on any page to see what it is and what it means.',
		homepage_url: 'https://nebokrai.app',
		// Only for the reader's own choices on the options page
		permissions: ['storage'],
		// A build for a dev server (WXT_API_BASE=http://localhost:5173) may ask that server too
		host_permissions: ['https://nebokrai.app/*', ...(process.env.WXT_API_BASE ? [process.env.WXT_API_BASE + '/*'] : [])],
		browser_specific_settings: { gecko: { id: 'extension@nebokrai.app' } }
	}
});
