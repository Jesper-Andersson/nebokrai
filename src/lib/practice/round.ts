// The rules of a round of grammar practice (/practice): which points are
// asked, whether an answer is right, and what a round's answers do to a
// point's schedule. The page keeps the state and draws; the sentences come
// from /api/practice (gaps.ts). No Svelte and no browser, so `npm test` runs
// this file, and whatever is random is an argument.
import {
	AGAIN, GOOD, HARD, RELEARNING, REVIEW, answer, dayNumber, newCard, retrievability, type Rating, type ReviewCard
} from '../review/fsrs.ts';
import { plain } from '../search/normalize.ts';
import { cardKey } from './points.ts';

/** A number from 0 up to, not including, 1: Math.random, or a fixed sequence in a test. */
export type Random = () => number;

/** Sentences in a round: about three minutes. */
export const ROUND = 10;
/** Points met for the first time in one round. */
const NEW_PER_ROUND = 2;
/** With this many points due, no new one is added: the round is full already. */
const DUE_ENOUGH = 6;
/** A round mixes at least this many points, where that many have been met. */
const MIX = 3;
/** Days a point must hold before it counts as known: a "mature" card, as Anki has it. */
const KNOWN_DAYS = 21;
/** A review is timed for nine chances in ten of recall; under eight the point's day is well past. */
const WEAK_RECALL = 0.8;
/** A round of weak spots is over at most this many points, so each is asked more than twice. */
const WEAK_POINTS = 4;

/** One sentence with a noun left out, as /api/practice gives it (docs/api.md). */
export interface Gap {
	point: string;
	uk: string;
	en: string;
	/** Where the noun stands in `uk`. */
	start: number;
	length: number;
	/** The noun as it stands there, with stress: цу́кру. */
	answer: string;
	/** Other spellings of the same case, as `plain()` writes them: столу where the sentence has столі. */
	also: string[];
	number: 'singular' | 'plural';
	/** The noun's dictionary form: цукор, and with stress цу́кор. */
	word: string;
	headword: string;
	/** Four forms of the noun with stress, the answer among them. */
	choices: string[];
	/** Every form of the noun, as `plain()` writes them. */
	forms: string[];
	tatoeba_id: number;
}

/**
 * How well a point is held, as the map of the rules shades it: not met;
 * shaky; being learnt; known.
 */
export type PointState = 'new' | 'weak' | 'learning' | 'known';

/**
 * A point is shaky when its last round had a miss or needed help and it has
 * not been got right since, or when it was left so long past its day that
 * it has probably slipped.
 */
