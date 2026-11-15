import { defineConfig } from 'wxt';

// One code base, two builds: Manifest V3 for Chrome and Edge, and WXT's
// default for Firefox. The only site the extension talks to is nebokrai.app,
// and only from the background script, so the site needs no CORS headers.
// The icons in public/icon/ are drawn by `npm run app-icons` in the site.
const dev = process.env.WXT_API_BASE ? new URL(process.env.WXT_API_BASE) : null;
const devHost = dev && `${dev.protocol}//${dev.hostname}/*`;

export default defineConfig({
	modules: ['@wxt-dev/module-svelte'],
	// The site's own modules import each other as `#lib/…`
	alias: { '#lib': '../src/lib' },
	manifest: ({ browser }) => ({
		name: 'Nebokrai: Ukrainian pop-up dictionary',
		description: 'Double-click a Ukrainian word on any page to see what it is and what it means.',
		homepage_url: 'https://nebokrai.app',
		// Only for the reader's own choices on the options page
		permissions: ['storage'],
		// A build for a dev server (WXT_API_BASE=http://localhost:5173) may ask that
		// server too. Without the port: Firefox refuses a permission that names one.
		host_permissions: ['https://nebokrai.app/*', ...(devHost ? [devHost] : [])],
		...(browser === 'firefox' && {
			browser_specific_settings: {
				gecko: {
					id: 'extension@nebokrai.app',
					// What Firefox tells the reader at install, and asks every new
					// extension to state: the word looked up and the words either
					// side of it are text of the page, and go to nebokrai.app.
					// Firefox shows this itself from version 140, so that is the
					// oldest the extension installs on.
					strict_min_version: '140.0',
					data_collection_permissions: { required: ['websiteContent'] }
				}
			}
		})
	})
});
