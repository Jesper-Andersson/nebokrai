// Everything the extension asks nebokrai.app (docs/api.md in the site's
// repository). The requests are made here, not in the page: a page's own
// `fetch` would be a cross-origin one, which the site does not answer, while
// the background script may ask the one host named in the manifest.
import type { GlossAnswer } from '../../src/lib/gloss.ts';
import type { SavedWord, WordList } from '../../src/lib/saved.ts';
import {
	SITE,
	type GlossReply,
	type GlossRequest,
	type Request,
	type SavedReply,
	type SaveReply,
	type SaveRequest
} from '../lib/api.ts';

// The same word is often asked twice on one page. Kept in memory only: the
// browser stops an idle background script, and the list goes with it.
const KEPT = 300;
const answers = new Map<string, GlossAnswer>();

async function gloss(request: GlossRequest): Promise<GlossReply> {
	const params = new URLSearchParams({ w: request.w });
	if (request.before) params.set('before', request.before);
	if (request.after) params.set('after', request.after);
	const key = params.toString();

	const kept = answers.get(key);
	if (kept) return { ok: true, answer: kept };

	try {
		// No cookies: the answer is the same for everyone, and the site need not know who asks
		const response = await fetch(`${SITE}/api/gloss?${key}`, { credentials: 'omit' });
		if (!response.ok) return { ok: false };
		const answer: GlossAnswer = await response.json();
		answers.set(key, answer);
		// A Map keeps the order things went in, so the first key is the oldest
		if (answers.size > KEPT) answers.delete(answers.keys().next().value!);
		return { ok: true, answer };
	} catch {
		return { ok: false };
	}
}

// The account's saved words and lists, asked with the visitor's session on
// the site (the `session` cookie; the browser adds it because the manifest
// names the site). Kept for a minute, so a page of looked-up words is one
// request, and a word saved on the site itself shows here soon after.
const FRESH_MS = 60_000;
type Account = { words: Set<string>; lists: WordList[] } | 'signed_out';
let account: { at: number; is: Account } | undefined;

async function readAccount(): Promise<Account | undefined> {
	if (account && Date.now() - account.at < FRESH_MS) return account.is;
	try {
		const response = await fetch(`${SITE}/api/saved`, { credentials: 'include' });
		if (response.status === 401) account = { at: Date.now(), is: 'signed_out' };
		else if (!response.ok) return undefined;
		else {
			const body: { words: SavedWord[]; lists: WordList[] } = await response.json();
			account = { at: Date.now(), is: { words: new Set(body.words.map((w) => w.word)), lists: body.lists } };
		}
		return account.is;
	} catch {
		return undefined;
	}
}

async function saved(word: string): Promise<SavedReply> {
	const is = await readAccount();
	if (!is) return { ok: false };
	if (is === 'signed_out') return { ok: true, signedIn: false };
	return {
		ok: true,
		signedIn: true,
		saved: is.words.has(word),
		lists: is.lists.map((list) => ({ id: list.id, name: list.name, has: list.words.includes(word) }))
	};
}

async function save(request: SaveRequest): Promise<SaveReply> {
	const { word, lists = [] } = request;
	try {
		const response = await fetch(`${SITE}/api/saved/${encodeURIComponent(word)}`, {
			method: request.type === 'save' ? 'PUT' : 'DELETE',
			credentials: 'include',
			...(request.type === 'save' && lists.length
				? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lists }) }
				: {})
		});
		if (response.status === 401) {
			account = undefined;
			return { ok: false, why: 'signed_out' };
		}
		if (response.status === 409) return { ok: false, why: 'full' };
		if (!response.ok) return { ok: false, why: 'failed' };
	} catch {
		return { ok: false, why: 'failed' };
	}
	// Keep the copy here in step, so the next card need not ask again
	const is = account?.is;
	if (is && is !== 'signed_out') {
		if (request.type === 'save') {
			is.words.add(word);
			for (const list of is.lists) if (lists.includes(list.id) && !list.words.includes(word)) list.words.push(word);
		} else {
			is.words.delete(word);
			for (const list of is.lists) list.words = list.words.filter((other) => other !== word);
		}
	}
	return { ok: true };
}

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
		const reply =
			message?.type === 'gloss' ? gloss(message)
			: message?.type === 'saved' ? saved(message.word)
			: message?.type === 'save' || message?.type === 'unsave' ? save(message)
			: undefined;
		if (!reply) return;
		void reply.then(sendResponse);
		// Tells the browser the answer comes later
		return true;
	});
});