export function stateOf(card: ReviewCard | undefined, now: number): PointState {
	if (!card) return 'new';
	if (card.state === RELEARNING) return 'weak';
	// Still on its first steps: a miss or help leaves it on the first, an unaided round moves it on
	if (card.state !== REVIEW) return card.step === 0 ? 'weak' : 'learning';
	if (retrievability(card, now) < WEAK_RECALL) return 'weak';
	return card.stability >= KNOWN_DAYS ? 'known' : 'learning';
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * The points of a round, one for each sentence, in the order asked.
 *
 * `available` are the points that have sentences, in the order they are best
 * met. Points whose day has come are asked, with up to two not met before;
 * where that leaves fewer than three, the points held least well join them,
 * so that a round is a mix and not one rule ten times over. A new point is
 * asked twice running at the start, then mixed in with the rest.
 *
 * With `only`, the round is those points alone, whatever their days: what
 * the learner chose, one rule (/practice?rule=bez-gen) or a lesson's
 * (/practice?lesson=where). Their sentences are dealt round them evenly.
 */
export function planRound(
	available: readonly string[], cards: ReadonlyMap<string, ReviewCard>, now: number, random: Random,
	only?: readonly string[]
): string[] {
	if (only) {
		const chosen = only.filter((id) => available.includes(id));
		if (!chosen.length) return [];
		const dealt = Array.from({ length: ROUND }, (_, i) => chosen[i % chosen.length]);
		return apart(shuffled(dealt, random), undefined);
	}

	const today = dayNumber(now);
	const card = (id: string) => cards.get(cardKey(id));
	const met = available.filter((id) => card(id));
	const due = met
		.filter((id) => card(id)!.state !== REVIEW || dayNumber(card(id)!.due) <= today)
		.sort((a, b) => card(a)!.due - card(b)!.due);
	const fresh = due.length >= DUE_ENOUGH ? [] : available.filter((id) => !card(id)).slice(0, NEW_PER_ROUND);
	const chosen = [...due, ...fresh].slice(0, ROUND);
	if (chosen.length < MIX) {
		const rest = met
			.filter((id) => !chosen.includes(id))
			.sort((a, b) => retrievability(card(a)!, now) - retrievability(card(b)!, now));
		chosen.push(...rest.slice(0, MIX - chosen.length));
	}
	if (!chosen.length) return [];

	// The sentences are dealt round the points, the new ones first: they get the odd ones over.
	const order = [...fresh.filter((id) => chosen.includes(id)), ...chosen.filter((id) => !fresh.includes(id))];
	const dealt = Array.from({ length: ROUND }, (_, i) => order[i % order.length]);

	const opening: string[] = [];
	const mixed = [...dealt];
	for (const id of fresh) {
		for (let twice = 0; twice < 2; twice++) {
			const at = mixed.indexOf(id);
			if (at < 0) break;
			mixed.splice(at, 1);
			opening.push(id);
		}
	}
	return [...opening, ...apart(shuffled(mixed, random), opening.at(-1))];
}

/**
 * The points of a round of weak spots: the shaky points among those met, up
 * to four, the least likely to be recalled first. Where fewer than three are
 * shaky, the points held least well after them join in, so the round is
 * still a mix. Nothing new is brought in: with no point met there is no
 * round.
 */
export function planWeak(
	available: readonly string[], cards: ReadonlyMap<string, ReviewCard>, now: number, random: Random
): string[] {
	const card = (id: string) => cards.get(cardKey(id))!;
	const met = available
		.filter((id) => cards.has(cardKey(id)))
		.sort((a, b) => retrievability(card(a), now) - retrievability(card(b), now) || card(a).stability - card(b).stability);
	const weak = met.filter((id) => stateOf(card(id), now) === 'weak').slice(0, WEAK_POINTS);
	const chosen = [...weak, ...met.filter((id) => !weak.includes(id)).slice(0, Math.max(0, MIX - weak.length))];
	if (!chosen.length) return [];
	const dealt = Array.from({ length: ROUND }, (_, i) => chosen[i % chosen.length]);
	return apart(shuffled(dealt, random), undefined);
}

/** The same points with as few as can be asked twice running; `before` is what was asked last. */
function apart(points: string[], before: string | undefined): string[] {
	const out: string[] = [];
	const left = [...points];
	let last = before;
	while (left.length) {
		const at = left.findIndex((id) => id !== last);
		const [next] = left.splice(Math.max(at, 0), 1);
		out.push(next);
		last = next;
	}
	return out;
}

/**
 * What a typed answer is: the form wanted, another form of the same noun
 * (the right word, the wrong ending), or neither. Stress marks, capitals and
 * the kind of apostrophe do not count, and a second spelling of the same
 * case is as right as the one the sentence has.
 */
export function checkAnswer(gap: Gap, given: string): 'right' | 'form' | 'wrong' {
	const typed = plain(given.trim());
	if (!typed) return 'wrong';
	if (typed === plain(gap.answer) || gap.also.includes(typed)) return 'right';
	return gap.forms.includes(typed) ? 'form' : 'wrong';
}

/**
 * How one sentence went: answered rightly unaided, rightly with help (the
 * case was shown, or a first try had the right word in the wrong form), or
 * missed.
 */
export type Outcome = 'right' | 'helped' | 'missed';

/** What a point's sentences in one round say of it: one miss outweighs the rest, and help outweighs none. */
export function ratingOf(outcomes: readonly Outcome[]): Rating {
	if (outcomes.includes('missed')) return AGAIN;
	return outcomes.includes('helped') ? HARD : GOOD;
}

/**
 * A point's card after a round's answers so far. A round is one review of
 * the point however many of its sentences were asked: `before` is the card
 * as the round found it (undefined for a point not met), and each further
 * answer gives the review's result again from there.
 */
export function gradePoint(id: string, before: ReviewCard | undefined, outcomes: readonly Outcome[], now: number): ReviewCard {
	return answer(before ?? newCard(cardKey(id), now), ratingOf(outcomes), now);
}

/** A sentence as two halves round its gap. */
export function split(gap: Gap): { before: string; word: string; after: string } {
	return {
		before: gap.uk.slice(0, gap.start),
		word: gap.uk.slice(gap.start, gap.start + gap.length),
		after: gap.uk.slice(gap.start + gap.length)
	};
}
