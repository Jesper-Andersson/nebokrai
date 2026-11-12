// The FSRS-6 scheduler: when a flashcard should come back, given how its
// earlier reviews went.
//
// A card's memory is two numbers. Stability is the number of days after which
// the chance of recalling the word has fallen to 90%; difficulty runs from 1
// to 10. Each answer moves both, and the next review is set for the day the
// chance of recall reaches the retention asked for.
//
// The formulas, the default parameters, the learning steps and the rounding to
// eight decimals follow ts-fsrs 5.4.2 (open-spaced-repetition, MIT), so that
// tests/fsrs.test.ts can check this file against the values that project and
// py-fsrs publish. Nothing here knows about the site: no imports, and the time
// is always an argument.

/** The default FSRS-6 parameters, w0 to w20. */
const W = [
	0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
	1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
] as const;

/** The chance of recall a review is timed for. */
const RETENTION = 0.9;
const MAX_INTERVAL = 36500;
const MIN_STABILITY = 0.001;
/** Minutes until a new card returns: after its first answer, then after the next "Good". */
const LEARNING_STEPS = [1, 10];
/** Minutes until a forgotten card returns. */
const RELEARNING_STEPS = [10];

export const MINUTE = 60_000;
export const DAY = 86_400_000;
/** A day ends at 04:00 local time, as in Anki, so a review after midnight belongs to the evening. */
const ROLLOVER = 4 * 60 * MINUTE;

export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;
export type Rating = 1 | 2 | 3 | 4;
/** What the review page offers: "Again" or "Good". */
export type Grade = 1 | 3;

export const NEW = 0, LEARNING = 1, REVIEW = 2, RELEARNING = 3;
export type CardState = 0 | 1 | 2 | 3;

/** One word's schedule. Times are in milliseconds; the names are the API's, hence snake_case. */
export interface ReviewCard {
	word: string;
	due: number;
	/** 0 with difficulty 0 until the first answer. */
	stability: number;
	difficulty: number;
	state: CardState;
	/** Which learning step the card is on. */
	step: number;
	reps: number;
	lapses: number;
	/** When the card was first shown: the daily limit on new cards counts these. */
	added_at: number;
	/** 0 until the first answer. */
	last_review: number;
}

export interface Memory {
	stability: number;
	difficulty: number;
}

const round8 = (x: number) => Math.round(x * 1e8) / 1e8;
const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

const DECAY = -W[20];
const FACTOR = round8(Math.exp(Math.log(0.9) / DECAY) - 1);
const INTERVAL_MODIFIER = round8((Math.pow(RETENTION, 1 / DECAY) - 1) / FACTOR);

/** The chance of recalling a word `days` after a review that left it with `stability`. */
function forgettingCurve(days: number, stability: number): number {
	return round8(Math.pow(1 + (FACTOR * days) / stability, DECAY));
}

function initDifficulty(rating: Rating): number {
	return round8(W[4] - Math.exp((rating - 1) * W[5]) + 1);
}

function nextDifficulty(d: number, rating: Rating): number {
	// The nearer to 10, the smaller the step; then a slight pull back towards an easy card's start.
	const damped = d + round8((-W[6] * (rating - 3) * (10 - d)) / 9);
	return clamp(round8(W[7] * initDifficulty(EASY) + (1 - W[7]) * damped), 1, 10);
}

function recallStability(d: number, s: number, r: number, rating: Rating): number {
	const hard = rating === HARD ? W[15] : 1;
	const easy = rating === EASY ? W[16] : 1;
	const growth = Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy;
	return round8(clamp(s * (1 + growth), MIN_STABILITY, MAX_INTERVAL));
}

function forgetStability(d: number, s: number, r: number): number {
	const after = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
	return round8(clamp(after, MIN_STABILITY, MAX_INTERVAL));
}

/** A second review on the same day: it can only help, unless the answer was "Again". */
function sameDayStability(s: number, rating: Rating): number {
	const growth = Math.pow(s, -W[19]) * Math.exp(W[17] * (rating - 3 + W[18]));
	return round8(clamp(s * (rating >= HARD ? Math.max(growth, 1) : growth), MIN_STABILITY, MAX_INTERVAL));
}

