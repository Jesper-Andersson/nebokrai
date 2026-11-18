// The levelled path: six named stages from the letters to reading, each a few
// things to have done, worked out from what the learner already has: the
// letters (alphabet/drill.ts), the decks of common words (review/decks.ts),
// the grammar lessons (practice/lessons.ts), the coverage figure
// (coverage.ts) and, once there are stories, the texts read.
//
// Nothing is ever locked: a stage is a summary and a next step, not a gate.
// A placement test (placement.ts) moves where the learner starts, never what
// they have: a start of 1,001 counts the first thousand words of the decks as
// had for the stages, without making a card for any of them.
//
// An input that is missing drops its criterion, so the path works before a
// feature it reads has shipped: without `texts` the stories are left out and
// every stage can still be reached. A stage once reached stays reached
// (`reached`, kept by the caller): a card that slips shows as needing review,
// it does not take the stage away.
//
// Pure: no Svelte, no storage, so `npm test` runs it (tests/path.test.ts).
import { coverage, milestones, type CoverageTable } from './coverage.ts';
import { lessonRows, type LessonGroup } from './practice/lessons.ts';
import { cardKey, type Point } from './practice/points.ts';
import { stateOf as pointState, type PointState } from './practice/round.ts';
import { COMMON_DECKS, type CommonDeckId } from './review/decks.ts';
import type { ReviewCard } from './review/fsrs.ts';

export const STAGE_IDS = ['letters', 'first-words', 'everyday', 'getting-around', 'conversations', 'reading'] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** How many of a deck's words are known, of how many. */
export interface DeckCount {
	known: number;
	total: number;
}

/** A lesson as the path needs it: lessonRows (practice/lessons.ts) gives these fields. */
export interface PathLesson {
	id: string;
	group: LessonGroup;
	/** Its place in its group's list, from 1. */
	n: number;
	points: readonly { state: PointState }[];
	/** Passed in the placement test: done without a card. */
	placed?: boolean;
}

/**
 * A text read, by the reading feature: its Storybooks level, 1 (easiest) to 5
 * (texts.ts). Stories have no frequency band: every level needed the same one.
 */
export interface TextRead {
	level: number;
}

export interface PathInput {
	/** Letters known (alphabet/drill.ts knownAmong) of the 33, and whether the learner said they read Cyrillic. */
	letters: { known: number; total: number; skipped: boolean };
	/** Known words of each deck of common words (deckCounts). A deck not given counts as none known. */
	decks: Partial<Record<CommonDeckId, DeckCount>>;
	/** Where new common words start, from the placement test: 1 when there was none. */
	start: number;
	/** The grammar lessons that have sentences, in order. */
	lessons: readonly PathLesson[];
	/** The texts read; missing while there are no stories, which drops their criteria. */
	texts?: readonly TextRead[];
	/** The share of everyday Ukrainian the known words cover, 0 to 1 (coverage.ts); missing drops it. */
	coverage?: number;
}

export type CriterionKind = 'letters' | 'deck' | 'lessons' | 'texts' | 'coverage';

/** One thing a stage asks for, with how far along it is and where to go to do it. */
export interface Criterion {
	kind: CriterionKind;
	/** For a deck, its id; for lessons, the group and how far ("preposition:4", "government:all"). */
	key: string;
	have: number;
	need: number;
	done: boolean;
	href: string;
	/** For lessons, the first not yet done, by id: what the next step opens. */
	lesson?: string;
}

export interface Stage {
	id: StageId;
	/** From 1, kept for reference beside the name. */
	n: number;
	criteria: Criterion[];
	/** Every criterion is done now. */
	met: boolean;
	/** Met now or before, or a later stage is. */
	reached: boolean;
}

export interface Path {
	stages: Stage[];
	/** The furthest stage reached, or null before the first. */
	current: StageId | null;
	/** The stage after it and its first criterion not yet done: the one next step. Null at the end. */
	next: { stage: StageId; criterion: Criterion } | null;
}

// --- The stages ---
//
// Words are counted per deck: common-500 is places 1–500, common-1000 501–1000,
// common-2000 1001–2000. The coverage thresholds sit a little below what the
// words the stage asks for (with those of the stages before it) would cover if
// they were the commonest ones, measured on nebokrai.db with milestones() on
// 2026-11-17: 675 words (500 × 85% + 500 × 50%, Getting around) cover 79.6%,
// and 1,625 (+ 500 × 80% + 1,000 × 80%, Reading) about 88%. Known words are
// rarely exactly the commonest, hence the margin; tests/path.test.ts keeps it
// under six points.

