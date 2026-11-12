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
// The lists the words are sorted into (lists.ts has the rules) travel the same
// way again. A list holds saved words only, so removing a word takes it out of
// its lists.
//
// One object per page, shared through Svelte context like the settings (a
// module variable would be shared between visitors on the server).
import { getContext, setContext } from 'svelte';
import {
	cleanListName, nameTaken, newListId, parseLists, pruneLists, renamed, withList, withWords, withoutList, withoutWords
} from './lists.ts';
import { MAX_LISTS, MAX_SAVED, type ExportedMarks, type SavedWord, type WordList } from './saved.ts';

const LIST_KEY = 'saved';
/** The id of the account the stored list is a copy of. Absent while signed out. */
const OWNER_KEY = 'saved-owner';
/** When each word was last exported: `{ "книга": 1794400000000 }`. */
const EXPORTED_KEY = 'saved-exported';
/** The lists, each with its words: `WordList[]`, oldest first. */
const LISTS_KEY = 'saved-lists';

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

function readLists(): WordList[] {
	try {
		return parseLists(JSON.parse(localStorage.getItem(LISTS_KEY) ?? '[]'));
	} catch {
		return []; // storage blocked, or not JSON
	}
}

/**
 * The ids of the lists a newly saved word goes into without asking; absent
 * while the bookmark still asks. A habit of this browser, like the Anki
 * settings, so the account does not hold it.
 */
const DEFAULT_KEY = 'saved-default-lists';

