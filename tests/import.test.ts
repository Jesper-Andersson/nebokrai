// Importing word lists (src/lib/import/): Anki packages with their progress,
// and text and CSV files. Each Anki package here is built by the test, in
// both the current layout (zstd-compressed collection.anki21b) and the older
// one (collection.anki2), with a media file that must never be read. The last
// test matches words against nebokrai.db and is skipped without it.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { crc32, deflateRawSync, zstdCompressSync } from 'node:zlib';
import initSqlJs from 'sql.js';
import { decompress } from 'fzstd';

import { AnkiError, fromSqlJs, patchCollation, readAnki, type AnkiCard } from '../src/lib/import/anki.ts';
import { MEANING_MAX, cyrillicTwins, fieldText, meaningOf, wordsOf } from '../src/lib/import/clean.ts';
import { ankiDays, ankiItems, mainDeck, progressOf, ukrainianFields } from '../src/lib/import/deck.ts';
import { MISSING_MAX, cleanMissing } from '../src/lib/import/missing.ts';
import { planImport, wordsToMatch, type Matches } from '../src/lib/import/plan.ts';
import { readText } from '../src/lib/import/text.ts';
import { parseCards } from '../src/lib/review/cards.ts';
import { dayKey } from '../src/lib/review/days.ts';
import { DAY, LEARNING, REVIEW, answer, newCard } from '../src/lib/review/fsrs.ts';
import { matchWords } from '../src/lib/search/match.ts';
import { openLocal } from './local-db.ts';

const SQL = await initSqlJs();
const open = fromSqlJs(SQL);

// Midday local time, 2026-11-12, so that no review crosses the 04:00 rollover
const NOW = new Date(2026, 10, 12, 12, 0).getTime();
const CREATED = new Date(2023, 0, 1, 4, 0).getTime(); // the collection's start: 04:00, as Anki sets it
const daysSince = (ms: number) => Math.round((ms - CREATED) / DAY);

/** A zip with the given entries, the way Anki writes one: stored or deflated. */
function zip(files: Record<string, Uint8Array>): Uint8Array<ArrayBuffer> {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const [name, data] of Object.entries(files)) {
		const nameBytes = Buffer.from(name);
		const packed = deflateRawSync(data);
		const head = Buffer.alloc(30);
		head.writeUInt32LE(0x04034b50, 0);
		head.writeUInt16LE(8, 8);
		head.writeUInt32LE(crc32(data), 14);
		head.writeUInt32LE(packed.length, 18);
		head.writeUInt32LE(data.length, 22);
		head.writeUInt16LE(nameBytes.length, 26);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(crc32(data), 16);
		central.writeUInt32LE(packed.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBytes.length, 28);
		central.writeUInt32LE(offset, 42);
		locals.push(head, nameBytes, packed);
		centrals.push(central, nameBytes);
		offset += 30 + nameBytes.length + packed.length;
	}
	const dir = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(Object.keys(files).length, 8);
	end.writeUInt16LE(Object.keys(files).length, 10);
	end.writeUInt32LE(dir.length, 12);
	end.writeUInt32LE(offset, 16);
	return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

const NOTE_TYPE = 1700000000001;
const DECK = 1700000000002;
const at = (daysAgo: number) => NOW - daysAgo * DAY;

/**
 * A small collection:
 *   1 вода: reviewed with FSRS, two cards (front and reverse), the reverse answered last
 *   2 дзвонити, задзвонити (1): a review card due today
 *   3 картинка: still being learnt, due at a time
 *   4 ґоблін: new
 *   5 автобус: suspended
 *   6 хліб: reviewed before FSRS was on (no memory), replayed
 */
