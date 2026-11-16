// The search a reader left for a word's page, kept for this tab so the word's
// "Back to search" can return to the same results (/?q=voda). The search page
// changes its address without a navigation (a shallow `goto`), so the address
// SvelteKit reports as the page left is the one it was opened with, not the
// one showing: the page itself has to say what it showed.
const KEY = 'last-search';

/** Called by the search page as it is left, with `location.search`. */
export function rememberSearch(search: string): void {
	try {
		sessionStorage.setItem(KEY, search);
	} catch {
		// No storage: the link goes to the empty search page, as it did before
	}
}

/** `?q=…` of the search last left in this tab, or an empty string. */
export function lastSearch(): string {
	try {
		const search = sessionStorage.getItem(KEY) ?? '';
		return search.startsWith('?q=') ? search : '';
	} catch {
		return '';
	}
}
