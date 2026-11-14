// The visitor's flashcard reviews, in the browser.
//
// The schedule is worked out here (src/lib/review/fsrs.ts), not on the server,
// so review works signed out and an answer never waits for the network. As
// with the saved words: signed out, the cards live only in this browser's
// localStorage; signed in, the account holds them too and the two are brought
// together with POST /api/review/sync, where the copy of a card reviewed
// later wins.
//
// An answer is not sent the moment it is given but when the next one is, or
// when the page is left. Until then it can be undone: once the account has a
// review, an older state of the card would lose to it.
//
// How many cards were reviewed each day is counted beside the cards, for the
// heatmap and the streak. Each browser counts its own reviews and sends the
// account its own numbers; the account answers with the other browsers' sum.
// A number sent twice is the same number, so nothing is ever counted double.
//
// One object per page, shared through Svelte context (a module variable would
// be shared between visitors on the server).
import { getContext, setContext } from 'svelte';
import { SYNC_MAX, mergeCards, parseCards } from './review/cards.ts';
import { COMMON_DECKS, DEFAULT_SETTINGS, parseSettings, type ReviewSettings } from './review/decks.ts';
import { DAYS_MAX, addDays, dayKey, parseDays, type DayCounts } from './review/days.ts';
import { DAY, type ReviewCard } from './review/fsrs.ts';

const CARDS_KEY = 'review';
/** The id of the account the stored cards are a copy of. Absent while signed out. */
const OWNER_KEY = 'review-owner';
const SETTINGS_KEY = 'review-settings';
/** The server's time at the last exchange: what to ask "changed since" by. */
const SYNCED_KEY = 'review-synced';
/** Words whose cards the account has not yet been sent. */
const UNSENT_KEY = 'review-unsent';
/** Reviews by day in this browser: `{ "2026-11-12": 34 }`. */
const DAYS_KEY = 'review-days';
/** The same for the account's other browsers, as the account last gave it. */
const OTHER_DAYS_KEY = 'review-days-others';
/** Days whose count the account has not yet been sent. */
const UNSENT_DAYS_KEY = 'review-days-unsent';
/** A random name for this browser, under which the account keeps its day counts. */
const DEVICE_KEY = 'review-device';
/** How long one exchange with the account may take before the next one is let through. */
const SYNC_WAIT_MS = 15_000;

function read(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null');
	} catch {
		return null; // storage blocked, or not JSON
	}
}

function store(key: string, value: unknown): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage blocked or full: review still works until the page is closed.
	}
}

// This browser's own clock may run ahead of the server's; a day is allowed for.
const readCards = () => new Map(parseCards(read(CARDS_KEY), Date.now() + DAY).map((card) => [card.word, card]));

interface SyncAnswer {
	cards: unknown;
	settings: unknown;
	days: unknown;
	now: number;
}

export class Review {
	/** By word. Replaced, never changed in place. */
	cards = $state.raw<ReadonlyMap<string, ReviewCard>>(new Map());
	settings = $state.raw<ReviewSettings>(DEFAULT_SETTINGS);
	/** False until the browser's cards have been read. */
	ready = $state(false);
	/** The words of each deck of common words, once fetched (fetchDecks). */
	common = $state.raw<ReadonlyMap<string, string[]>>(new Map());

	#ownDays = $state.raw<DayCounts>({});
	#otherDays = $state.raw<DayCounts>({});
	/** Reviews by day, in every browser of the account. */
	days = $derived(addDays(this.#ownDays, this.#otherDays));

	#unsent = $state.raw<ReadonlySet<string>>(new Set());
	#unsentDays = new Set<string>();
	#device = '';
	#synced = 0;
	#userId: string | null;
	/** Exchanges with the account run one after another, never two at once. */
	#queue: Promise<void> = Promise.resolve();
	#loading: Promise<void> | undefined;
	#read = false;
	#asked = new Set<string>();

	constructor(userId: string | null) {
		this.#userId = userId;
	}

	#setCards(cards: ReadonlyMap<string, ReviewCard>): void {
		this.cards = cards;
		store(CARDS_KEY, [...cards.values()]);
	}

	#setUnsent(words: ReadonlySet<string>): void {
		this.#unsent = words;
		store(UNSENT_KEY, words.size ? [...words] : null);
	}

	#setUnsentDays(days: Iterable<string>): void {
		this.#unsentDays = new Set(days);
		store(UNSENT_DAYS_KEY, this.#unsentDays.size ? [...this.#unsentDays] : null);
	}