type Need =
	| { kind: 'letters' }
	| { kind: 'deck'; deck: CommonDeckId; share: number }
	| { kind: 'deck-count'; deck: CommonDeckId; words: number }
	| { kind: 'lessons'; group: LessonGroup; upTo: number | 'all' }
	/** `count` texts read at `level` or a harder one: an easy story is no proof of reading a hard one. */
	| { kind: 'texts'; level: number; count: number }
	| { kind: 'coverage'; share: number };

export const STAGE_NEEDS: Readonly<Record<StageId, readonly Need[]>> = {
	letters: [{ kind: 'letters' }],
	'first-words': [
		{ kind: 'deck-count', deck: 'common-500', words: 100 },
		{ kind: 'lessons', group: 'preposition', upTo: 2 }
	],
	everyday: [
		{ kind: 'deck', deck: 'common-500', share: 0.6 },
		{ kind: 'lessons', group: 'preposition', upTo: 4 },
		{ kind: 'texts', level: 1, count: 1 }
	],
	'getting-around': [
		{ kind: 'deck', deck: 'common-500', share: 0.85 },
		{ kind: 'deck', deck: 'common-1000', share: 0.5 },
		{ kind: 'lessons', group: 'preposition', upTo: 6 },
		{ kind: 'lessons', group: 'government', upTo: 1 },
		// Three stories of any level, the easiest included
		{ kind: 'texts', level: 1, count: 3 },
		{ kind: 'coverage', share: 0.75 }
	],
	conversations: [
		{ kind: 'deck', deck: 'common-1000', share: 0.8 },
		{ kind: 'deck', deck: 'common-2000', share: 0.4 },
		{ kind: 'lessons', group: 'preposition', upTo: 'all' },
		{ kind: 'lessons', group: 'government', upTo: 'all' },
		// Level 3 and above: longer stories, longer sentences (18 of the 29)
		{ kind: 'texts', level: 3, count: 3 }
	],
	reading: [
		{ kind: 'deck', deck: 'common-2000', share: 0.8 },
		{ kind: 'coverage', share: 0.85 },
		// Level 4 and above (6 of the 29)
		{ kind: 'texts', level: 4, count: 3 }
	]
};

/** A placement of at least this many words says the letters are read already. */
export const LETTERS_BY_PLACEMENT = 500;

const DECK_HREF = (deck: CommonDeckId) => `/review?deck=${deck}`;

/** The words of a deck before `start`: had through the placement test, without cards. */
function placedIn(deck: CommonDeckId, start: number): number {
	const { from, to } = COMMON_DECKS.find((d) => d.id === deck)!;
	return Math.max(0, Math.min(start - 1, to) - from + 1);
}

/** A lesson is done when every rule in it is being learnt or known, or the test placed it. */
export function lessonDone(lesson: PathLesson): boolean {
	return !!lesson.placed || lesson.points.every(({ state }) => state === 'learning' || state === 'known');
}

function criterion(need: Need, input: PathInput): Criterion | null {
	switch (need.kind) {
		case 'letters': {
			const { known, total, skipped } = input.letters;
			const placed = input.start - 1 >= LETTERS_BY_PLACEMENT;
			const done = skipped || placed || known >= total;
			return { kind: 'letters', key: 'letters', have: done ? total : known, need: total, done, href: '/alphabet' };
		}
		case 'deck':
		case 'deck-count': {
			const { from, to } = COMMON_DECKS.find((d) => d.id === need.deck)!;
			const size = to - from + 1;
			const count = input.decks[need.deck];
			const total = count?.total || size;
			const wanted = need.kind === 'deck' ? Math.ceil(total * need.share) : need.words;
			// Known through cards or placed by the test, whichever is more: the
			// placed words have no cards, and cards begun before a placement still count
			const have = Math.min(Math.max(count?.known ?? 0, placedIn(need.deck, input.start)), total);
			return { kind: 'deck', key: need.deck, have, need: wanted, done: have >= wanted, href: DECK_HREF(need.deck) };
		}
		case 'lessons': {
			const ofGroup = input.lessons.filter((lesson) => lesson.group === need.group);
			// A lesson with no sentences in this database is not shown, so not asked for either
			const upTo = need.upTo;
			const asked = upTo === 'all' ? ofGroup : ofGroup.filter((lesson) => lesson.n <= upTo);
			if (!asked.length) return null;
			const done = asked.filter(lessonDone);
			const first = asked.find((lesson) => !lessonDone(lesson));
			return {
				kind: 'lessons', key: `${need.group}:${need.upTo}`, have: done.length, need: asked.length,
				done: done.length === asked.length, href: first ? `/practice?lesson=${first.id}` : '/practice',
				...(first ? { lesson: first.id } : {})
			};
		}
		case 'texts': {
			if (!input.texts) return null;
			const have = Math.min(input.texts.filter((text) => text.level >= need.level).length, need.count);
			return { kind: 'texts', key: String(need.level), have, need: need.count, done: have >= need.count, href: `/read?level=${need.level}` };
		}
		case 'coverage': {
			if (input.coverage === undefined) return null;
			// In whole percents, as the page shows it
			const have = Math.floor(input.coverage * 100 + 1e-9);
			const wanted = Math.round(need.share * 100);
			// Coverage grows as words become known: reviewing is the way to it
			return { kind: 'coverage', key: 'coverage', have, need: wanted, done: have >= wanted, href: '/review' };
		}
	}
}

