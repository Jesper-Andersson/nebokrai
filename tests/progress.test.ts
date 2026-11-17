// The progress records kept beside the cards (src/lib/review/progress.ts):
// reading them defensively and joining two copies. Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_START } from '../src/lib/placement.ts';
import {
	PLACEMENT_KEPT, addResult, mergeAlphabet, mergeReading, mergeRecords, parseAlphabet, parsePlacement, parseReading,
	parseRecords, placedOf, startOf, undoResult, type AlphabetRecord, type PlacementResult
} from '../src/lib/review/progress.ts';

const T0 = 1_800_000_000_000;
const result = (at: number, start: number, placed: string[] = []): PlacementResult =>
	({ at, size: start - 1, start, reliable: true, placed });

test('a placement record is read defensively', () => {
	assert.equal(parsePlacement('x', T0), null);
	const sent = {
		results: [
			// From the future, with a lesson that does not exist and one twice
			{ at: T0 + 999, size: 1000, start: 1001, reliable: true, placed: ['where', 'made-up', 'where'] },
			// Past the decks
			{ at: T0, size: 900, start: 99999, reliable: true, placed: [] },
			// Unreliable: placed nowhere
			{ at: T0, size: 400, start: 401, reliable: false, placed: ['where'] },
			// Beyond the three kept
			{ at: T0, size: 1, start: 2, reliable: true, placed: [] }
		],
		updated_at: T0 + 5
	};
	assert.deepEqual(parsePlacement(sent, T0), {
		results: [
			{ at: T0, size: 1000, start: 1001, reliable: true, placed: ['where'] },
			{ at: T0, size: 400, start: 1, reliable: false, placed: [] }
		],
		updated_at: T0
	});
	assert.equal(MAX_START, 2001);
});

test('a retake replaces the result in force, three are kept, and an undo brings the one before back', () => {
	let record = addResult(undefined, result(T0, 501), T0);
	assert.equal(startOf(record), 501);
	for (let i = 1; i <= 3; i++) record = addResult(record, result(T0 + i, 1001, ['where']), T0 + i);
	assert.equal(record.results.length, PLACEMENT_KEPT);
	assert.deepEqual([startOf(record), [...placedOf(record)]], [1001, ['where']]);
	const undone = undoResult(addResult(record, result(T0 + 9, 2001), T0 + 9), T0 + 10);
	assert.deepEqual([startOf(undone), undone.updated_at], [1001, T0 + 10]);
	assert.deepEqual([startOf(undefined), placedOf(undefined).size], [1, 0]);
	assert.equal(startOf({ results: [{ ...result(T0, 1001), reliable: false }], updated_at: T0 }), 1);
});

test('the placement record changed later wins whole, an undo included', () => {
	const a = addResult(undefined, result(T0, 1001), T0);
	const undone = undoResult(a, T0 + 1);
	assert.deepEqual(mergeRecords({ placement: a }, { placement: undone }).placement, undone);
	assert.deepEqual(mergeRecords({ placement: undone }, { placement: a }).placement, undone);
	assert.deepEqual(mergeRecords({}, { placement: a }), { placement: a });
});

const alphabet = (letters: AlphabetRecord['letters'], updated_at: number, cleared_at = 0, skipped = false): AlphabetRecord =>
	({ letters, skipped, cleared_at, updated_at });

test('letters are joined letter by letter, the copy asked more often winning, and a clear wins', () => {
	const phone = alphabet({ ж: { box: 3, seen: 8, right: 7 }, ш: { box: 1, seen: 2, right: 1 } }, T0 + 10);
	const laptop = alphabet({ ж: { box: 1, seen: 3, right: 2 }, щ: { box: 2, seen: 4, right: 3 } }, T0 + 20, 0, true);
	const both = mergeAlphabet(phone, laptop);
	assert.deepEqual(both.letters,
		{ ж: { box: 3, seen: 8, right: 7 }, ш: { box: 1, seen: 2, right: 1 }, щ: { box: 2, seen: 4, right: 3 } });
	assert.deepEqual([both.skipped, both.updated_at], [true, T0 + 20]);
	assert.deepEqual(mergeAlphabet(laptop, phone), both);

	// Forgotten on the laptop after the phone last practised: the phone's letters go
	const cleared = alphabet({ ф: { box: 0, seen: 1, right: 0 } }, T0 + 30, T0 + 25);
	assert.deepEqual(mergeAlphabet(phone, cleared).letters, { ф: { box: 0, seen: 1, right: 0 } });
	// Practised on the phone after the clear: kept
	const later = alphabet({ ж: { box: 1, seen: 1, right: 1 } }, T0 + 40);
	assert.deepEqual(mergeAlphabet(cleared, later).letters,
		{ ф: { box: 0, seen: 1, right: 0 }, ж: { box: 1, seen: 1, right: 1 } });
	assert.equal(mergeAlphabet(cleared, later).cleared_at, T0 + 25);

	// Only letters of the alphabet, only counts that can be
	assert.deepEqual(
		parseAlphabet({ letters: { ж: { box: 9, seen: 2, right: 5 }, w: { box: 1, seen: 1, right: 1 } }, updated_at: T0 }, T0),
		alphabet({ ж: { box: 4, seen: 2, right: 2 } }, T0));
});

test('texts read are a union, each with its first reading', () => {
	const a = { texts: { 'kit-i-mysha': { band: 500, at: T0 + 5 } }, updated_at: T0 + 5 };
	const b = { texts: { 'kit-i-mysha': { band: 500, at: T0 }, 'u-misti': { band: 1000, at: T0 + 1 } }, updated_at: T0 + 1 };
	assert.deepEqual(mergeReading(a, b), {
		texts: { 'kit-i-mysha': { band: 500, at: T0 }, 'u-misti': { band: 1000, at: T0 + 1 } }, updated_at: T0 + 5
	});
	assert.deepEqual(
		parseReading({ texts: { 'Bad Id': { band: 500, at: T0 }, ok: { band: 700, at: T0 }, fine: { band: 2000, at: T0 } } }, T0),
		{ texts: { fine: { band: 2000, at: T0 } }, updated_at: 0 });
	assert.deepEqual(parseRecords({ placement: 1, alphabet: null, reading: { texts: {} } }, T0),
		{ reading: { texts: {}, updated_at: 0 } });
	assert.deepEqual(parseRecords('nothing', T0), {});
});