function readDefault(): string[] | null {
	try {
		const ids: unknown = JSON.parse(localStorage.getItem(DEFAULT_KEY) ?? 'null');
		return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : null;
	} catch {
		return null; // storage blocked, or not JSON
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
	/** The lists the words are sorted into, oldest first. */
	lists = $state.raw<WordList[]>([]);
	/**
	 * Where a newly saved word goes without asking: the ids of some lists, or
	 * none of them for "in no list". Null while the bookmark asks each time.
	 */
	defaultLists = $state.raw<string[] | null>(null);
	/** False until the browser's list has been read. */
	ready = $state(false);
	readonly signedIn: boolean;

	#words = $derived(new Set(this.items.map((i) => i.word)));
	#exported = $state.raw(new Map<string, number>());
	#listsByWord = $derived.by(() => {
		const byWord = new Map<string, WordList[]>();
		for (const list of this.lists) {
			for (const word of list.words) {
				const lists = byWord.get(word);
				if (lists) lists.push(list);
				else byWord.set(word, [list]);
			}
		}
		return byWord;
	});
	#userId: string | null;
	/** The last change sent to the account; the next one waits for it. */
	#queue: Promise<unknown> = Promise.resolve();

	constructor(userId: string | null) {
		this.#userId = userId;
		this.signedIn = userId !== null;
	}

	has(word: string): boolean {
		return this.#words.has(word);
	}

	/** The lists this word is in, oldest first. */
	listsOf(word: string): WordList[] {
		return this.#listsByWord.get(word) ?? [];
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

	#setLists(lists: WordList[]): void {
		this.lists = lists;
		store(LISTS_KEY, JSON.stringify(lists));
	}

	/** Choose where newly saved words go without asking, or null to be asked each time. */
	setDefaultLists(ids: string[] | null): void {
		this.defaultLists = ids;
		store(DEFAULT_KEY, ids === null ? null : JSON.stringify(ids));
	}

	/**
	 * Send a change to the account and say whether it was accepted. Signed
	 * out there is no one to tell, so the answer is yes.
	 *
	 * Changes go one at a time, in the order they were made. A word is often
	 * saved and put in a list within a second, and the server skips a word
	 * that is not saved yet: sent side by side, the second request could
	 * arrive first and be lost while this browser showed it as done.
	 */
	#send(method: 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown): Promise<boolean> {
		if (!this.#userId) return Promise.resolve(true);
		const sent = this.#queue.then(async () => {
			try {
				const res = await fetch(url, body === undefined
					? { method }
					: { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
				return res.ok;
			} catch {
				return false; // offline
			}
		});
		this.#queue = sent;
		return sent;
	}

	/** Browser only, once per page load: read the stored list and bring it in line with the account. */
	async load(): Promise<void> {
		// Another tab saved or removed a word, or changed a list. Without the
		// lists here, this tab's next change would write its old copy over them.
		addEventListener('storage', (event) => {
			if (event.key === LIST_KEY) this.items = readList();
			if (event.key === LISTS_KEY) this.lists = readLists();
			if (event.key === EXPORTED_KEY) this.#exported = readExported();
			if (event.key === DEFAULT_KEY) this.defaultLists = readDefault();
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
		// So do the lists. Words that are no longer saved are dropped from them:
		// a tab still running the site as it was before lists removes a word
		// without knowing it is in one.
		const localLists = owner && owner !== this.#userId
			? []
			: pruneLists(readLists(), new Set(local.map((i) => i.word)));
		// And the choice of where new words go, which names those lists.
		if (owner && owner !== this.#userId) this.setDefaultLists(null);
		else this.defaultLists = readDefault();

		if (!this.#userId) {
			// Just signed out: the list was a copy of the account, and the next
			// person at this browser must not inherit it.
			if (owner) {
				store(OWNER_KEY, null);
				this.#set([]);
				this.#setLists([]);
			} else {
				this.items = local;
				this.lists = localLists;
			}
			this.ready = true;
			return;
		}

		const mine = owner === this.#userId;
		if (mine) {
			// show the copy while the account answers
			this.items = local;
			this.lists = localLists;
		}
		this.ready = mine;
		try {
			// First load after signing in: words saved here while signed out join
			// the account, with their lists and exported marks. (A copy of some
			// other account is not sent anywhere.)
			const res = mine
				? await fetch('/api/saved')
				: await fetch('/api/saved/merge', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							words: owner ? [] : local,
							exported: owner ? {} : Object.fromEntries(localMarks),
							lists: owner ? [] : localLists
						})
					});
			if (!res.ok) throw new Error(String(res.status));
			const account: { words: SavedWord[]; exported?: ExportedMarks; lists?: unknown } = await res.json();
			this.#set(account.words);
			this.#setExported(new Map(Object.entries(account.exported ?? {})));
			// No lists in the answer: during a deploy this page can meet the
			// server as it was before lists. This browser's lists are then kept,
			// and without the owner mark the next page load merges them again.
			const answered = Array.isArray(account.lists);
			if (answered) this.#setLists(parseLists(account.lists));
			else if (!mine) this.lists = localLists;
			if (mine || answered) store(OWNER_KEY, this.#userId);
		} catch {
			// Offline or the server failed: keep what this browser has. Without
			// the owner mark, the next page load tries the merge again.
			if (!mine && !owner) {
				this.items = local;
				this.lists = localLists;
			}
		}
		this.ready = true;
	}

	/** Save the word, or remove it if it is saved. */
	toggle(word: string): Promise<void> {
		return this.has(word) ? this.remove(word) : this.save(word);
	}

	/** Save the word, and put it in these lists: what Undo gives back to a word that was removed. */
	async save(word: string, listIds: string[] = []): Promise<void> {
		if (this.has(word) || this.items.length >= MAX_SAVED) return;
		this.#set([{ word, saved_at: Date.now() }, ...this.items]);
		const ids = listIds.filter((id) => this.lists.some((l) => l.id === id));
		if (ids.length) this.#setLists(ids.reduce((lists, id) => withWords(lists, id, [word]), this.lists));
		const url = `/api/saved/${encodeURIComponent(word)}`;
		if (await this.#send('PUT', url, ids.length ? { lists: ids } : undefined)) return;
		// Undo only this word: other words may have changed in the meantime.
		this.#set(this.items.filter((i) => i.word !== word));
		this.#setLists(withoutWords(this.lists, null, [word]));
	}

	/** Remove the word, which also takes it out of its lists. */
	async remove(word: string): Promise<void> {
		const before = this.items.find((i) => i.word === word);
		if (!before) return;
		const ids = this.listsOf(word).map((l) => l.id);
		this.#set(this.items.filter((i) => i.word !== word));
		this.#setLists(withoutWords(this.lists, null, [word]));
		if (await this.#send('DELETE', `/api/saved/${encodeURIComponent(word)}`)) return;
		// Undo only this word, as above. A list deleted in the meantime stays deleted.
		if (!this.has(word)) this.#set([...this.items, before].sort((a, b) => b.saved_at - a.saved_at));
		this.#setLists(ids.reduce((lists, id) => withWords(lists, id, [word]), this.lists));
	}

	/**
	 * Make a list, with these saved words in it. Returns the list, or why
	 * there is none: the name is empty or too long, another list has it, or
	 * there are MAX_LISTS already.
	 */
	createList(rawName: string, words: string[] = []): WordList | 'invalid' | 'taken' | 'full' {
		const name = cleanListName(rawName);
		if (name === null) return 'invalid';
		if (nameTaken(this.lists, name)) return 'taken';
		if (this.lists.length >= MAX_LISTS) return 'full';
		const list: WordList = {
			id: newListId(), name, created_at: Date.now(), words: words.filter((w) => this.has(w))
		};
		this.#setLists(withList(this.lists, list));
		this.#sendList(list);
		return list;
	}

	/**
	 * Put back a list that deleteList() returned (Undo). False if its name
	 * has been taken since, or there is no room for it any more.
	 */
	restoreList(list: WordList): boolean {
		if (nameTaken(this.lists, list.name, list.id) || this.lists.length >= MAX_LISTS) return false;
		const restored = { ...list, words: list.words.filter((w) => this.has(w)) };
		this.#setLists(withList(this.lists, restored));
		this.#sendList(restored);
		return true;
	}

	/** Tell the account about a whole list; take it away again here if the account refuses it. */
	#sendList(list: WordList): void {
		const url = `/api/lists/${list.id}`;
		void this.#send('PUT', url, { name: list.name }).then((ok) => {
			if (!ok) this.#setLists(withoutList(this.lists, list.id));
		});
		if (!list.words.length) return;
		void this.#send('POST', `${url}/words`, { add: list.words }).then((ok) => {
			if (!ok) this.#setLists(withoutWords(this.lists, list.id, list.words));
		});
	}

	renameList(id: string, rawName: string): 'ok' | 'invalid' | 'taken' {
		const before = this.lists.find((l) => l.id === id);
		const name = cleanListName(rawName);
		if (!before || name === null) return 'invalid';
		if (nameTaken(this.lists, name, id)) return 'taken';
		if (name === before.name) return 'ok';
		this.#setLists(renamed(this.lists, id, name));
		void this.#send('PUT', `/api/lists/${id}`, { name }).then((ok) => {
			if (!ok) this.#setLists(renamed(this.lists, id, before.name));
		});
		return 'ok';
	}

	/** Delete a list; its words stay saved. Returns it as it was, for Undo. */
	deleteList(id: string): WordList | undefined {
		const before = this.lists.find((l) => l.id === id);
		if (!before) return undefined;
		this.#setLists(withoutList(this.lists, id));
		// New words were going here: with nowhere left to put them, ask again.
		if (this.defaultLists?.includes(id)) {
			const rest = this.defaultLists.filter((other) => other !== id);
			this.setDefaultLists(rest.length ? rest : null);
		}
		void this.#send('DELETE', `/api/lists/${id}`).then((ok) => {
			if (!ok && !nameTaken(this.lists, before.name)) this.#setLists(withList(this.lists, before));
		});
		return before;
	}

	/** Put saved words into a list (`on`), or take them out of it. */
	setInList(id: string, words: string[], on: boolean): void {
		const list = this.lists.find((l) => l.id === id);
		if (!list) return;
		const inList = new Set(list.words);
		const changed = words.filter((w) => this.has(w) && inList.has(w) !== on);
		if (!changed.length) return;
		this.#setLists((on ? withWords : withoutWords)(this.lists, id, changed));
		void this.#send('POST', `/api/lists/${id}/words`, on ? { add: changed } : { remove: changed }).then((ok) => {
			if (ok) return;
			// Undo only these words, and only those still saved.
			const back = on ? changed : changed.filter((w) => this.has(w));
			this.#setLists((on ? withoutWords : withWords)(this.lists, id, back));
		});
	}
}

const KEY = Symbol('saved');

export function provideSaved(userId: string | null): SavedWords {
	return setContext(KEY, new SavedWords(userId));
}

export function useSaved(): SavedWords {
	return getContext<SavedWords>(KEY);
}
