// Review cards as they are stored and exchanged: reading them from somewhere
// not trusted, joining two copies, and choosing what to show next. Shared by
// the browser and the server; no imports from SvelteKit.
import { MAX_WORD_LENGTH } from '../saved.ts';
import { DAY, LEARNING, RELEARNING, REVIEW, dayNumber, newCard, type CardState, type ReviewCard } from './fsrs.ts';

/** The most cards kept for one visitor: the saved list at its fullest, and every deck. */
export const MAX_REVIEW = 10000;
/** The most cards in one POST /api/review/sync. */
export const SYNC_MAX = 500;

const whole = (x: unknown, min: number, max: number): x is number =>
	Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const within = (x: unknown, min: number, max: number): x is number =>
	typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

/**
 * Read cards from storage or from a browser, dropping what is malformed. Only
 * a card answered at least once is a card: a word not yet seen has none.
 * A clock that runs ahead must not win every later comparison, so a review
 * dated after `now` is dated `now`.
 */
export function parseCards(value: unknown, now = Date.now(), max = MAX_REVIEW): ReviewCard[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const cards: ReviewCard[] = [];
	for (const item of value.slice(0, max)) {
		if (!item || typeof item !== 'object') continue;
		const { word, due, stability, difficulty, state, step, reps, lapses, added_at, last_review } = item;
		if (typeof word !== 'string' || !word || word.length > MAX_WORD_LENGTH || seen.has(word)) continue;
		if (!within(stability, 0.001, 36500) || !within(difficulty, 1, 10)) continue;
		if (!whole(state, LEARNING, RELEARNING) || !whole(step, 0, 9)) continue;
		if (!whole(reps, 1, 1e6) || !whole(lapses, 0, reps)) continue;
		if (!whole(last_review, 1, Number.MAX_SAFE_INTEGER) || !whole(due, 1, Number.MAX_SAFE_INTEGER)) continue;
		const reviewed = Math.min(last_review, now);
		seen.add(word);
		cards.push({
			word, stability, difficulty, state: state as CardState, step, reps, lapses,
			due: Math.min(Math.max(due, reviewed), reviewed + 36500 * DAY),
			added_at: whole(added_at, 1, reviewed) ? added_at : reviewed,
			last_review: reviewed
		});
	}
	return cards;
}

/** True when `a` is the copy to keep: the one reviewed later, or more often. */
export function newer(a: ReviewCard, b: ReviewCard): boolean {
	return a.last_review > b.last_review || (a.last_review === b.last_review && a.reps > b.reps);
}

/** Two copies of a visitor's cards as one: for each word, the copy reviewed later. */
export function mergeCards(mine: Iterable<ReviewCard>, theirs: Iterable<ReviewCard>): Map<string, ReviewCard> {
	const merged = new Map<string, ReviewCard>();
	for (const card of mine) merged.set(card.word, card);
	for (const card of theirs) {
		const had = merged.get(card.word);
		if (!had || newer(card, had)) merged.set(card.word, card);
	}
	return merged;
}

/** What there is to review today. */
export interface Plan {
	/** Cards on a learning step, soonest first. They come back within minutes. */
	learning: ReviewCard[];
	/** Cards whose day has come, longest overdue first. */
	due: ReviewCard[];
	/** Words not yet seen, as many as today's limit still allows. */
	fresh: string[];
}

/**
 * Today's reviews. `words` are the words of the decks switched on, in the
 * order new ones should be met. A card whose word is in none of them is left
 * alone: its schedule is kept for when the word is saved again.
 */
export function plan(cards: ReadonlyMap<string, ReviewCard>, words: string[], newPerDay: number, now: number): Plan {
	const today = dayNumber(now);
	const learning: ReviewCard[] = [];
	const due: ReviewCard[] = [];
	const unseen: string[] = [];
	for (const word of new Set(words)) {
		const card = cards.get(word);
		if (!card) unseen.push(word);
		else if (card.state !== REVIEW) learning.push(card);
		else if (dayNumber(card.due) <= today) due.push(card);
	}
	let metToday = 0;
	for (const card of cards.values()) if (dayNumber(card.added_at) === today) metToday += 1;
	const byDue = (a: ReviewCard, b: ReviewCard) => a.due - b.due;
	return {
		learning: learning.sort(byDue),
		due: due.sort(byDue),
		fresh: unseen.slice(0, Math.max(0, newPerDay - metToday))
	};
}

/**
 * The card to show now, or null when the day is done: a learning step that has
 * run out, then a review, then a new word. With nothing else left, a learning
 * card is shown ahead of its time, not left for the visitor to wait for.
 */
export function nextUp({ learning, due, fresh }: Plan, now: number): ReviewCard | null {
	if (learning.length && learning[0].due <= now) return learning[0];
	if (due.length) return due[0];
	if (fresh.length) return newCard(fresh[0], now);
	return learning[0] ?? null;
}