/** The memory after an answer given `days` whole days after the last one. */
export function nextMemory({ stability: s, difficulty: d }: Memory, days: number, rating: Rating): Memory {
	if (s === 0 && d === 0) {
		return { stability: Math.max(W[rating - 1], 0.1), difficulty: clamp(initDifficulty(rating), 1, 10) };
	}
	const r = forgettingCurve(days, s);
	let stability: number;
	if (days === 0) stability = sameDayStability(s, rating);
	// Forgetting never leaves a word better known than a same-day "Again" would have.
	else if (rating === AGAIN) stability = Math.min(Math.max(round8(s / Math.exp(W[17] * W[18])), MIN_STABILITY), forgetStability(d, s, r));
	else stability = recallStability(d, s, r, rating);
	return { stability, difficulty: nextDifficulty(d, rating) };
}

/** Whole days until the chance of recall falls to the retention asked for. */
function interval(stability: number): number {
	return Math.min(Math.max(1, Math.round(stability * INTERVAL_MODIFIER)), MAX_INTERVAL);
}

/**
 * The number of the local day `ms` falls in, counting 04:00 as its start.
 * Days are compared by date and not by hours passed: a card answered at 22:00
 * and due the next morning is a day old, not eleven hours.
 */
export function dayNumber(ms: number): number {
	const d = new Date(ms - ROLLOVER);
	return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** A card for a word not yet reviewed, shown for the first time at `now`. */
export function newCard(word: string, now: number): ReviewCard {
	return {
		word, due: now, stability: 0, difficulty: 0, state: NEW, step: 0, reps: 0, lapses: 0, added_at: now,
		last_review: 0
	};
}

/** The minutes until a card still being learnt returns, or null when it is ready for whole days. */
function learningStep(card: ReviewCard, rating: Rating): { minutes: number; step: number } | null {
	const steps = card.state === REVIEW || card.state === RELEARNING ? RELEARNING_STEPS : LEARNING_STEPS;
	if (card.step >= steps.length) return null;
	if (rating === AGAIN) return { minutes: steps[0], step: 0 };
	if (card.state === REVIEW) return null;
	if (rating === HARD) {
		const minutes = steps.length === 1 ? steps[0] * 1.5 : (steps[0] + steps[1]) / 2;
		return { minutes: Math.round(minutes), step: card.step };
	}
	if (rating === GOOD && card.step + 1 < steps.length) return { minutes: steps[card.step + 1], step: card.step + 1 };
	return null;
}

/** The card as it stands after being answered with `rating` at `now`. */
export function answer(card: ReviewCard, rating: Rating, now: number): ReviewCard {
	const days = card.state === NEW ? 0 : Math.max(0, dayNumber(now) - dayNumber(card.last_review));
	const memory = (r: Rating) => nextMemory(card, days, r);
	const next: ReviewCard = { ...card, ...memory(rating), reps: card.reps + 1, last_review: now };

	if (card.state === REVIEW && rating !== AGAIN) {
		// The three passing answers keep their order even where rounding would level them.
		const hard = Math.min(interval(memory(HARD).stability), interval(memory(GOOD).stability));
		const good = Math.max(interval(memory(GOOD).stability), hard + 1);
		const easy = Math.max(interval(memory(EASY).stability), good + 1);
		return { ...next, step: 0, due: now + (rating === HARD ? hard : rating === GOOD ? good : easy) * DAY };
	}
	if (card.state === REVIEW) next.lapses += 1;

	const step = learningStep(card, rating);
	if (!step) return { ...next, state: REVIEW, step: 0, due: now + interval(next.stability) * DAY };
	const state = card.state === NEW ? LEARNING : card.state === REVIEW ? RELEARNING : card.state;
	return { ...next, state, step: step.step, due: now + step.minutes * MINUTE };
}

/** When the card would next be due after each of the two answers, for the labels on the buttons. */
export function preview(card: ReviewCard, now: number): { again: number; good: number } {
	return { again: answer(card, AGAIN, now).due, good: answer(card, GOOD, now).due };
}

/** The chance, 0 to 1, of recalling the card's word at `now`; 0 for a card never answered. */
export function retrievability(card: ReviewCard, now: number): number {
	if (card.state === NEW || card.stability <= 0) return 0;
	return forgettingCurve(Math.max(0, dayNumber(now) - dayNumber(card.last_review)), card.stability);
}
