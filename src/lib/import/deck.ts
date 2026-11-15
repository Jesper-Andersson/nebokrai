// From an Anki collection to what an import offers: for each note, the
// Ukrainian words it names and the progress its card carries, in the
// scheduler's own terms (review/fsrs.ts). Both are FSRS, so when Anki kept the
// card's memory, stability and difficulty come across as they are and the
// next review stays on the day Anki had set.
import { dayKey, type DayCounts } from '../review/days.ts';
import { DAY, LEARNING, RELEARNING, REVIEW, answer, newCard, type CardState, type ReviewCard } from '../review/fsrs.ts';
import type { AnkiCard, AnkiCollection } from './anki.ts';
import { fieldText, looksUkrainian, wordsOf } from './clean.ts';

/** A card's progress, for whichever words it turns out to name. */
export type Progress = Omit<ReviewCard, 'word'>;

/** One thing to import: an Anki note or a line of a text file. */
export interface ImportItem {
	/** What the file said, as one line of text: "дзвонити, задзвонити (1)". */
	source: string;
	/** The Ukrainian words in it, as written (stress marks kept). */
	words: string[];
	/** Null for a word not yet studied: it is saved, and becomes a card when first reviewed. */
	progress: Progress | null;
	/** Suspended in Anki. */
	suspended: boolean;
}

const STATES: Record<number, CardState> = { 1: LEARNING, 2: REVIEW, 3: RELEARNING };
const HOUR = 3_600_000;

/** When a card is due, in ms. */
function dueOf(card: AnkiCard, created: number): number {
	// A card being learnt is due at a time, in seconds; any other at a day
	// counted from the collection's start, which Anki sets at the hour the day
	// rolls over. An hour more keeps that moment inside the day across a
	// change of clocks.
	if (card.type !== REVIEW && card.due > 1e9) return card.due * 1000;
	return created + card.due * DAY + HOUR;
}

/** The progress of an Anki card, or null if it was never studied. */
export function progressOf(card: AnkiCard, created: number, now: number): Progress | null {
	const state = STATES[card.type];
	if (!state) return null;
	const first = card.reviews[0]?.at;
	const last = card.reviews.at(-1)?.at;

	if (card.memory) {
		const due = dueOf(card, created);
		// Without a log (an export that left it out), a review card was last seen one interval before it is due.
		const last_review = Math.min(last ?? due - Math.max(card.interval, 1) * DAY, now);
		const reps = Math.max(card.reps, 1);
		return {
			due,
			stability: Math.min(Math.max(card.memory.stability, 0.001), 36500),
			difficulty: Math.min(Math.max(card.memory.difficulty, 1), 10),
			state,
			step: 0,
			reps,
			lapses: Math.min(card.lapses, reps),
			added_at: Math.min(first ?? last_review, last_review),
			last_review
		};
	}

	// Anki without FSRS (SM-2): play the answers through this site's scheduler.
	if (card.reviews.length) {
		let replayed = newCard('', card.reviews[0].at);
		for (const review of card.reviews) replayed = answer(replayed, review.ease, review.at);
		const { word: _, ...progress } = replayed;
		return { ...progress, lapses: Math.min(progress.lapses, progress.reps) };
	}

	// No memory and no log: all that is known is the interval.
	const due = dueOf(card, created);
	const reps = Math.max(card.reps, 1);
	const last_review = Math.min(due - Math.max(card.interval, 1) * DAY, now);
	return {
		due, stability: Math.max(card.interval, 0.1), difficulty: 5, state, step: 0, reps,
		lapses: Math.min(card.lapses, reps), added_at: last_review, last_review
	};
}

/** For each note type, the field that holds the Ukrainian: the one that names a word on the most notes. */
export function ukrainianFields(col: AnkiCollection): Map<number, number> {
	const chosen = new Map<number, number>();
	for (const type of col.noteTypes) {
		const notes = col.notes.filter((n) => n.type === type.id);
		let best = 0;
		let bestScore = -1;
		for (let i = 0; i < type.fields.length; i++) {
			const score = notes.reduce((sum, n) => sum + looksUkrainian(n.fields[i] ?? ''), 0);
			if (score > bestScore) [best, bestScore] = [i, score];
		}
		chosen.set(type.id, best);
	}
	return chosen;
}

/** The deck most of the cards are in, as a name for the list they go into: the last part of a subdeck's name. */
export function mainDeck(col: AnkiCollection): string {
	const counts = new Map<number, number>();
	for (const card of col.cards) counts.set(card.deck, (counts.get(card.deck) ?? 0) + 1);
	const [top] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
	return (col.decks.get(top ?? -1) ?? '').split('::').at(-1)!.trim();
}

/**
 * One item per note. Of a note's cards (front-to-back and reverse), the one
 * answered last stands for it. `fields` overrides the field read for a note type.
 */
export function ankiItems(col: AnkiCollection, now: number, fields = ukrainianFields(col)): ImportItem[] {
	const byNote = new Map<number, AnkiCard[]>();
	for (const card of col.cards) byNote.set(card.note, [...(byNote.get(card.note) ?? []), card]);
	const lastAt = (c: AnkiCard) => c.reviews.at(-1)?.at ?? 0;

	return col.notes.flatMap((note) => {
		const cards = byNote.get(note.id);
		if (!cards) return [];
		const card = [...cards].sort((a, b) => lastAt(b) - lastAt(a) || b.reps - a.reps || a.ord - b.ord)[0];
		const field = note.fields[fields.get(note.type) ?? 0] ?? '';
		return [{
			source: fieldText(field).replace(/\n+/g, ' · '),
			words: wordsOf(field),
			progress: progressOf(card, col.created, now),
			suspended: cards.every((c) => c.queue === -1)
		}];
	});
}

/** Reviews per day, from Anki's log, for the heatmap and the weekly goal. */
export function ankiDays(col: AnkiCollection): DayCounts {
	const days: DayCounts = {};
	for (const card of col.cards) for (const { at } of card.reviews) days[dayKey(at)] = (days[dayKey(at)] ?? 0) + 1;
	return days;
}
