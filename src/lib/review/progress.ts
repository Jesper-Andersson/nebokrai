// The learner's progress outside the cards, as it is stored and exchanged:
// the placement test's results, the alphabet trainer's letters and the texts
// read. Each is a record of its own, kept in the account as one row
// (user_progress, server/users.ts) and joined with the browser's copy by
// POST /api/review/sync, so letters learnt on a phone are known on the laptop.
//
// Records, not fields of the review settings: the settings are one blob where
// the later copy wins whole, and two browsers learning letters at once must
// both be kept.
//
// Shared by the browser and the server; no imports from SvelteKit.
import { parseProgress as parseLetters, type Mark, type Progress as Letters } from '../alphabet/drill.ts';
import { LESSONS } from '../practice/lessons.ts';
import { MAX_START } from '../placement.ts';

export const PROGRESS_KINDS = ['placement', 'alphabet', 'reading'] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];

// --- Placement ---

/** One sitting of the placement test. */
export interface PlacementResult {
	/** When it was taken (ms). */
	at: number;
	/** Words estimated known among the commonest 5,000. */
	size: number;
	/** The place new common words start from, 1 to MAX_START. */
	start: number;
	reliable: boolean;
	/** Lessons placed out, by id. */
	placed: string[];
}

export interface PlacementRecord {
	/** Newest first, at most PLACEMENT_KEPT. The first is the one in force; none when every result was undone. */
	results: PlacementResult[];
	updated_at: number;
}

/** A retake replaces the result in force, and the last three are kept. */
export const PLACEMENT_KEPT = 3;

// --- Alphabet ---

export interface AlphabetRecord {
	/** By letter, as the trainer keeps them (alphabet/drill.ts). */
	letters: Letters;
	/** The learner said they read Cyrillic already. */
	skipped: boolean;
	/** When every letter was last forgotten (ms), or 0: a copy older than this loses its letters. */
	cleared_at: number;
	updated_at: number;
}

// --- Reading ---

export interface TextMark {
	/** The commonest words the text keeps to: 500, 1000, 2000 or 5000. */
	band: number;
	/** When it was first read to the end (ms). */
	at: number;
}

export interface ReadingRecord {
	/** By the text's id. */
	texts: Record<string, TextMark>;
	updated_at: number;
}

export const MAX_TEXTS = 2000;
const TEXT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TEXT_BANDS = [500, 1000, 2000, 5000];

export interface ProgressRecords {
	placement?: PlacementRecord;
	alphabet?: AlphabetRecord;
	reading?: ReadingRecord;
}

const whole = (x: unknown, min: number, max: number): x is number =>
	Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
/** A time, never after `now`: a clock that runs ahead must not win every later comparison. */
const time = (x: unknown, now: number): number => (whole(x, 1, Number.MAX_SAFE_INTEGER) ? Math.min(x, now) : 0);
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));

// --- Reading what was sent ---

export function parsePlacement(value: unknown, now = Date.now()): PlacementRecord | null {
	if (!isObject(value) || !Array.isArray(value.results)) return null;
	const results: PlacementResult[] = [];
	for (const item of value.results.slice(0, PLACEMENT_KEPT)) {
		if (!isObject(item)) continue;
		const { at, size, start, reliable, placed } = item;
		const when = time(at, now);
		if (!when || !whole(size, 0, 1_000_000) || !whole(start, 1, MAX_START) || typeof reliable !== 'boolean') continue;
		results.push({
			at: when, size, start: reliable ? start : 1, reliable,
			placed: reliable && Array.isArray(placed)
				? [...new Set(placed.filter((id): id is string => typeof id === 'string' && LESSON_IDS.has(id)))]
				: []
		});
	}
	return { results, updated_at: time(value.updated_at, now) };
}

export function parseAlphabet(value: unknown, now = Date.now()): AlphabetRecord | null {
	if (!isObject(value)) return null;
	return {
		letters: parseLetters(value.letters),
		skipped: value.skipped === true,
		cleared_at: time(value.cleared_at, now),
		updated_at: time(value.updated_at, now)
	};
}

export function parseReading(value: unknown, now = Date.now()): ReadingRecord | null {
	if (!isObject(value) || !isObject(value.texts)) return null;
	const texts: Record<string, TextMark> = {};
	for (const [id, mark] of Object.entries(value.texts).slice(0, MAX_TEXTS)) {
		if (!TEXT_ID.test(id) || !isObject(mark) || !TEXT_BANDS.includes(mark.band as number)) continue;
		const at = time(mark.at, now);
		if (at) texts[id] = { band: mark.band as number, at };
	}
	return { texts, updated_at: time(value.updated_at, now) };
}

