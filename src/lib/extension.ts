// Where the browser extension (extension/) can be had, and who to tell.
//
// Nothing about the extension shows on the site until a store has it: the
// /extension page, its link in the footer, its entry on About and the hint
// in the card over a word of an example sentence all ask `EXTENSION_LIVE`.
// To switch them on, put the listing's address in `url` below. A store with
// no address is left out, so one store can go first.
//
// No SvelteKit imports, so tests/extension.test.ts runs it as it is.

export type Browser = 'chrome' | 'firefox' | 'edge';

export interface Store {
	browser: Browser;
	/** As the button says it: "Add to Chrome" */
	name: string;
	/** The listing's address; empty until the store has published it. */
	url: string;
}

export const STORES: Store[] = [
	{ browser: 'chrome', name: 'Chrome', url: 'https://chromewebstore.google.com/detail/nebokrai-ukrainian-pop-up/lejebpdfdmifdnmemdnmjajemibffmgm' },
	{ browser: 'firefox', name: 'Firefox', url: '' },
	{ browser: 'edge', name: 'Edge', url: '' }
];

// `npm run dev` shows everything, with the buttons drawn as not there yet, so
// the pages can be worked on before a listing exists. Vite puts `false` here
// when it builds the site; under `node --test` there is no `env` at all.
const DEV = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export const EXTENSION_LIVE = DEV || STORES.some((store) => store.url);

/** The stores to offer: those that have it, or all of them in `npm run dev`. */
export const offered = (): Store[] => (DEV ? STORES : STORES.filter((store) => store.url));

/**
 * Which store a browser installs from, or null for one that takes none of
 * these: a phone, Safari. Brave, Opera and Vivaldi say Chrome and install
 * from its store. Edge says Chrome too, so it is asked first.
 */
export function browserOf(userAgent: string): Browser | null {
	if (/Mobi|Android|iPhone|iPad/i.test(userAgent)) return null;
	if (/\bEdg\//.test(userAgent)) return 'edge';
	if (/\bFirefox\//.test(userAgent)) return 'firefox';
	if (/\bChrome\//.test(userAgent)) return 'chrome';
	return null;
}

/** The extension puts this on <html> of the site's pages, so the site need not offer it to someone who has it. */
export const INSTALLED_ATTRIBUTE = 'data-nebokrai-extension';

/** localStorage: "off" once the visitor has followed the hint in the card, or hidden it. */
const HINT_KEY = 'extension-hint';

/** Whether to offer the extension in the card: only in the browser, to a visitor it could be of use to. */
export function wantsHint(): boolean {
	if (!EXTENSION_LIVE || typeof document === 'undefined') return false;
	if (document.documentElement.hasAttribute(INSTALLED_ATTRIBUTE)) return false;
	const browser = browserOf(navigator.userAgent);
	if (!browser || !offered().some((store) => store.browser === browser)) return false;
	try {
		return localStorage.getItem(HINT_KEY) !== 'off';
	} catch {
		// Storage switched off: the hint could never be put away, so it is not shown
		return false;
	}
}

/** The visitor followed the hint or hid it: it does not come back. */
export function dropHint(): void {
	try {
		localStorage.setItem(HINT_KEY, 'off');
	} catch {
		// Nothing to remember it in
	}
}