function buildCollection(layout: 'new' | 'old'): Uint8Array {
	const dir = mkdtempSync(join(tmpdir(), 'nebokrai-anki-'));
	const path = join(dir, 'collection.db');
	const db = new DatabaseSync(path);
	const fields = ['Front', 'Back', 'Example'];
	db.exec(`CREATE TABLE col (id integer primary key, crt integer, models text, decks text)`);
	db.exec(`CREATE TABLE notes (id integer primary key, mid integer, flds text)`);
	db.exec(`CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer,
		due integer, ivl integer, reps integer, lapses integer, data text)`);
	db.exec(`CREATE TABLE revlog (id integer primary key, cid integer, ease integer, type integer)`);
	if (layout === 'new') {
		// Written with nocase and patched back to unicase below, as Anki's own file has it
		db.exec(`CREATE TABLE notetypes (id integer primary key, name text not null COLLATE nocase )`);
		db.exec(`CREATE TABLE fields (ntid integer, ord integer, name text not null COLLATE nocase , PRIMARY KEY (ntid, ord))`);
		db.exec(`CREATE TABLE decks (id integer primary key, name text not null COLLATE nocase )`);
		db.prepare('INSERT INTO col VALUES (1, ?, ?, ?)').run(CREATED / 1000, '', '');
		db.prepare('INSERT INTO notetypes VALUES (?, ?)').run(NOTE_TYPE, 'Basic (and reversed card)');
		fields.forEach((name, ord) => db.prepare('INSERT INTO fields VALUES (?, ?, ?)').run(NOTE_TYPE, ord, name));
		db.prepare('INSERT INTO decks VALUES (?, ?)').run(DECK, 'Мови\x1fУкраїнська');
		db.prepare('INSERT INTO decks VALUES (1, ?)').run('Default');
	} else {
		const models = { [NOTE_TYPE]: { id: NOTE_TYPE, name: 'Basic', flds: fields.map((name, ord) => ({ name, ord })) } };
		const decks = { [DECK]: { id: DECK, name: 'Мови::Українська' }, 1: { id: 1, name: 'Default' } };
		db.prepare('INSERT INTO col VALUES (1, ?, ?, ?)').run(CREATED / 1000, JSON.stringify(models), JSON.stringify(decks));
	}
	const note = (id: number, front: string, back: string) =>
		db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run(id, NOTE_TYPE, [front, back, ''].join('\x1f'));
	const card = (id: number, nid: number, ord: number, type: number, queue: number, due: number, ivl: number,
		reps: number, lapses: number, data: string) =>
		db.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
			.run(id, nid, DECK, ord, type, queue, due, ivl, reps, lapses, data);
	let logId = 0;
	const log = (cid: number, when: number, ease: number, type = 1) =>
		db.prepare('INSERT INTO revlog VALUES (?, ?, ?, ?)').run(when + ++logId, cid, ease, type);

	note(1, 'вода<br>[sound:вода.mp3]', '<img src="вода.jpg"><br>water');
	card(11, 1, 0, 2, 2, daysSince(at(-30)), 40, 3, 0, JSON.stringify({ s: 41.5, d: 4.2, dr: 0.9 }));
	card(12, 1, 1, 2, 2, daysSince(at(-60)), 70, 4, 1, JSON.stringify({ s: 75.25, d: 5.5, dr: 0.9 }));
	log(11, at(100), 3, 0); log(11, at(10), 3);
	log(12, at(90), 3, 0); log(12, at(9), 1); log(12, at(5), 3);
	log(12, at(4), 0, 4); // a reschedule by hand: not an answer

	note(2, 'дзвонити, задзвонити (1)', 'to ring');
	card(21, 2, 0, 2, 2, daysSince(at(0)), 12, 5, 0, JSON.stringify({ s: 13, d: 6 }));
	log(21, at(12), 3);

	note(3, 'картинка', 'picture');
	card(31, 3, 0, 1, 1, Math.round((NOW + 10 * 60_000) / 1000), 0, 1, 0, JSON.stringify({ s: 0.4, d: 7 }));
	log(31, NOW - 60_000, 1, 0);

	note(4, 'ґоблін', 'goblin');
	card(41, 4, 0, 0, 0, 7, 0, 0, 0, '');

	note(5, 'автобус', 'bus');
	card(51, 5, 0, 2, -1, daysSince(at(-3)), 20, 2, 0, JSON.stringify({ s: 21, d: 5 }));
	log(51, at(17), 3);

	note(6, 'хліб', 'bread');
	card(61, 6, 0, 2, 2, daysSince(at(-2)), 4, 2, 0, '');
	log(61, at(6), 3, 0); log(61, at(2), 3);
	db.close();

	let bytes: Uint8Array = readFileSync(path);
	rmSync(dir, { recursive: true, force: true });
	if (layout === 'new') {
		const text = Buffer.from(bytes);
		let i = text.indexOf('COLLATE nocase ');
		while (i >= 0) {
			text.write('COLLATE unicase', i);
			i = text.indexOf('COLLATE nocase ', i + 1);
		}
		bytes = text;
	}
	return bytes;
}

