// What an import will do, once the server has said which dictionary word each
// written word is (POST /api/words/match): the words to save, the cards to
// write, and what is left out and why. Pure, so the preview and the tests
// share it.
import { newer } from '../review/cards.ts';
import type { ReviewCard } from '../review/fsrs.ts';
import type { ImportItem } from './deck.ts';

/** The server's answer for one written word: the entry's `word`, or a few words it may have meant. */
export interface Match {
	word: string | null;
	suggestions: string[];
}
export type Matches = Record<string, Match>;

export interface ImportPlan {
	/** Every word to save, in the file's order, once each. */
	words: string[];
	/** The cards to write: one per word with progress, the latest when two items name one word. */
	cards: ReviewCard[];
	/** Items that name no dictionary word (and were not given one by hand). */
	unmatched: ImportItem[];
	/** Items naming more than one word: each word gets the item's progress. */
	several: ImportItem[];
	/** Items left out because they were suspended in Anki. */
	suspended: ImportItem[];
	/** Items left out by hand. */
	leftOut: ImportItem[];
}

export interface PlanOptions {
	/** Bring suspended cards in as ordinary ones. */
	withSuspended?: boolean;
	/** A word chosen by hand for an item that matched nothing, by the item's source. */
	picks?: ReadonlyMap<string, string>;
	/** Dictionary words not to import, though an item names them: задзвонити of «дзвонити, задзвонити». */
	skipWords?: ReadonlySet<string>;
	/** Items not to import at all, by source. One that matched nothing is then not counted as missing. */
	skipItems?: ReadonlySet<string>;
}

/** Every written word in `items`, once each: what to ask the server about. */
export function wordsToMatch(items: ImportItem[]): string[] {
	return [...new Set(items.flatMap((i) => i.words))];
}

export function planImport(items: ImportItem[], matches: Matches, options: PlanOptions = {}): ImportPlan {
	const plan: ImportPlan = { words: [], cards: [], unmatched: [], several: [], suspended: [], leftOut: [] };
	const saved = new Set<string>();
	const cards = new Map<string, ReviewCard>();
	for (const item of items) {
		if (options.skipItems?.has(item.source)) {
			plan.leftOut.push(item);
			continue;
		}
		if (item.suspended && !options.withSuspended) {
			plan.suspended.push(item);
			continue;
		}
		const picked = options.picks?.get(item.source);
		const found = picked
			? [picked]
			: [...new Set(item.words.map((w) => matches[w]?.word).filter((w): w is string => !!w))];
		if (!found.length) {
			plan.unmatched.push(item);
			continue;
		}
		if (found.length > 1) plan.several.push(item);
		for (const word of found) {
			if (options.skipWords?.has(word)) continue;
			if (!saved.has(word)) {
				saved.add(word);
				plan.words.push(word);
			}
			const card = item.progress && { ...item.progress, word };
			const had = cards.get(word);
			if (card && (!had || newer(card, had))) cards.set(word, card);
		}
	}
	plan.cards = [...cards.values()];
	return plan;
}