/** Every record sent, each read as above; a record that is not one is left out. */
export function parseRecords(value: unknown, now = Date.now()): ProgressRecords {
	if (!isObject(value)) return {};
	const records: ProgressRecords = {};
	const placement = parsePlacement(value.placement, now);
	const alphabet = parseAlphabet(value.alphabet, now);
	const reading = parseReading(value.reading, now);
	if (placement) records.placement = placement;
	if (alphabet) records.alphabet = alphabet;
	if (reading) records.reading = reading;
	return records;
}

// --- Joining two copies ---

/** The placement record changed later wins whole: an undo or a retake is a change like any other. */
export function mergePlacement(a: PlacementRecord, b: PlacementRecord): PlacementRecord {
	return b.updated_at > a.updated_at ? b : a;
}

/**
 * Letters by letter, the copy asked more often winning. A copy last changed
 * before the other was cleared loses its letters: what it held was forgotten.
 * Whether the letters are skipped comes from the copy changed later.
 */
export function mergeAlphabet(a: AlphabetRecord, b: AlphabetRecord): AlphabetRecord {
	const cleared = Math.max(a.cleared_at, b.cleared_at);
	const letters: Record<string, Mark> = {};
	for (const side of [a, b]) {
		if (side.updated_at < cleared) continue;
		for (const [letter, mark] of Object.entries(side.letters)) {
			const had = letters[letter];
			if (!had || mark.seen > had.seen) letters[letter] = mark;
		}
	}
	const later = b.updated_at > a.updated_at ? b : a;
	return { letters, skipped: later.skipped, cleared_at: cleared, updated_at: Math.max(a.updated_at, b.updated_at) };
}

/** Every text read in either copy, each with its first reading. */
export function mergeReading(a: ReadingRecord, b: ReadingRecord): ReadingRecord {
	const texts: Record<string, TextMark> = { ...a.texts };
	for (const [id, mark] of Object.entries(b.texts)) {
		const had = texts[id];
		if (!had || mark.at < had.at) texts[id] = mark;
	}
	const kept = Object.entries(texts).sort(([, x], [, y]) => x.at - y.at).slice(0, MAX_TEXTS);
	return { texts: Object.fromEntries(kept), updated_at: Math.max(a.updated_at, b.updated_at) };
}

/** Two copies of every record as one. */
export function mergeRecords(a: ProgressRecords, b: ProgressRecords): ProgressRecords {
	const out: ProgressRecords = {};
	const placement = a.placement && b.placement ? mergePlacement(a.placement, b.placement) : a.placement ?? b.placement;
	const alphabet = a.alphabet && b.alphabet ? mergeAlphabet(a.alphabet, b.alphabet) : a.alphabet ?? b.alphabet;
	const reading = a.reading && b.reading ? mergeReading(a.reading, b.reading) : a.reading ?? b.reading;
	if (placement) out.placement = placement;
	if (alphabet) out.alphabet = alphabet;
	if (reading) out.reading = reading;
	return out;
}

// --- What the record means ---

/** The placement result in force, or null. */
export const placementInForce = (record: PlacementRecord | undefined): PlacementResult | null =>
	record?.results[0] ?? null;

/** Where new common words start: 1 without a reliable placement. */
export const startOf = (record: PlacementRecord | undefined): number => {
	const result = placementInForce(record);
	return result?.reliable ? result.start : 1;
};

/** The lessons placed out by the result in force. */
export const placedOf = (record: PlacementRecord | undefined): ReadonlySet<string> =>
	new Set(placementInForce(record)?.reliable ? placementInForce(record)!.placed : []);

/** The record with a new result in force; the oldest beyond PLACEMENT_KEPT goes. */
export function addResult(record: PlacementRecord | undefined, result: PlacementResult, now: number): PlacementRecord {
	return { results: [result, ...(record?.results ?? [])].slice(0, PLACEMENT_KEPT), updated_at: now };
}

/** The record with the result in force taken back: the one before it, if any, is in force again. */
export function undoResult(record: PlacementRecord, now: number): PlacementRecord {
	return { results: record.results.slice(1), updated_at: now };
}
