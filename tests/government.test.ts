// Run with: npm test
//
// Case government in grammar practice (src/lib/practice/government.ts): the
// list of verbs with the case they ask for, its lessons and questions, and,
// with nebokrai.db in the repo root, the sentences found and made for it
// (data/import_wiktionary.py, add_government).
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { messagesFor } from '../src/lib/i18n.ts';
import { drawGaps, pointCounts } from '../src/lib/practice/gaps.ts';
import {
	GOVERNMENT, NOUN_SETS, PRACTISED, askOf, euphonic, governmentOf, isPractisable, patternOf
} from '../src/lib/practice/government.ts';
import { LESSONS } from '../src/lib/practice/lessons.ts';
import { POINTS, pointOf, ruleOf } from '../src/lib/practice/points.ts';
import { cueParts, type Gap } from '../src/lib/practice/round.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { openLocal } from './local-db.ts';

function seeded(seed = 1) {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) % 2147483648;
		return x / 2147483648;
	};
}

/** The nouns of each set in NOUN_SETS: name -> words. */
const sets = new Map<string, string[]>();
{
	let name = '';
	for (const line of NOUN_SETS.split('\n').map((l) => l.trim()).filter(Boolean)) {
		let rest = line;
		if (line.startsWith('@')) {
			[name, rest] = line.slice(1).split(' = ');
			sets.set(name, []);
		}
		for (const item of rest.split(',').filter((part) => part.trim())) sets.get(name)!.push(item.split(':')[0].trim());
	}
}

test('every practised pattern is a point in a lesson of verbs, named in both languages', () => {
	const lessons = LESSONS.filter((lesson) => lesson.group === 'government');
	assert.deepEqual(lessons.flatMap((lesson) => lesson.points), PRACTISED.map((pattern) => pattern.id));
	for (const lesson of lessons) {
		assert.ok(lesson.points.length <= 6, lesson.id);
		for (const lang of ['en', 'uk'] as const) assert.ok(messagesFor(lang).learn.short[lesson.id], `${lesson.id} ${lang}`);
	}
	for (const pattern of PRACTISED) {
		const point = pointOf(pattern.id);
		assert.equal(point?.kind, 'government', pattern.id);
		assert.ok(point?.en?.startsWith('to ') || pattern.before, pattern.id);
		assert.ok(pattern.nouns.length, `${pattern.id} has nouns for its frames`);
		for (const name of pattern.nouns) assert.ok(sets.has(name), `${pattern.id}: @${name}`);
	}
	assert.equal(new Set(GOVERNMENT.map((pattern) => pattern.id)).size, GOVERNMENT.length);
});

test('a pattern is practised only where its preposition takes two cases', () => {
	for (const pattern of GOVERNMENT) assert.equal(Boolean(pattern.lesson), isPractisable(pattern), pattern.id);
	// до and про ask for one case each: shown on the word page, never asked
	assert.equal(patternOf('dumaty-pro-acc')?.lesson, '');
	assert.equal(pointOf('dumaty-pro-acc'), undefined);
});

test('the question comes from the case, the preposition and who or what it asks about', () => {
	assert.equal(askOf(patternOf('diakuvaty-dat')!), 'кому?');
	assert.equal(askOf(patternOf('diakuvaty-za-acc')!), 'за що?');
	assert.equal(askOf(patternOf('chekaty-na-acc')!), 'на кого? на що?');
	assert.equal(askOf(patternOf('hraty-na-loc')!), 'на чому?');
	assert.equal(askOf(patternOf('pratsiuvaty-ins')!), 'ким?');
	assert.equal(askOf(patternOf('boiatysia-gen')!), 'кого? чого?');
	assert.equal(ruleOf(pointOf('diakuvaty-dat')!), 'дякувати + кому?');
});

test('a word finds its patterns by either aspect', () => {
	assert.deepEqual(governmentOf('подякувати').map((pattern) => pattern.id), ['diakuvaty-dat', 'diakuvaty-za-acc']);
	assert.deepEqual(governmentOf('дякувати').map((pattern) => pattern.id), ['diakuvaty-dat', 'diakuvaty-za-acc']);
	assert.deepEqual(governmentOf('стіл'), []);
});

test('у and в, з, із and зі are chosen by the sounds around them', () => {
	assert.equal(euphonic('граю', 'у', 'теніс'), 'в'); // between vowels
	assert.equal(euphonic('граю', 'у', 'футбол'), 'у'); // before ф
	assert.equal(euphonic('грав', 'у', 'теніс'), 'у'); // between consonants
	assert.equal(euphonic('вірю', 'у', 'свободу'), 'у'); // before в after a consonant
	assert.equal(euphonic('розмовляю', 'з', 'мамою'), 'з');
	assert.equal(euphonic('сварюся', 'з', 'сином'), 'із'); // before с
	assert.equal(euphonic('прощаюся', 'з', 'школою'), 'зі'); // before ш and a consonant
	assert.equal(euphonic('сварюсь', 'з', 'братом'), 'із'); // between consonants
});

test('the verb of a sentence is cut out of the stretch it stands in, to be shown in bold', () => {
	const gap = { uk: 'Я дякую мамі.', start: 8, length: 4, cue_start: 2, cue_length: 5 } as Gap;
	assert.deepEqual(cueParts(gap, 0, gap.start), ['Я ', 'дякую', ' ']);
	assert.deepEqual(cueParts(gap, 12, gap.uk.length), ['.', '', '']);
	const before = { uk: 'Мені подобається.', start: 0, length: 4, cue_start: 5, cue_length: 11 } as Gap;
	assert.deepEqual(cueParts(before, 4, before.uk.length), [' ', 'подобається', '.']);
	assert.deepEqual(cueParts({ uk: 'Кава без цукру.', start: 9, length: 5 } as Gap, 0, 9), ['Кава без ', '', '']);
});

