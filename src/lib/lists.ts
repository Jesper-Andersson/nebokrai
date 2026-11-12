// Lists of saved words: the rules the browser and the server share, as plain
// functions on plain values so `npm test` can run them. Who stores the lists is
// elsewhere: saved.svelte.ts in the browser, server/users.ts for an account.
import { MAX_LISTS, MAX_LIST_NAME, MAX_SAVED, MAX_WORD_LENGTH, type WordList } from './saved.ts';

/**
 * What a list id looks like. The browser makes it (a UUID), so the server
 * checks the shape before storing one; shorter ids are allowed for tests.
 */
export const LIST_ID = /^[A-Za-z0-9_-]{8,36}$/;

export function newListId(): string {
	return crypto.randomUUID();
}

/** The Saved page with one list in view. */
export function listPath(id: string): string {
	return `/saved?list=${encodeURIComponent(id)}`;
}

/**
 * A list name as it is stored, or null if nothing usable is left: composed
 * letters (й as one character, so the same name typed on two keyboards is the
 * same name), single spaces, no space at either end.
 */
export function cleanListName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
	return name && name.length <= MAX_LIST_NAME ? name : null;
}

/** «Їжа» and «їжа» are one name. Folded here, not in SQL: SQLite's lower() knows only ASCII. */
function nameKey(name: string): string {
	return name.toLowerCase();
}

/** Whether a list other than `exceptId` already has this name. */
export function nameTaken(lists: WordList[], name: string, exceptId?: string): boolean {
	const key = nameKey(name);
	return lists.some((l) => l.id !== exceptId && nameKey(l.name) === key);
}

/** Read lists from localStorage or from a browser's request, dropping anything malformed. */
export function parseLists(value: unknown, now = Date.now()): WordList[] {
	if (!Array.isArray(value)) return [];
	const ids = new Set<string>();
	const lists: WordList[] = [];
	for (const item of value) {
		if (lists.length >= MAX_LISTS) break;
		const id: unknown = item?.id;
		const name = cleanListName(item?.name);
		if (typeof id !== 'string' || !LIST_ID.test(id) || ids.has(id) || name === null) continue;
		ids.add(id);
		const at: unknown = item.created_at;
		const words = new Set<string>();
		for (const word of Array.isArray(item.words) ? item.words.slice(0, MAX_SAVED) : []) {
			if (typeof word === 'string' && word && word.length <= MAX_WORD_LENGTH) words.add(word);
		}
		lists.push({
			id, name,
			created_at: typeof at === 'number' && Number.isInteger(at) && at > 0 && at <= now ? at : now,
			words: [...words]
		});
	}
	return lists;
}

/**
 * How a browser's lists join an account's, at the first sign-in:
 * - a list the account already has (same id) gains the browser's words and
 *   keeps the account's name;
 * - a list whose name the account already uses folds into that list, so
 *   «Їжа» made on a phone and «Їжа» made on a laptop become one;
 * - any other list is created, until the account has `max`; after that the
 *   list is dropped and its words simply stay saved.
 * `pairs` are [list id, word], with folded lists already pointing at the list
 * they fold into. Whether each word is saved is for the caller to check.
 */
export function planListMerge(
	account: WordList[], sent: WordList[], max = MAX_LISTS
): { create: Omit<WordList, 'words'>[]; pairs: [listId: string, word: string][] } {
	const ids = new Set(account.map((l) => l.id));
	const byName = new Map(account.map((l) => [nameKey(l.name), l.id]));
	const create: Omit<WordList, 'words'>[] = [];
	const pairs: [string, string][] = [];
	for (const list of sent) {
		let target = ids.has(list.id) ? list.id : byName.get(nameKey(list.name));
		if (target === undefined) {
			if (ids.size >= max) continue;
			create.push({ id: list.id, name: list.name, created_at: list.created_at });
			ids.add(list.id);
			byName.set(nameKey(list.name), list.id);
			target = list.id;
		}
		for (const word of list.words) pairs.push([target, word]);
	}
	return { create, pairs };
}

// The changes the browser makes to its own copy. Each returns new lists and
// leaves the old ones alone, as the store's $state.raw needs.

export function withList(lists: WordList[], list: WordList): WordList[] {
	return [...lists.filter((l) => l.id !== list.id), list].sort((a, b) => a.created_at - b.created_at);
}

export function withoutList(lists: WordList[], id: string): WordList[] {
	return lists.filter((l) => l.id !== id);
}

export function renamed(lists: WordList[], id: string, name: string): WordList[] {
	return lists.map((l) => (l.id === id ? { ...l, name } : l));
}

/** Put words into one list; words already there stay once. */
export function withWords(lists: WordList[], id: string, words: string[]): WordList[] {
	return lists.map((l) => (l.id === id ? { ...l, words: [...new Set([...l.words, ...words])] } : l));
}

/** Take words out of one list, or with `id` null out of every list (the word is no longer saved). */
export function withoutWords(lists: WordList[], id: string | null, words: string[]): WordList[] {
	const gone = new Set(words);
	return lists.map((l) =>
		(id === null || l.id === id) && l.words.some((w) => gone.has(w))
			? { ...l, words: l.words.filter((w) => !gone.has(w)) }
			: l);
}

/** Drop words that are no longer saved: a list holds saved words only. */
export function pruneLists(lists: WordList[], saved: Set<string>): WordList[] {
	return lists.map((l) =>
		l.words.every((w) => saved.has(w)) ? l : { ...l, words: l.words.filter((w) => saved.has(w)) });
}
