// The visitor's saved words, in the browser.
//
// Signed out, the list lives only in this browser's localStorage. Signed in,
// the account holds the list and localStorage is a copy of it: a change is
// shown at once, sent to the server, and undone if the server refuses.
//
// One object per page, shared through Svelte context like the settings (a
// module variable would be shared between visitors on the server).
import { getContext, setContext } from 'svelte';
import { MAX_SAVED, type SavedWord } from './saved.ts';

const LIST_KEY = 'saved';
/** The id of the account the stored list is a copy of. Absent while signed out. */
const OWNER_KEY = 'saved-owner';

function readList(): SavedWord[] {
	try {
		const list: unknown = JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]');
		if (!Array.isArray(list)) return [];
		return list.filter((i) => typeof i?.word === 'string' && typeof i?.saved_at === 'number');
	} catch {
		return []; // storage blocked, or not JSON
	}
}

function store(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Storage blocked or full: the list still works until the page is closed.
	}
}

export class SavedWords {
	/** Newest first. */
	items = $state.raw<SavedWord[]>([]);
	/** False until the browser's list has been read. */
	ready = $state(false);
	readonly signedIn: boolean;

	#words = $derived(new Set(this.items.map((i) => i.word)));
	#userId: string | null;

	constructor(userId: string | null) {
		this.#userId = userId;
		this.signedIn = userId !== null;
	}

	has(word: string): boolean {
		return this.#words.has(word);
	}

	#set(items: SavedWord[]): void {
		this.items = items;
		store(LIST_KEY, JSON.stringify(items));
	}

	/** Browser only, once per page load: read the stored list and bring it in line with the account. */
	async load(): Promise<void> {
		// Another tab saved or removed a word.
		addEventListener('storage', (event) => {
			if (event.key === LIST_KEY) this.items = readList();
		});

		const local = readList();
		let owner: string | null = null;
		try {
			owner = localStorage.getItem(OWNER_KEY);
		} catch {
			// storage blocked
		}

		if (!this.#userId) {
			// Just signed out: the list was a copy of the account, and the next
			// person at this browser must not inherit it.
			if (owner) {
				store(OWNER_KEY, null);
				this.#set([]);
			} else this.items = local;
			this.ready = true;
			return;
		}

		const mine = owner === this.#userId;
		if (mine) this.items = local; // show the copy while the account answers
		this.ready = mine;
		try {
			// First load after signing in: words saved here while signed out join
			// the account. (A copy of some other account is not sent anywhere.)
			const res = mine
				? await fetch('/api/saved')
				: await fetch('/api/saved/merge', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ words: owner ? [] : local })
					});
			if (!res.ok) throw new Error(String(res.status));
			this.#set((await res.json()).words);
			store(OWNER_KEY, this.#userId);
		} catch {
			// Offline or the server failed: keep what this browser has. Without
			// the owner mark, the next page load tries the merge again.
			if (!mine && !owner) this.items = local;
		}
		this.ready = true;
	}

	/** Save the word, or remove it if it is saved. */
	async toggle(word: string): Promise<void> {
		const before = this.items.find((i) => i.word === word);
		if (before) this.#set(this.items.filter((i) => i.word !== word));
		else if (this.items.length >= MAX_SAVED) return;
		else this.#set([{ word, saved_at: Date.now() }, ...this.items]);
		if (!this.#userId) return;

		try {
			const res = await fetch(`/api/saved/${encodeURIComponent(word)}`, { method: before ? 'DELETE' : 'PUT' });
			if (!res.ok) throw new Error(String(res.status));
		} catch {
			// Undo only this word: other words may have changed in the meantime.
			const rest = this.items.filter((i) => i.word !== word);
			this.#set(before ? [...rest, before].sort((a, b) => b.saved_at - a.saved_at) : rest);
		}
	}
}

const KEY = Symbol('saved');

export function provideSaved(userId: string | null): SavedWords {
	return setContext(KEY, new SavedWords(userId));
}

export function useSaved(): SavedWords {
	return getContext<SavedWords>(KEY);
}