function apkg(layout: 'new' | 'old'): Blob {
	const collection = buildCollection(layout);
	const media = new Uint8Array(4096).fill(7);
	const files: Record<string, Uint8Array> =
		layout === 'new'
			? {
				// Anki 23.10 also writes a stub collection.anki2 that says "please update"
				'collection.anki2': new Uint8Array(100),
				'collection.anki21b': zstdCompressSync(collection),
				'0': media,
				media: zstdCompressSync(Buffer.from('{}'))
			}
			: { 'collection.anki2': collection, '0': media, media: Buffer.from('{}') };
	return new Blob([zip(files)]);
}

test('Anki tables become readable once the collation is renamed', () => {
	const text = new TextEncoder().encode('a COLLATE unicase, b COLLATE unicase)');
	const patched = new TextDecoder().decode(patchCollation(text));
	assert.equal(patched, 'a COLLATE nocase , b COLLATE nocase )');
	assert.equal(new TextDecoder().decode(text), 'a COLLATE unicase, b COLLATE unicase)', 'the input is left alone');
});

for (const layout of ['new', 'old'] as const) {
	test(`an Anki package in the ${layout} layout is read`, async () => {
		const col = await readAnki(apkg(layout), open, decompress);
		assert.equal(col.created, CREATED);
		assert.deepEqual(col.noteTypes.map((t) => t.fields), [['Front', 'Back', 'Example']]);
		assert.equal(mainDeck(col), 'Українська');
		assert.equal(col.notes.length, 6);
		assert.equal(col.cards.length, 7);
		const reverse = col.cards.find((c) => c.id === 12)!;
		assert.deepEqual(reverse.memory, { stability: 75.25, difficulty: 5.5 });
		assert.deepEqual(reverse.reviews.map((r) => r.ease), [3, 1, 3], 'the reschedule by hand is left out');
		assert.equal(col.cards.find((c) => c.id === 61)!.memory, null);
	});
}

test('a file that is not an Anki package says why', async () => {
	await assert.rejects(readAnki(new Blob(['вода\nхліб']), open, decompress), (e) => e instanceof AnkiError && e.code === 'unreadable');
	const noCollection = new Blob([zip({ 'notes.txt': Buffer.from('вода') })]);
	await assert.rejects(readAnki(noCollection, open, decompress), (e) => e instanceof AnkiError && e.code === 'no_collection');
});

test('the words of a field, without sound, pictures or notes', () => {
	assert.deepEqual(wordsOf('дзвонити, задзвонити (1)<br>[sound:дзвонити.mp3]'), ['дзвонити', 'задзвонити']);
	assert.deepEqual(wordsOf('автомобіль = авто = машина'), ['автомобіль', 'авто', 'машина']);
	assert.deepEqual(wordsOf('п&#x27;яний'), ["п'яний"]);
	assert.deepEqual(wordsOf('тваринa'), ['тварина'], 'a Latin "a" inside a Ukrainian word');
	assert.deepEqual(wordsOf('Ого!'), ['Ого']);
	assert.deepEqual(wordsOf('ой!!'), ['ой']);
	assert.deepEqual(wordsOf('Що?'), ['Що']);
	assert.deepEqual(wordsOf('Ого! Ура!'), ['Ого', 'Ура']);
	assert.deepEqual(wordsOf('¿Як справи?'), ['Як справи']);
	assert.deepEqual(wordsOf('мати (verb)'), ['мати']);
	assert.deepEqual(wordsOf('будь ласка'), ['будь ласка']);
	assert.deepEqual(wordsOf('-ся'), ['-ся']);
	assert.deepEqual(wordsOf('вода́'), ['вода́'], 'stress marks stay for the match to remove');
	assert.deepEqual(wordsOf('<img src="автобус.jpg"><br>bus'), []);
	assert.deepEqual(wordsOf('Сашко́ ї́здить в шко́лу авто́бусом щодня.'), [], 'a sentence is not a word');
	assert.equal(fieldText('a&nbsp;b &amp; c<div>d</div>'), 'a b & c\nd');
	assert.equal(cyrillicTwins('water'), 'water', 'English is left alone');
});