/**
 * The path as it stands. `reached` are the stages reached before, as the
 * caller keeps them. The stages build on each other: the current stage is the
 * end of the unbroken run of stages met now or reached before, so a learner
 * placed past every deck still meets the verbs' lessons at Getting around
 * rather than being shown at Reading. Every stage before the current one counts
 * as reached.
 */
export function pathOf(input: PathInput, reached: readonly string[] = []): Path {
	const built = STAGE_IDS.map((id, i) => {
		const criteria = STAGE_NEEDS[id].map((need) => criterion(need, input)).filter((c): c is Criterion => c !== null);
		return { id, n: i + 1, criteria, met: criteria.every((c) => c.done) };
	});
	// A stage reached before carries every stage up to it
	const kept = Math.max(-1, ...built.map((stage, i) => (reached.includes(stage.id) ? i : -1)));
	let furthest = -1;
	for (const [i, stage] of built.entries()) {
		if (!(stage.met || i <= kept)) break;
		furthest = i;
	}
	const stages = built.map((stage, i) => ({ ...stage, reached: i <= furthest }));
	const after = stages[furthest + 1];
	const step = after?.criteria.find((c) => !c.done);
	return {
		stages,
		current: furthest >= 0 ? stages[furthest].id : null,
		// The stage after the current one is not met, so it has a criterion not done
		next: after ? { stage: after.id, criterion: step ?? after.criteria[0] } : null
	};
}

/** The stages reached, to keep for next time: those of `path`, with what was kept before. */
export function reachedStages(path: Path, before: readonly string[] = []): StageId[] {
	return STAGE_IDS.filter((id) => before.includes(id) || path.stages.some((stage) => stage.id === id && stage.reached));
}

/**
 * The known words of each deck of common words, counted as the Learn page's
 * vocabulary card counts them (stateOf: 21 days' stability is known). A deck
 * not yet fetched is left out, and `pathOf` takes it as none known.
 */
export function deckCounts(
	cards: ReadonlyMap<string, ReviewCard>, common: ReadonlyMap<string, readonly string[]>, now: number
): Partial<Record<CommonDeckId, DeckCount>> {
	const counts: Partial<Record<CommonDeckId, DeckCount>> = {};
	for (const { id } of COMMON_DECKS) {
		const words = common.get(id);
		if (!words) continue;
		const known = words.filter((word) => pointState(cards.get(word), now) === 'known').length;
		counts[id] = { known, total: words.length };
	}
	return counts;
}

/**
 * The coverage to give `pathOf`: the learner's own, or what the words before
 * the placement start would cover (`milestones` in coverage.ts, given as
 * `placedShare`), whichever is more.
 */
export const pathCoverage = (own: number, placedShare = 0): number => Math.max(own, placedShare);

/**
 * The stage the learner is working towards, for the path card: the one after
 * the current, or the last when every stage is reached.
 */
export function workingStage(path: Path): Stage {
	const at = path.current ? STAGE_IDS.indexOf(path.current) + 1 : 0;
	return path.stages[Math.min(at, path.stages.length - 1)];
}

/** What the pages hold, as `learnerInput` needs it. */
export interface LearnerState {
	cards: ReadonlyMap<string, ReviewCard>;
	/** The decks of common words fetched so far. */
	common: ReadonlyMap<string, readonly string[]>;
	/** The coverage table, once fetched; without it the coverage criteria are left out. */
	frequency: CoverageTable | null;
	letters: PathInput['letters'];
	start: number;
	/** The grammar rules that have sentences. */
	offered: readonly string[];
	placed: ReadonlySet<string>;
	now: number;
}

/** The path's input from what /learn and /placement hold. Texts are left out until there are stories. */
export function learnerInput(state: LearnerState): PathInput {
	const { cards, common, frequency, letters, start, offered, placed, now } = state;
	const held = (point: Point) => pointState(cards.get(cardKey(point.id)), now);
	return {
		letters,
		decks: deckCounts(cards, common, now),
		start,
		lessons: lessonRows(offered, held, placed),
		...(frequency
			? {
					coverage: pathCoverage(
						coverage(frequency, cards, now).known, start > 1 ? milestones(frequency, [start - 1])[0] : 0)
				}
			: {})
	};
}
