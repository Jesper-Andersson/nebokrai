// Whether the quick search (QuickSearch.svelte) is open, and what its box
// holds. The header's button and Ctrl+K open it empty; a word in an example
// sentence (Sentence.svelte) opens it with that word already typed. Shared
// through Svelte context like the settings: a module variable would be shared
// between visitors on the server.
import { getContext, setContext } from 'svelte';

export class QuickSearchState {
	open = $state(false);
	query = $state('');

	/** Open it with `query` in the box, as if the visitor had typed it. */
	openWith(query: string) {
		this.query = query;
		this.open = true;
	}
}

const KEY = Symbol('quick-search');

export function provideQuickSearch(): QuickSearchState {
	return setContext(KEY, new QuickSearchState());
}

export function useQuickSearch(): QuickSearchState {
	return getContext<QuickSearchState>(KEY);
}
