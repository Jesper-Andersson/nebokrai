// The visitor's saved words, in the browser.
//
// Signed out, the list lives only in this browser's localStorage. Signed in,
// the account holds the list and localStorage is a copy of it: a change is
// shown at once, sent to the server, and undone if the server refuses.
//
// Which words have been exported (the Saved page's Export menu) is remembered
// beside the list and travels the same way: in this browser while signed out,
// in the account when signed in. A mark outlives its word being removed,
// because the card made from it is still in the visitor's flashcard app if
// the word is saved again.
//
// One object per page, shared through Svelte context like the settings (a
// module variable would be shared between visitors on the server).
import { getContext, setContext } from 'svelte';
import { MAX_SAVED, type ExportedMarks, type SavedWord } from './saved.ts';

const LIST_KEY = 'saved';
/** The id of the account the stored list is a copy of. Absent while signed out. */
const OWNER_KEY = 'saved-owner';
/** When each word was last exported: `{ "книга": 1794400000000 }`. */
const EXPORTED_KEY = 'saved-exported';

function readList(): SavedWord[] {
	try {
		const list: unknown = JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]');
		if (!Array.isArray(list)) return [];
		return list.filter((i) => typeof i?.word === 'string' && typeof i?.saved_at === 'number');
	} catch {
		return []; // storage blocked, or not JSON
	}
}

function readExported(): Map<string, number> {
	try {
		const marks: unknown = JSON.parse(localStorage.getItem(EXPORTED_KEY) ?? '{}');
		if (!marks || typeof marks !== 'object' || Array.isArray(marks)) return new Map();
		return new Map(Object.entries(marks).filter((mark): mark is [string, number] => typeof mark[1] === 'number'));
	} catch {
		return new Map(); // storage blocked, or not JSON
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
	#exported = $state.raw(new Map<string, number>());
	#userId: string | null;

	constructor(userId: string | null) {
		this.#userId = userId;
		this.signedIn = userId !== null;
	}

	has(word: string): boolean {
		return this.#words.has(word);
	}

	/** When the word was last exported from this browser (milliseconds), if it ever was. */
	exportedAt(word: string): number | undefined {
		return this.#exported.get(word);
	}

	/** Remember that these words have just been exported. */
	async markExported(words: string[]): Promise<void> {
		const now = Date.now();
		this.#setExported(new Map([...this.#exported, ...words.map((w) => [w, now] as const)]));
		if (!this.#userId) return;
		// Not undone if this fails: the file has been downloaded either way. The
		// marks then last until the next page load, which shows the account's.
		await fetch('/api/saved/exported', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ words })
		}).catch(() => null);
	}

	#setExported(marks: Map<string, number>): void {
		this.#exported = marks;
		store(EXPORTED_KEY, JSON.stringify(Object.fromEntries(marks)));
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
			if (event.key === EXPORTED_KEY) this.#exported = readExported();
		});

		const local = readList();
		let owner: string | null = null;
		try {
			owner = localStorage.getItem(OWNER_KEY);
		} catch {
			// storage blocked
		}
		// The marks go with the list: after signing out, or signing in to another
		// account, they are someone else's.
		const localMarks = owner && owner !== this.#userId ? new Map<string, number>() : readExported();
		this.#setExported(localMarks);

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
			// the account, with their exported marks. (A copy of some other
			// account is not sent anywhere.)
			const res = mine
				? await fetch('/api/saved')
				: await fetch('/api/saved/merge', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							words: owner ? [] : local,
							exported: owner ? {} : Object.fromEntries(localMarks)
						})
					});
			if (!res.ok) throw new Error(String(res.status));
			const account: { words: SavedWord[]; exported?: ExportedMarks } = await res.json();
			this.#set(account.words);
			this.#setExported(new Map(Object.entries(account.exported ?? {})));
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
