// The alphabet trainer's drill: what is asked next, what is offered as an
// answer, and what an answer does to the round and to what is remembered of
// each letter. No Svelte, no browser and no clock: chance comes in as a
// function, so `npm test` runs this file with chance it chose, and a timed
// game can later be built on the same rules.
import { checkLetter, checkWord, checkWritten, misreading, reading } from './answers.ts';
import { GROUP_IDS, type GroupId, LETTERS, isSign, letterInfo, lettersOf } from './letters.ts';

/** A number from 0 up to, not including, 1: Math.random, or a test's own. */
export type Random = () => number;

/** Prompts in a round. */
export const ROUND = 20;
/** Words are asked only when at least this many can be read with the letters chosen. */
export const MIN_WORDS = 4;
/** Answers offered to choose from. */
const CHOICES = 4;

// --- The learner's choices ---

export interface Options {
	/** The groups of letters practised. */
	groups: GroupId[];
	/** Answer by choosing one of four, or by typing. */
	answer: 'choice' | 'type';
	/** `read`: the Cyrillic is shown and its Latin asked. `write`: the other way round, letters only. */
	direction: 'read' | 'write';
	content: 'letters' | 'words' | 'both';
	/** Play the recording when a letter or word has been answered. */
	sound: boolean;
}

export const DEFAULT_OPTIONS: Options = {
	groups: ['same'], answer: 'choice', direction: 'read', content: 'letters', sound: true
};

const oneOf = <T extends string>(value: unknown, all: readonly T[], otherwise: T): T =>
	all.includes(value as T) ? (value as T) : otherwise;

/** Read the choices from storage: the default for anything missing or malformed. */
export function parseOptions(value: unknown): Options {
	if (!value || typeof value !== 'object') return DEFAULT_OPTIONS;
	const { groups, answer, direction, content, sound } = value as Record<string, unknown>;
	const chosen = Array.isArray(groups) ? GROUP_IDS.filter((id) => groups.includes(id)) : [];
	return {
		groups: chosen.length ? chosen : DEFAULT_OPTIONS.groups,
		answer: oneOf(answer, ['choice', 'type'], DEFAULT_OPTIONS.answer),
		direction: oneOf(direction, ['read', 'write'], DEFAULT_OPTIONS.direction),
		content: oneOf(content, ['letters', 'words', 'both'], DEFAULT_OPTIONS.content),
		sound: typeof sound === 'boolean' ? sound : DEFAULT_OPTIONS.sound
	};
}

// --- What is remembered of each letter ---

/**
 * A letter's box, 0 to 4: up one for a right answer, down two for a wrong
 * one. The lower the box, the oftener the letter is asked.
 */
export interface Mark {
	box: number;
	/** Times asked, and times answered rightly. */
	seen: number;
	right: number;
}

export type Progress = Readonly<Record<string, Mark>>;

const TOP_BOX = 4;
/** From this box up a letter counts as known. */
export const KNOWN_BOX = 3;
/** How much likelier than a letter in the top box a letter in each box is to be asked. */
const WEIGHTS = [8, 5, 3, 2, 1];
const COUNT_MAX = 1_000_000;

const whole = (value: unknown, max: number): number =>
	Number.isInteger(value) && (value as number) >= 0 ? Math.min(value as number, max) : 0;

/** Read the progress from storage: only letters of the alphabet, only counts that can be. */
export function parseProgress(value: unknown): Progress {
	const progress: Record<string, Mark> = {};
	if (!value || typeof value !== 'object') return progress;
	for (const { letter } of LETTERS) {
		const mark = (value as Record<string, unknown>)[letter];
		if (!mark || typeof mark !== 'object') continue;
		const { box, seen, right } = mark as Record<string, unknown>;
		const times = whole(seen, COUNT_MAX);
		if (times) progress[letter] = { box: whole(box, TOP_BOX), seen: times, right: whole(right, times) };
	}
	return progress;
}

export type LetterState = 'new' | 'learning' | 'known';

export function stateOf(mark: Mark | undefined): LetterState {
	if (!mark?.seen) return 'new';
	return mark.box >= KNOWN_BOX ? 'known' : 'learning';
}

/** How many of `letters` are known. */
export function knownAmong(progress: Progress, letters: readonly string[]): number {
	return letters.filter((letter) => stateOf(progress[letter]) === 'known').length;
}