test('progress comes across from FSRS, from a replay, or as new', async () => {
	const col = await readAnki(apkg('new'), open, decompress);
	const card = (id: number) => col.cards.find((c) => c.id === id)! as AnkiCard;

	const water = progressOf(card(12), col.created, NOW)!;
	assert.equal(water.state, REVIEW);
	assert.equal(water.stability, 75.25);
	assert.equal(water.difficulty, 5.5);
	assert.equal(water.due, CREATED + daysSince(at(-60)) * DAY + 3_600_000, 'the day Anki set, an hour after its rollover');
	assert.equal(water.last_review, card(12).reviews.at(-1)!.at);
	assert.equal(water.added_at, card(12).reviews[0].at, 'added when first studied, not today');
	assert.equal(water.reps, 4);
	assert.equal(water.lapses, 1);

	const learning = progressOf(card(31), col.created, NOW)!;
	assert.equal(learning.state, LEARNING);
	assert.equal(learning.due, Math.round((NOW + 10 * 60_000) / 1000) * 1000, 'a learning card is due at a time');

	assert.equal(progressOf(card(41), col.created, NOW), null, 'a new card has no progress');

	const bread = progressOf(card(61), col.created, NOW)!;
	let replayed = newCard('хліб', card(61).reviews[0].at);
	replayed = answer(answer(replayed, 3, card(61).reviews[0].at), 3, card(61).reviews[1].at);
	const { word: _, ...expected } = replayed;
	assert.deepEqual(bread, expected, 'without FSRS memory the answers are played through this scheduler');

	assert.equal(parseCards([{ ...water, word: 'вода' }, { ...learning, word: 'картинка' }, { ...bread, word: 'хліб' }], NOW).length, 3,
		'what comes across passes the same checks as a synced card');
});

test('one item per note: the Ukrainian field, the card answered last, suspension', async () => {
	const col = await readAnki(apkg('old'), open, decompress);
	assert.deepEqual([...ukrainianFields(col).values()], [0]);
	const items = ankiItems(col, NOW);
	assert.deepEqual(items.map((i) => i.source), [
		'вода', 'дзвонити, задзвонити (1)', 'картинка', 'ґоблін', 'автобус', 'хліб'
	]);
	assert.equal(items[0].progress!.stability, 75.25, 'the reverse card was answered last, so it stands for the note');
	assert.deepEqual(items[1].words, ['дзвонити', 'задзвонити']);
	assert.equal(items[3].progress, null);
	assert.deepEqual(items.map((i) => i.suspended), [false, false, false, false, true, false]);
	assert.equal(items[0].meaning, 'water', 'the English side, without its picture');
	assert.equal(items[2].meaning, 'picture');

	const days = ankiDays(col);
	assert.equal(days[dayKey(at(10))], 1);
	assert.equal(Object.values(days).reduce((a, b) => a + b, 0), 10, 'every answer, without the reschedule');
});

test('the plan: words to save, cards to write, what is left out', async () => {
	const col = await readAnki(apkg('new'), open, decompress);
	const items = ankiItems(col, NOW);
	assert.deepEqual(wordsToMatch(items), ['вода', 'дзвонити', 'задзвонити', 'картинка', 'ґоблін', 'автобус', 'хліб']);
	const matches: Matches = {
		вода: { word: 'вода', suggestions: [] },
		дзвонити: { word: 'дзвонити', suggestions: [] },
		задзвонити: { word: 'задзвонити', suggestions: [] },
		картинка: { word: null, suggestions: ['картина'] },
		ґоблін: { word: null, suggestions: [] },
		автобус: { word: 'автобус', suggestions: [] },
		хліб: { word: 'хліб', suggestions: [] }
	};
	const plan = planImport(items, matches);
	assert.deepEqual(plan.words, ['вода', 'дзвонити', 'задзвонити', 'хліб']);
	assert.deepEqual(plan.cards.map((c) => c.word), ['вода', 'дзвонити', 'задзвонити', 'хліб']);
	assert.equal(plan.cards[1].stability, plan.cards[2].stability, 'each word of a card gets its progress');
	assert.deepEqual(plan.unmatched.map((i) => i.source), ['картинка', 'ґоблін']);
	assert.deepEqual(plan.several.map((i) => i.source), ['дзвонити, задзвонити (1)']);
	assert.deepEqual(plan.suspended.map((i) => i.source), ['автобус']);

	const more = planImport(items, matches, { withSuspended: true, picks: new Map([['картинка', 'картина']]) });
	assert.deepEqual(more.words, ['вода', 'дзвонити', 'задзвонити', 'картина', 'автобус', 'хліб']);
	assert.ok(more.cards.some((c) => c.word === 'картина' && c.state === LEARNING), 'a word picked by hand keeps the progress');
	assert.deepEqual(more.unmatched.map((i) => i.source), ['ґоблін']);

	// Two notes naming one word: the one reviewed later wins
	const twice = planImport([items[0], { ...items[0], progress: { ...items[0].progress!, last_review: NOW, reps: 9 } }], matches);
	assert.equal(twice.cards.length, 1);
	assert.equal(twice.cards[0].reps, 9);

	// Left out by hand: one word of a card, and a whole card that matched nothing
	const fewer = planImport(items, matches, { skipWords: new Set(['задзвонити']), skipItems: new Set(['ґоблін']) });
	assert.deepEqual(fewer.words, ['вода', 'дзвонити', 'хліб']);
	assert.ok(!fewer.cards.some((c) => c.word === 'задзвонити'));
	assert.deepEqual(fewer.unmatched.map((i) => i.source), ['картинка'], 'a card left out is not reported as missing');
	assert.deepEqual(fewer.leftOut.map((i) => i.source), ['ґоблін']);
	const none = planImport(items, matches, { skipItems: new Set(['вода']) });
	assert.ok(!none.words.includes('вода'));
	assert.deepEqual(none.leftOut.map((i) => i.source), ['вода']);
});

