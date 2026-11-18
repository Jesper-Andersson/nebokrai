// The grammar-point pages' text and links (src/lib/practice/intros.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	INTROS, LESSON_INTROS, PRESENT_EXAMPLES, PRESENT_TENSE, begun, examplesOf, introOf, lessonHref, markedParts,
	LEVELS, endingStart, lessonOfPoint, withTerms, lessonsWithCase, parts, prepositionCases, seededRandom, TOPICS, type LinkedLesson
} from '../src/lib/practice/intros.ts';
import { LESSONS } from '../src/lib/practice/lessons.ts';

test('every lesson has a page, and every page is a lesson or the present tense', () => {
	for (const id of LESSON_INTROS) assert.ok(introOf(id), `no page for ${id}`);
	for (const intro of INTROS) {
		assert.ok(intro.id === PRESENT_TENSE || LESSONS.some((lesson) => lesson.id === intro.id), `${intro.id} is no lesson`);
	}
	assert.equal(new Set(INTROS.map((intro) => intro.id)).size, INTROS.length);
});

test('every text closes its braces and brackets, and marks only Ukrainian', () => {
	const texts = INTROS.flatMap((intro) => [intro.lead, intro.example, ...intro.notes.map((note) => note.body)]);
	for (const text of texts) {
		let depth = 0;
		let inMark = false;
		for (const char of text) {
			if (char === '{') depth++;
			if (char === '}') depth--;
			if (char === '[') {
				assert.equal(depth, 1, `a mark outside Ukrainian: ${text}`);
				inMark = true;
			}
			if (char === ']') inMark = false;
			assert.ok(depth === 0 || depth === 1, `braces nest: ${text}`);
		}
		assert.equal(depth, 0, `a brace left open: ${text}`);
		assert.equal(inMark, false, `a bracket left open: ${text}`);
		// Every Ukrainian part is Cyrillic, so a slip of the markup shows
		for (const part of parts(text).filter((each) => each.uk)) assert.match(part.text, /[а-яіїєґ]|^[\s→+,.0-9-]*$/i, text);
	}
});

test('the index lists every point once, each with a pattern and an example', () => {
	const listed = TOPICS.flatMap((topic) => topic.points);
	assert.deepEqual([...listed].sort(), INTROS.map((intro) => intro.id).sort());
	for (const intro of INTROS) {
		assert.ok(intro.pattern.trim(), `${intro.id} has no pattern`);
		assert.ok(parts(intro.example).some((part) => part.uk), `${intro.id}'s example has no Ukrainian`);
	}
});

test('every point has a CEFR level, and each group lists them from the easiest up', () => {
	for (const intro of INTROS) assert.ok((LEVELS as readonly string[]).includes(intro.level), `${intro.id}: ${intro.level}`);
	for (const topic of TOPICS) {
		const ranks = topic.points.map((id) => LEVELS.indexOf(introOf(id)!.level));
		assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), topic.id);
	}
	// The verbs' lessons keep their own order within a level
	const verbs = TOPICS.find((topic) => topic.id === 'verb-cases')!.points.filter((id) => introOf(id)!.level === 'A2');
	const lessonOrder = LESSONS.map((lesson) => lesson.id).filter((id) => verbs.includes(id));
	assert.deepEqual(verbs, lessonOrder);
	assert.equal(introOf('where')!.level, 'A1');
	assert.equal(introOf('gov-gen')!.level, 'B1');
});

test('every page cites one or two sources, each a titled https address', () => {
	for (const intro of INTROS) {
		assert.ok(intro.sources.length >= 1 && intro.sources.length <= 2, `${intro.id} cites ${intro.sources.length}`);
		for (const source of intro.sources) {
			assert.match(source.url, /^https:\/\/[^\s]+$/, intro.id);
			assert.match(source.title, /\S: \S/, `${intro.id}: "${source.title}" names no site`);
		}
		assert.equal(new Set(intro.sources.map((source) => source.url)).size, intro.sources.length, `${intro.id} cites a page twice`);
	}
});

test("a preposition's word page names its cases and the lesson of each", () => {
	assert.deepEqual(prepositionCases('у'), [{ case: 'locative', lesson: 'where' }, { case: 'accusative', lesson: 'where-to' }]);
	assert.deepEqual(prepositionCases('в'), prepositionCases('у'));
	assert.deepEqual(prepositionCases('зі'), [{ case: 'instrumental', lesson: 'with-from' }, { case: 'genitive', lesson: 'with-from' }]);
	assert.deepEqual(prepositionCases('за').map((each) => each.lesson), ['for-about', 'around']);
	assert.deepEqual(prepositionCases('стіл'), []);
	assert.equal(lessonOfPoint('do-gen'), 'where-to');
	assert.equal(lessonOfPoint('nope'), undefined);
});