// --- What may be asked ---

/** One thing asked: a letter (lower case), or a word in its plain spelling. */
export interface Prompt {
	kind: 'letter' | 'word';
	item: string;
}

const same = (a: Prompt | null, b: Prompt): boolean => a !== null && a.kind === b.kind && a.item === b.item;

/**
 * The words of `words` that can be read with `letters` alone, and are neither
 * a bare letter (і, в) nor long enough to be a labour: two to seven letters.
 */
export function readable(words: readonly string[], letters: readonly string[]): string[] {
	const known = new Set(letters);
	return words.filter((word) => {
		const chars = [...word];
		return chars.length >= 2 && chars.length <= 7 && chars.every((ch) => known.has(ch));
	});
}

/** The letters and words a round draws on. Either may be empty, never both. */
export interface Pool {
	letters: string[];
	words: string[];
}

/**
 * What the learner's choices come to, given the words there are to read
 * (commonest first). Words are read, never written, and need MIN_WORDS to
 * choose among; where they cannot be asked, the letters are. The signs have
 * no Latin to be shown, so they are not asked the other way round.
 */
export function poolFor(options: Options, words: readonly string[]): Pool {
	const letters = lettersOf(options.groups);
	if (options.direction === 'write') return { letters: letters.filter((letter) => !isSign(letter)), words: [] };
	const can = options.content === 'letters' ? [] : readable(words, letters);
	if (can.length < MIN_WORDS) return { letters, words: [] };
	return { letters: options.content === 'words' ? [] : letters, words: can };
}

// --- A round ---

export interface Round {
	asked: number;
	right: number;
	wrong: number;
	/** Right answers in a row now, and the longest such run of the round. */
	streak: number;
	best: number;
	/** What was asked last: never asked twice running. */
	last: Prompt | null;
	/** What was answered wrongly and is to come back, once `wait` other prompts have been asked. */
	again: { prompt: Prompt; wait: number }[];
	/** Everything answered wrongly in the round, each once, in the order it was missed. */
	missed: Prompt[];
}

export const newRound = (): Round => ({ asked: 0, right: 0, wrong: 0, streak: 0, best: 0, last: null, again: [], missed: [] });

export const finished = (round: Round): boolean => round.asked >= ROUND;

/** A miss comes back after this many other prompts: soon enough to still remember the answer shown. */
const COMES_BACK = 2;

function weighted<T>(items: readonly T[], weight: (item: T) => number, random: Random): T {
	const weights = items.map(weight);
	let at = random() * weights.reduce((sum, w) => sum + w, 0);
	for (let i = 0; i < items.length; i++) {
		at -= weights[i];
		if (at < 0) return items[i];
	}
	return items[items.length - 1];
}

const weightOf = (progress: Progress, letter: string): number => WEIGHTS[progress[letter]?.box ?? 0] ?? 1;

/**
 * The next prompt. A miss that has waited its turn comes first. Otherwise a
 * letter or a word by the toss of a coin where both are asked: a letter the
 * likelier the lower its box, a word the likelier the weaker its weakest
 * letter. Never what was asked last, nor a miss still waiting to come back
 * (chance would bring it back at once, with the answer still on the screen),
 * unless there is nothing else.
 */
export function next(round: Round, pool: Pool, progress: Progress, random: Random): Prompt {
	const back = round.again.find((entry) => entry.wait <= 0 && !same(round.last, entry.prompt));
	if (back) return back.prompt;

	const fresh = (kind: Prompt['kind'], items: string[]): string[] => {
		const held = (prompt: Prompt) => same(round.last, prompt) || round.again.some((entry) => same(entry.prompt, prompt));
		const others = items.filter((item) => !held({ kind, item }));
		return others.length ? others : items;
	};
	const word = pool.words.length > 0 && (pool.letters.length === 0 || random() < 0.5);
	if (word) {
		const item = weighted(
			fresh('word', pool.words),
			(w) => Math.max(...[...w].map((letter) => weightOf(progress, letter))),
			random);
		return { kind: 'word', item };
	}
	return { kind: 'letter', item: weighted(fresh('letter', pool.letters), (l) => weightOf(progress, l), random) };
}

/**
 * The round and the progress after an answer. Only a letter's own prompt
 * moves its box: a word read wrongly does not say which letter was at fault.
 */