// --- With the database ---------------------------------------------------------

const skip = existsSync('nebokrai.db') ? false : 'nebokrai.db is missing';

test('every lemma is a verb or an adjective, and every partner is on its head line', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	for (const pattern of GOVERNMENT) {
		for (const lemma of pattern.lemmas) {
			const rows = await db.all<{ head_forms: string }>(
				"SELECT head_forms FROM entries WHERE word = ? AND pos IN ('verb', 'adj')",
				[lemma]
			);
			assert.ok(rows.length, `${pattern.id}: ${lemma}`);
		}
		const [first, partner] = pattern.lemmas;
		if (!partner) continue;
		const heads = await db.all<{ head_forms: string }>(
			"SELECT head_forms FROM entries WHERE word = ? AND pos IN ('verb', 'adj')",
			[first]
		);
		const named = heads.flatMap((row) => (JSON.parse(row.head_forms) as { form: string }[]).map((f) => plain(f.form)));
		assert.ok(named.includes(partner), `${pattern.id}: ${partner} beside ${first}`);
	}
});

test("a pattern agrees with the case its Wiktionary meanings note, where they note one", { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const NAMES = ['genitive', 'dative', 'accusative', 'instrumental', 'locative'];
	const full = { gen: 'genitive', dat: 'dative', acc: 'accusative', ins: 'instrumental', loc: 'locative' } as const;
	for (const pattern of GOVERNMENT) {
		const glosses = await db.all<{ gloss: string }>(
			"SELECT s.gloss FROM senses s JOIN entries e ON e.id = s.entry_id WHERE e.word = ? AND e.pos IN ('verb', 'adj')",
			[pattern.lemmas[0]]
		);
		const notes = glosses.map((row) => row.gloss).filter((gloss) => gloss.includes('+') && NAMES.some((n) => gloss.includes(n)));
		if (notes.length) assert.ok(notes.some((note) => note.includes(full[pattern.case])), `${pattern.id}: ${notes.join(' / ')}`);
	}
});

test('every frame noun has the form its pattern asks for', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const full = { gen: 'genitive', dat: 'dative', acc: 'accusative', ins: 'instrumental', loc: 'locative' } as const;
	const missing: string[] = [];
	for (const pattern of PRACTISED) {
		for (const word of pattern.nouns.flatMap((name) => sets.get(name) ?? [])) {
			// A noun named in the plural (шахи, карти) is found by that form
			const own = await db.all<{ id: number }>("SELECT id FROM entries WHERE pos = 'noun' AND word = ?", [word]);
			const ids = own.length
				? own.map((row) => row.id)
				: (await db.all<{ entry_id: number }>(
						`SELECT DISTINCT entry_id FROM forms WHERE plain = ? AND tags LIKE '%"nominative"%' AND tags LIKE '%"plural"%'`,
						[plain(word)]
					)).map((row) => row.entry_id);
			const rows = await db.all<{ n: number }>(
				'SELECT COUNT(*) AS n FROM forms WHERE entry_id IN (SELECT value FROM json_each(?)) AND tags LIKE ?',
				[JSON.stringify(ids), `%"${full[pattern.case]}"%`]
			);
			if (!rows[0].n) missing.push(`${pattern.id}: ${word}`);
		}
	}
	assert.deepEqual(missing, []);
});

test('every practised pattern has twenty sentences, under the id government.ts gives it', { skip }, async () => {
	const counts = await pointCounts(openLocal('nebokrai.db'));
	for (const pattern of PRACTISED) assert.ok((counts[pattern.id] ?? 0) >= 20, pattern.id);
	const offered = POINTS.filter((point) => counts[point.id]).map((point) => point.id);
	assert.ok(offered.includes('diakuvaty-dat'));
});

test('a made sentence spells у or в, з, із or зі as the sounds around it ask', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const rows = await db.all<{ point: string; uk: string; start: number }>(
		'SELECT point, uk, start FROM cloze WHERE tatoeba_id = 0 AND cue_start IS NOT NULL'
	);
	assert.ok(rows.length > 300);
	for (const row of rows) {
		const words = row.uk.slice(0, row.start).trim().split(' ');
		const prep = words.at(-1)!;
		if (!['у', 'в', 'з', 'із', 'зі'].includes(prep)) continue;
		assert.equal(euphonic(words.at(-2)!, prep, row.uk.slice(row.start)), prep, row.uk);
	}
});

test('a verb pattern is drawn with its verb marked and the likeliest wrong case offered', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const gaps = await drawGaps(db, Array(20).fill('diakuvaty-dat'), seeded(3));
	assert.equal(gaps.length, 20);
	const pronouns = new Set(['я', 'ти', 'він', 'вона', 'воно', 'ми', 'ви', 'вони']);
	for (const gap of gaps) {
		assert.equal(typeof gap.cue_start, 'number', gap.uk);
		const verb = gap.uk.slice(gap.cue_start, gap.cue_start! + gap.cue_length!);
		assert.ok(plain(verb).includes('дяку'), gap.uk);
		assert.equal(new Set(gap.choices.map(plain)).size, gap.choices.length, gap.uk);
		if (pronouns.has(gap.word)) {
			// A pronoun's choices are its own forms: тобі beside тебе, never beside мені
			for (const choice of gap.choices) {
				assert.ok(!pronouns.has(plain(choice)) || plain(choice) === gap.word, `${gap.uk}: ${gap.choices}`);
			}
		}
	}
	// ма́мі is offered beside ма́му, the accusative a learner reaches for
	const mama = gaps.find((gap) => gap.word === 'мама');
	if (mama) assert.ok(mama.choices.map(plain).includes('маму'), String(mama.choices));
});