test('the glossary leads each case to the lessons that ask for it', () => {
	assert.deepEqual(lessonsWithCase('locative').slice(0, 1), ['where']);
	assert.ok(lessonsWithCase('dative').includes('gov-dat'));
	for (const kase of ['genitive', 'dative', 'accusative', 'instrumental', 'locative']) assert.ok(lessonsWithCase(kase).length, kase);
	assert.deepEqual(lessonsWithCase('vocative'), []);
});

test("an example marks only the ending that differs from the noun's dictionary form", () => {
	assert.equal(endingStart('дому', 'дім'), 1);
	assert.equal(endingStart('школи', 'школа'), 4);
	assert.equal(endingStart('Школи', 'шко́ла'), 4);
	assert.equal(endingStart('місто', 'місто'), 5);
});

test('case names in a lead become glossary terms', () => {
	assert.deepEqual(withTerms(parts('use {у} with the locative case')), [
		{ text: 'use ' }, { text: 'у', uk: true }, { text: ' with the ' }, { text: 'locative', term: 'locative' }, { text: ' case' }
	]);
	assert.deepEqual(withTerms(parts('Accusative')), [{ text: 'Accusative', term: 'accusative' }]);
});

test('a text is cut into English, Ukrainian and the marked part', () => {
	assert.deepEqual(parts('use {у міст[і]} here'), [
		{ text: 'use ' },
		{ text: 'у міст', uk: true },
		{ text: 'і', uk: true, mark: true },
		{ text: ' here' }
	]);
	assert.deepEqual(markedParts('Я чита[ю].'), [
		{ text: 'Я чита', uk: true },
		{ text: 'ю', uk: true, mark: true },
		{ text: '.', uk: true }
	]);
	for (const example of PRESENT_EXAMPLES) assert.ok(markedParts(example.uk).some((part) => part.mark), example.uk);
});

const lesson = (id: string, group: LinkedLesson['group'], states: LinkedLesson['points'][number]['state'][], placed = false): LinkedLesson =>
	({ id, group, points: states.map((state) => ({ state })), placed });

test('a lesson not begun opens its page; a begun or placed one starts the round', () => {
	const where = lesson('where', 'preposition', ['new', 'new']);
	const begunWhere = lesson('where', 'preposition', ['new', 'learning']);
	const placedWhere = lesson('where', 'preposition', ['new', 'new'], true);
	assert.equal(lessonHref(where, [where]), '/grammar/where');
	assert.equal(lessonHref(begunWhere, [begunWhere]), '/practice?lesson=where');
	assert.equal(lessonHref(placedWhere, [placedWhere]), '/practice?lesson=where');
	assert.equal(begun(lesson('x', 'preposition', ['weak'])), true);
});

test('the first verb lesson opens the present tense, and later ones their own page', () => {
	const first = lesson('gov-na-acc', 'government', ['new']);
	const second = lesson('gov-ins', 'government', ['new']);
	assert.equal(lessonHref(first, [first, second]), '/grammar/present-tense?next=gov-na-acc');
	assert.equal(lessonHref(second, [first, second]), '/grammar/present-tense?next=gov-ins');
	const begunFirst = lesson('gov-na-acc', 'government', ['known']);
	assert.equal(lessonHref(second, [begunFirst, second]), '/grammar/gov-ins');
});

test('examples: two to a rule, real sentences first, none twice', () => {
	const gap = (point: string, uk: string, tatoeba_id = 1) => ({ point, uk, en: '', start: 0, length: 1, word: 'дім', tatoeba_id });
	const out = examplesOf([
		gap('a', 'made', 0), gap('a', 'one'), gap('a', 'one'), gap('a', 'two'), gap('a', 'three'), gap('b', 'four')
	]);
	assert.deepEqual(out.map((example) => example.uk), ['one', 'two', 'four']);
	assert.deepEqual(Object.keys(out[0]).sort(), ['en', 'length', 'point', 'start', 'tatoeba_id', 'uk', 'word']);
});

test('the same seed draws the same numbers', () => {
	const a = seededRandom('where');
	const b = seededRandom('where');
	const drawn = [a(), a(), a()];
	assert.deepEqual([b(), b(), b()], drawn);
	for (const x of drawn) assert.ok(x >= 0 && x < 1);
	assert.notEqual(seededRandom('around')(), drawn[0]);
});