export function grade(
	round: Round, progress: Progress, prompt: Prompt, correct: boolean
): { round: Round; progress: Progress } {
	const streak = correct ? round.streak + 1 : 0;
	const again = round.again
		.filter((entry) => !same(prompt, entry.prompt))
		.map((entry) => ({ ...entry, wait: entry.wait - 1 }));
	if (!correct) again.push({ prompt, wait: COMES_BACK });

	let marks = progress;
	if (prompt.kind === 'letter') {
		const had = progress[prompt.item] ?? { box: 0, seen: 0, right: 0 };
		marks = {
			...progress,
			[prompt.item]: {
				box: correct ? Math.min(TOP_BOX, had.box + 1) : Math.max(0, had.box - 2),
				seen: Math.min(COUNT_MAX, had.seen + 1),
				right: Math.min(COUNT_MAX, had.right + (correct ? 1 : 0))
			}
		};
	}
	return {
		round: {
			asked: round.asked + 1,
			right: round.right + (correct ? 1 : 0),
			wrong: round.wrong + (correct ? 0 : 1),
			streak,
			best: Math.max(round.best, streak),
			last: prompt,
			again,
			missed: correct || round.missed.some((p) => same(p, prompt)) ? round.missed : [...round.missed, prompt]
		},
		progress: marks
	};
}

// --- The answers offered ---

function shuffled<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * The right answer among the choices, as `choices` gives them: for a letter
 * the letter itself (the page prints its Latin, or the letter, by the
 * direction), for a word its reading.
 */
export const answerOf = (prompt: Prompt): string => (prompt.kind === 'letter' ? prompt.item : reading(prompt.item));

/** What a letter is told apart by among the choices: its Latin when read, itself when written or a sign. */
const shown = (letter: string, direction: Options['direction']): string =>
	direction === 'read' ? letterInfo(letter)?.latin || letter : letter;

/**
 * Four answers to choose from, the right one among them, in an order of
 * chance. For a letter: the letters it is taken for, then others being
 * practised, then any; never two that would be printed alike (и and й are
 * both "y"), nor a letter with the same Latin as the answer; a sign only
 * beside another sign. For a word: its misreading by the look of the letters
 * (вода as "boda"), then the readings of other words nearest it in length.
 * Fewer than four when there is not that much to tell apart.
 */
export function choices(prompt: Prompt, direction: Options['direction'], pool: Pool, random: Random): string[] {
	const right = answerOf(prompt);
	const picked = [right];

	if (prompt.kind === 'letter') {
		const info = letterInfo(prompt.item);
		const sign = isSign(prompt.item);
		const labels = new Set([shown(prompt.item, direction)]);
		const candidates = [
			...shuffled(info?.confusable ?? [], random),
			...shuffled(pool.letters, random),
			...shuffled(LETTERS.map((letter) => letter.letter), random)
		];
		for (const letter of candidates) {
			if (picked.length === CHOICES) break;
			const other = letterInfo(letter);
			if (!other || (isSign(letter) && !sign)) continue;
			if (direction === 'write' && (isSign(letter) || other.latin === info?.latin)) continue;
			const label = shown(letter, direction);
			if (labels.has(label)) continue;
			labels.add(label);
			picked.push(letter);
		}
	} else {
		const length = [...prompt.item].length;
		const others = shuffled(pool.words, random)
			.sort((a, b) => Math.abs([...a].length - length) - Math.abs([...b].length - length))
			.map(reading);
		const wrong = misreading(prompt.item);
		for (const candidate of [...(wrong ? [wrong] : []), ...others]) {
			if (picked.length === CHOICES) break;
			if (!picked.includes(candidate)) picked.push(candidate);
		}
	}
	return shuffled(picked, random);
}

/** A sign cannot be typed as Latin, so it is always answered by choosing. */
export function byChoice(prompt: Prompt, options: Options): boolean {
	return options.answer === 'choice' || (prompt.kind === 'letter' && isSign(prompt.item));
}

/** Whether `given` answers the prompt: the choice pressed, or what was typed. */
export function isRight(prompt: Prompt, options: Options, given: string): boolean {
	if (byChoice(prompt, options)) return given === answerOf(prompt);
	if (prompt.kind === 'word') return checkWord(prompt.item, given);
	return options.direction === 'read' ? checkLetter(prompt.item, given) : checkWritten(prompt.item, given);
}