	/** One review more, or with -1 one fewer, on the day of `ms`. */
	#count(ms: number, by: number): void {
		const day = dayKey(ms);
		this.#ownDays = { ...this.#ownDays, [day]: Math.max(0, (this.#ownDays[day] ?? 0) + by) };
		store(DAYS_KEY, this.#ownDays);
		if (this.#userId) this.#setUnsentDays([...this.#unsentDays, day]);
	}

	/**
	 * Forget the day counts: they were a copy of an account's. The browser's
	 * name goes too, so that the rows the account keeps under the old name
	 * count as another browser's from now on.
	 */
	#dropDays(): void {
		for (const key of [DAYS_KEY, OTHER_DAYS_KEY, UNSENT_DAYS_KEY, DEVICE_KEY]) store(key, null);
		this.#ownDays = {};
		this.#otherDays = {};
		this.#unsentDays = new Set();
	}

	/**
	 * Browser only: read the stored cards and bring them in line with the
	 * account. Called by the pages that show reviews, so the dictionary pages
	 * cost the account nothing; a second call does nothing.
	 */
	load(): Promise<void> {
		this.peek();
		return (this.#loading ??= this.sync());
	}

	/**
	 * Fetch the words of these decks of common words, each once. They are the
	 * same for everyone and cached, and are needed to tell which cards belong
	 * to a deck that is switched on.
	 */
	fetchDecks(ids: readonly string[]): void {
		for (const id of ids) {
			// Saved words and their lists are this browser's own; only the common decks are on the server.
			if (!COMMON_IDS.has(id) || this.#asked.has(id)) continue;
			this.#asked.add(id);
			void fetch(`/api/review/deck/${id}`)
				.then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
				.then((found: { words: string[] }) => (this.common = new Map(this.common).set(id, found.words)))
				.catch(() => this.#asked.delete(id)); // asked again by the next call
		}
	}

	/**
	 * Browser only: read what this browser holds, without asking the account.
	 * Enough for the header's count of cards due; a second call does nothing.
	 */
	peek(): void {
		if (this.#read) return;
		this.#read = true;
		// Another tab reviewed a card or changed the settings.
		addEventListener('storage', (event) => {
			if (event.key === CARDS_KEY) this.cards = readCards();
			if (event.key === SETTINGS_KEY) this.settings = parseSettings(read(SETTINGS_KEY)) ?? DEFAULT_SETTINGS;
			if (event.key === DAYS_KEY) this.#ownDays = parseDays(read(DAYS_KEY));
		});
		// Leaving the page: send what was answered, while there is still time to.
		addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden' && this.#unsent.size) void this.sync();
		});

		this.settings = parseSettings(read(SETTINGS_KEY)) ?? DEFAULT_SETTINGS;
		const owner = read(OWNER_KEY);
		const local = readCards();
		this.#ownDays = parseDays(read(DAYS_KEY));

		if (!this.#userId) {
			// Just signed out: the cards were a copy of the account, and the next
			// person at this browser must not inherit them.
			if (owner) {
				for (const key of [OWNER_KEY, SYNCED_KEY, UNSENT_KEY]) store(key, null);
				this.#setCards(new Map());
				this.#dropDays();
			} else this.cards = local;
			this.ready = true;
			return;
		}

		if (owner === this.#userId) {
			this.cards = local;
			this.#otherDays = parseDays(read(OTHER_DAYS_KEY));
			const unsentDays = read(UNSENT_DAYS_KEY);
			this.#unsentDays = new Set(Array.isArray(unsentDays) ? unsentDays.filter((d) => typeof d === 'string') : []);
			const unsent = read(UNSENT_KEY);
			this.#unsent = new Set(Array.isArray(unsent) ? unsent.filter((word) => local.has(word)) : []);
			const synced = read(SYNCED_KEY);
			this.#synced = typeof synced === 'number' ? synced : 0;
		} else if (owner) {
			// A copy of some other account: it is not sent anywhere.
			for (const key of [OWNER_KEY, SYNCED_KEY]) store(key, null);
			this.#setCards(new Map());
			this.#setUnsent(new Set());
			this.#dropDays();
		} else {
			// First load after signing in: what was reviewed here while signed out joins the account.
			this.cards = local;
			this.#setUnsent(new Set(local.keys()));
			this.#setUnsentDays(Object.keys(this.#ownDays));
		}
		const device = read(DEVICE_KEY);
		this.#device = typeof device === 'string' ? device : crypto.randomUUID();
		store(DEVICE_KEY, this.#device);
		this.ready = true;
	}

	/** True while the last answer for `word` can still be taken back. */
	canUndo(word: string): boolean {
		return !this.#userId || this.#unsent.has(word);
	}

	/** Keep the card as it stands after an answer. */
	record(card: ReviewCard): void {
		// The answers before this one go to the account now; this one waits,
		// so that it can be undone.
		void this.sync();
		this.#setCards(new Map(this.cards).set(card.word, card));
		if (this.#userId) this.#setUnsent(new Set(this.#unsent).add(card.word));
		this.#count(card.last_review, 1);
	}

	/** Take back the last answer for a word: `before` is its card as it was, or null if it had none. */
	undo(word: string, before: ReviewCard | null): void {
		const answered = this.cards.get(word);
		if (answered) this.#count(answered.last_review, -1);
		const cards = new Map(this.cards);
		if (before) cards.set(word, before);
		else cards.delete(word);
		this.#setCards(cards);
		if (!before) this.#setUnsent(new Set([...this.#unsent].filter((w) => w !== word)));
	}

	change(settings: Partial<Pick<ReviewSettings, 'new_per_day' | 'decks'>>): void {
		this.settings = { ...this.settings, ...settings, updated_at: Date.now() };
		store(SETTINGS_KEY, this.settings);
		void this.sync();
	}

	/** Send the account what it has not had, and take in what changed elsewhere. Does nothing signed out. */
	sync(): Promise<void> {
		if (!this.#userId) return Promise.resolve();
		// What to send is settled now, not when its turn in the queue comes: an
		// answer given a moment after this call must wait for the next one, or
		// it could not be undone.
		const sending = [...this.#unsent].flatMap((word) => this.cards.get(word) ?? []);
		const days: DayCounts = {};
		for (const day of [...this.#unsentDays].slice(0, DAYS_MAX)) days[day] = this.#ownDays[day] ?? 0;
		// Offline or the server failed: the cards stay marked as unsent and go with the next exchange.
		this.#queue = this.#queue.then(() => this.#exchange(sending, days)).catch(() => {});
		return this.#queue;
	}

	async #exchange(sending: ReviewCard[], days: DayCounts): Promise<void> {
		const batches: ReviewCard[][] = [];
		for (let i = 0; i < sending.length; i += SYNC_MAX) batches.push(sending.slice(i, i + SYNC_MAX));
		if (!batches.length) batches.push([]);

		for (const [i, batch] of batches.entries()) {
			const last = i === batches.length - 1;
			const res = await fetch('/api/review/sync', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				// Kept alive, so an exchange begun as the page is left still arrives.
				keepalive: batch.length < 100,
				// Exchanges wait in line, so one that stalls would hold back every
				// later one. A closed page's timer never fires, so this does not cut
				// short an exchange sent as the page is left.
				signal: AbortSignal.timeout(SYNC_WAIT_MS),
				body: JSON.stringify({
					cards: batch,
					...(last ? { since: this.#synced, settings: this.settings, device: this.#device, days } : {})
				})
			});
			if (!res.ok) throw new Error(String(res.status));
			const answer: SyncAnswer = await res.json();
			// A card answered again while this was on its way is still unsent.
			const sent = new Set(batch.filter((card) => this.cards.get(card.word) === card).map((card) => card.word));
			this.#setUnsent(new Set([...this.#unsent].filter((word) => !sent.has(word))));
			if (!last) continue;

			this.#setCards(mergeCards(this.cards.values(), parseCards(answer.cards, Date.now() + DAY)));
			const theirs = parseSettings(answer.settings);
			if (theirs && theirs.updated_at > this.settings.updated_at) {
				this.settings = theirs;
				store(SETTINGS_KEY, theirs);
			}
			// A day reviewed on again while this was on its way is still unsent.
			this.#setUnsentDays([...this.#unsentDays].filter((day) => !(day in days) || this.#ownDays[day] !== days[day]));
			this.#otherDays = parseDays(answer.days);
			store(OTHER_DAYS_KEY, this.#otherDays);
			this.#synced = answer.now;
			store(SYNCED_KEY, answer.now);
			store(OWNER_KEY, this.#userId);
		}
	}
}

const COMMON_IDS = new Set<string>(COMMON_DECKS.map((deck) => deck.id));

const KEY = Symbol('review');

export function provideReview(userId: string | null): Review {
	return setContext(KEY, new Review(userId));
}

export function useReview(): Review {
	return getContext<Review>(KEY);
}
