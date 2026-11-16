// The rules of a round of grammar practice (/practice): which points are
// asked, whether an answer is right, and what a round's answers do to a
// point's schedule. The page keeps the state and draws; the sentences come
// from /api/practice (gaps.ts). No Svelte and no browser, so `npm test` runs
// this file, and whatever is random is an argument.
import {
	AGAIN, GOOD, HARD, RELEARNING, REVIEW, answer, dayNumber, newCard, retrievability, type Rating, type ReviewCard
} from '../review/fsrs.ts';
import { checkTyped, type Typed } from '../review/recall.ts';
import { isCyrillic, plain } from '../search/normalize.ts';
import { cardKey, type Point } from './points.ts';
import { WHERE_MARK, isWherePoint } from './where.ts';

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
	/** The sentence was corrected here (data/tatoeba-corrections.tsv); its credit says so. */
	adapted?: boolean;
	/**
	 * How the sentence is asked: with no kind, a noun to fill in; `where`, the
	 * sentence whole and the question де? or куди?, which the point answers
	 * (where.ts); `who`, which of two nouns does what the verb says (roles.ts).
	 */
	kind?: 'where' | 'who';
	/**
	 * For a who item: the verb, by its key in i18n.ts (`practice.who.ask`),
	 * and the noun that does it. The gap's own noun is the one done to.
	 */
	roles?: { verb: string; doer: { word: string; headword: string; start: number; length: number } };
	/** For a where item: the noun in the case of the other question, with stress (вершині beside вершину). */
	partner?: string;
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

/** About one sentence in this many of a met у, на or під point is asked as де? or куди?. */
const WHERE_EVERY = 3;

/**
 * A round's points as /api/practice is asked for them: some sentences of
 * у, на and під named `u-acc:where`, to be asked as де? or куди? and not
 * filled in. Only a point met before the round is asked so: a new rule is
 * first learnt by filling it in.
 */
export function askWhere(plan: readonly string[], cards: ReadonlyMap<string, ReviewCard>, random: Random): string[] {
	return plan.map((id) =>
		isWherePoint(id) && cards.has(cardKey(id)) && random() < 1 / WHERE_EVERY ? id + WHERE_MARK : id
	);
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
 * (the right word, the wrong ending), close to one of them, or none of these.
 * A second spelling of the same case is as right as the one the sentence
 * has. The marking itself is the flashcards' too (review/recall.ts), so a
 * typed answer counts alike on both pages.
 */
export function checkAnswer(gap: Gap, given: string): Typed {
	return checkTyped(gap.answer, gap.also, gap.forms, given);
}

/**
 * How one sentence went: answered rightly unaided, rightly with help (a hint
 * was shown, asked for or after a wrong try), or missed.
 */
export type Outcome = 'right' | 'helped' | 'missed';

/**
 * How far up the ladder of hints a typed sentence has come: 0, none yet;
 * 1, the ending to change (цук~~ор~~ → цукр_); 2, the rule (без → genitive);
 * 3, the answer itself, and the sentence is missed.
 */
export type Step = 0 | 1 | 2 | 3;

/** The answer as stem and ending, each with its stress: цу́кр + у, вод + и́. */
export interface Ending {
	stem: string;
	ending: string;
	/** The stem's length in letters, stress marks not counted: where to cut the sentence's own spelling. */
	letters: number;
}

const STRESS = '́';

/** How many letters two words start with alike. */
function shared(a: string, b: string): number {
	let n = 0;
	while (n < a.length && n < b.length && a[n] === b[n]) n++;
	return n;
}

/**
 * A word cut after so many letters, a stress mark staying with its vowel:
 * цу́кру after 4 is цу́кр + у. Capitals and apostrophes count as letters, as
 * `plain()` keeps one letter for each.
 */
export function cut(text: string, letters: number): { stem: string; ending: string } {
	const chars = [...text.normalize('NFC')];
	let at = 0;
	let seen = 0;
	while (at < chars.length && (seen < letters || chars[at] === STRESS)) {
		if (chars[at] !== STRESS) seen++;
		at++;
	}
	return { stem: chars.slice(0, at).join(''), ending: chars.slice(at).join('') };
}

/**
 * Where the answer's ending starts. The stem is the start the answer shares
 * with most of the noun's other forms: цукру shares цукр with цукром, цукрі,
 * цукрові and more, and цук only with цукор. On a tie the shorter wins, so
 * канікулах is канікул + ах, not канікула + х. A form the same as the
 * dictionary's (сніг after на, день after у) has no ending, though день's
 * other forms would cut it д + ень. Over the 7,845 sentences of November 2026
 * this gives цукр|у, гітар|і, рук|ах; where a consonant changes before the
 * ending it is counted in (вечір|ці), which is what changes.
 */
export function endingOf(gap: Gap): Ending {
	const wanted = plain(gap.answer);
	let letters = [...wanted].length;
	if (wanted !== plain(gap.word)) {
		const counts = new Map<number, number>();
		for (const form of gap.forms) {
			if (form === wanted || gap.also.includes(form)) continue;
			const n = shared(wanted, form);
			counts.set(n, (counts.get(n) ?? 0) + 1);
		}
		let best = 0;
		let most = 0;
		for (const [n, count] of counts) {
			if (count > most || (count === most && n < best)) [best, most] = [n, count];
		}
		if (best > 0) letters = best;
	}
	return { ...cut(gap.answer, letters), letters };
}

/**
 * A wrong try against the stem: what of it stays and what is struck out.
 * цукор against цукр keeps цук and strikes ор; цукром keeps цукр and strikes
 * ом. A try in Latin letters is not shown against Cyrillic: null.
 */
export function struckEnding(given: string, ending: Ending): { kept: string; struck: string } | null {
	const typed = given.trim();
	if (!typed || !isCyrillic(plain(typed))) return null;
	const kept = shared(plain(typed), plain(ending.stem));
	return { kept: cut(typed, kept).stem, struck: cut(typed, kept).ending };
}

/** One step up the ladder. An answer with no ending skips the first step: сніг_ would point at an ending not there. */
function up(step: Step, ending: Ending): Step {
	return Math.min(3, step + (step === 0 && !ending.ending ? 2 : 1)) as Step;
}

/**
 * The step after a typed try, and the sentence's outcome once there is one.
 * Right is right unaided only with no hint shown; any other try, a form of
 * the noun, a word near it or another word, climbs one step, and the third
 * step gives the answer and counts as missed.
 */
export function climb(step: Step, found: Typed, ending: Ending): { step: Step; outcome: Outcome | null } {
	if (found === 'right') return { step, outcome: step === 0 ? 'right' : 'helped' };
	const next = up(step, ending);
	return { step: next, outcome: next === 3 ? 'missed' : null };
}

/** The step after "Hint" is pressed: up as far as the rule, never to the answer. */
export function hintStep(step: Step, ending: Ending): Step {
	return Math.min(2, up(step, ending)) as Step;
}

/**
 * Where a note on the answer's ending is looked up (`practice.notes` in
 * i18n.ts): the case, the number and the ending, `genitive:singular:у`. Most
 * endings have none, and then nothing is shown.
 */
export function noteKey(point: Point, gap: Gap, ending: Ending): string {
	return `${point.case}:${gap.number}:${plain(ending.ending)}`;
}

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