test('missing words: Cyrillic only, once each, a bounded list', () => {
	assert.deepEqual(cleanMissing(['картинка', ' ґоблін ', 'картинка', 'hello', '', 7, 'ой']), ['картинка', 'ґоблін', 'ой']);
	assert.deepEqual(cleanMissing(['x'.repeat(101) + 'а']), []);
	assert.equal(cleanMissing('картинка'), null);
	assert.equal(cleanMissing(Array(MISSING_MAX + 1).fill('а')), null);
	assert.deepEqual(cleanMissing(['день   тижня']), ['день тижня']);
});

test('text files: a word to a line, columns, Anki text, this site’s own CSV', () => {
	const lines = readText('вода\r\nавтомобіль, авто\n\nхліб\n');
	assert.deepEqual(lines.items.map((i) => i.words), [['вода'], ['автомобіль', 'авто'], ['хліб']]);
	assert.ok(lines.items.every((i) => i.progress === null));

	const tabs = readText('English\tUkrainian\nwater\tвода\nbread\tхліб́\n');
	assert.equal(tabs.column, 1);
	assert.deepEqual(tabs.items.map((i) => i.source), ['вода', 'хліб́'], 'the row of headings is skipped');

	const semicolons = readText('вода;water\nхліб;bread\n');
	assert.deepEqual(semicolons.items.map((i) => i.source), ['вода', 'хліб']);

	const anki = readText('#separator:tab\n#html:true\n#guid column:1\nnebokrai:Київ\t<b>Ки́їв</b>\tKyiv\nnebokrai:вода\tвода́\twater\n');
	assert.deepEqual(anki.items.map((i) => i.words), [['Київ'], ['вода']], 'the guid names the word exactly');

	const ours = readText('﻿"word","headword","part_of_speech","grammar","meanings"\r\n' +
		'"книга","кни́га","noun","feminine, inanimate","book; volume"\r\n"вода","вода́","noun","feminine","water"\r\n');
	assert.equal(ours.column, 0);
	assert.deepEqual(ours.items.map((i) => i.words), [['книга'], ['вода']]);
	assert.deepEqual(ours.items.map((i) => i.meaning), ['book; volume', 'water'], 'the meanings column, not "noun"');
	assert.deepEqual(semicolons.items.map((i) => i.meaning), ['water', 'bread']);
	assert.deepEqual(lines.items.map((i) => i.meaning), ['', '', '']);
	assert.equal(meaningOf(['<b>' + 'long '.repeat(40) + '</b>']).length, MEANING_MAX);
	assert.equal(meaningOf(['вода', 'дзвонити (to call)']), '', 'a field with Cyrillic in it is not the English side');
});

const skip = existsSync('nebokrai.db') ? false : 'nebokrai.db is missing';

test('written words are matched to dictionary words', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const found = await matchWords(db, ['вода́', 'автобусом', 'київ', 'Київ', 'ыыыыы', 'водаа']);
	assert.equal(found['вода́'].word, 'вода', 'stress marks do not matter');
	assert.equal(found['автобусом'].word, 'автобус', 'an inflected form finds its word');
	assert.equal(found['київ'].word, 'Київ');
	assert.equal(found['Київ'].word, 'Київ');
	assert.equal(found['ыыыыы'].word, null);
	assert.deepEqual(found['водаа'].suggestions, [], 'guesses only when asked');
	const guessed = await matchWords(db, ['водаа'], { suggest: true });
	assert.ok(guessed['водаа'].suggestions.includes('вода'), JSON.stringify(guessed));
	assert.ok(db.queries < 30, `${db.queries} queries`);
});
