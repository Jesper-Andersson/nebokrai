// Run with: npm test
//
// The grammar practice: which points a round asks, how an answer is checked,
// what a round does to a point's schedule, and, with nebokrai.db in the repo
// root, the sentences themselves.
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { messagesFor } from '../src/lib/i18n.ts';
import { MAX_GAPS, drawGaps, pointCounts } from '../src/lib/practice/gaps.ts';
import { LESSONS } from '../src/lib/practice/lessons.ts';
import { COUNTED, drawNumber, isNumberPoint, numberCount, stressLike } from '../src/lib/practice/numbers.ts';
import { POINTS, cardKey, isNumber, isPointKey, pointOf } from '../src/lib/practice/points.ts';
import { plan } from '../src/lib/review/cards.ts';
import { ROUND, checkAnswer, gradePoint, planRound, planWeak, ratingOf, split, stateOf, type Gap } from '../src/lib/practice/round.ts';
import { AGAIN, DAY, GOOD, HARD, LEARNING, REVIEW, answer, newCard, type ReviewCard } from '../src/lib/review/fsrs.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { openLocal } from './local-db.ts';

/** The same numbers every run. */
function seeded(seed = 1) {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) % 2147483648;
		return x / 2147483648;
	};
}

const NOW = Date.UTC(2026, 10, 13, 12);
const ids = POINTS.map((point) => point.id);
/** The points whose sentences are found in the database: the prepositions'. */
const found = POINTS.filter((point) => !isNumber(point)).map((point) => point.id);
const numbers = POINTS.filter(isNumber).map((point) => point.id);

/** Cards for `points`, each answered "Good" until it is under review, the last time `daysAgo` days back. */
function reviewed(points: string[], daysAgo: number): Map<string, ReviewCard> {
	const cards = new Map<string, ReviewCard>();
	for (const id of points) {
		const at = NOW - daysAgo * DAY;
		let card = newCard(cardKey(id), at);
		while (card.state !== REVIEW) card = answer(card, GOOD, at);
		cards.set(card.word, card);
	}
	return cards;
}

test('every point is named once, by a preposition or a number and a case', () => {
	assert.equal(new Set(ids).size, ids.length);
	assert.deepEqual(numbers, ['one-nom', 'few-nom', 'many-gen']);
	for (const point of POINTS) {
		assert.equal(isNumberPoint(point.id), isNumber(point));
		assert.match(point.id, /^[a-z]+-(nom|gen|acc|ins|loc)$/);
		assert.equal(point.id.split('-')[1], point.case.slice(0, 3));
		assert.equal(pointOf(point.id), point);
	}
});

test('the lessons hold every point once, in the order of the points', () => {
	assert.deepEqual(LESSONS.flatMap((lesson) => lesson.points), ids);
	assert.equal(new Set(LESSONS.map((lesson) => lesson.id)).size, LESSONS.length);
	for (const lesson of LESSONS) {
		assert.ok(lesson.points.length, lesson.id);
		for (const lang of ['en', 'uk'] as const) {
			assert.ok(messagesFor(lang).practice.lessons[lesson.id], `${lesson.id} ${lang}`);
			// Its name in a word or two, for the list on /learn
			assert.ok(messagesFor(lang).learn.short[lesson.id], `${lesson.id} ${lang} short`);
		}
	}
});

test('a point keeps its id: progress is kept under it', () => {
	// As shipped on 2026-11-13. A point may be moved to another lesson; an id taken away loses its learners' cards
	const shipped = [
		'u-loc', 'na-loc', 'u-acc', 'na-acc', 'z-ins', 'do-gen', 'one-nom', 'few-nom', 'many-gen', 'z-gen', 'dlia-gen',
		'bez-gen', 'pro-acc', 'vid-gen', 'za-acc', 'za-ins', 'pislia-gen', 'pered-ins', 'bilia-gen', 'cherez-acc',
		'po-loc', 'pid-ins', 'pid-acc', 'nad-ins', 'mizh-ins', 'proty-gen', 'sered-gen'
	];
	for (const id of shipped) assert.ok(pointOf(id), id);
});

test('a first round is two new points, each asked twice running and then mixed', () => {
	const round = planRound(ids, new Map(), NOW, seeded());
	assert.equal(round.length, ROUND);
	assert.deepEqual(round.slice(0, 4), ['u-loc', 'u-loc', 'na-loc', 'na-loc']);
	assert.deepEqual([...new Set(round)].sort(), ['na-loc', 'u-loc']);
	assert.equal(round.filter((id) => id === 'u-loc').length, 5);
});

test('points whose day has come are asked, with two new ones', () => {
	const cards = reviewed(['u-loc', 'na-loc'], 30);
	const round = planRound(ids, cards, NOW, seeded());
	assert.equal(round.length, ROUND);
	assert.deepEqual([...new Set(round)].sort(), ['na-acc', 'na-loc', 'u-acc', 'u-loc']);
	// The new ones open the round
	assert.deepEqual(round.slice(0, 4), ['u-acc', 'u-acc', 'na-acc', 'na-acc']);
});

test('no new point joins a round that is full of due ones', () => {
	const cards = reviewed(ids.slice(0, 6), 30);
	assert.deepEqual([...new Set(planRound(ids, cards, NOW, seeded()))].sort(), ids.slice(0, 6).sort());
});

test('with nothing due and nothing new, the points held least well are practised', () => {
	const cards = reviewed(ids, 0);
	const round = planRound(ids, cards, NOW, seeded());
	assert.equal(round.length, ROUND);
	assert.equal(new Set(round).size, 3);
});

test('a round does not ask one point twice running where it can be helped', () => {
	const cards = reviewed(ids.slice(0, 5), 30);
	const round = planRound(ids.slice(0, 5), cards, NOW, seeded(7));
	for (let i = 1; i < round.length; i++) assert.notEqual(round[i], round[i - 1]);
});

test('a round of one chosen point is that point alone', () => {
	assert.deepEqual(planRound(ids, new Map(), NOW, seeded(), ['bez-gen']), Array(ROUND).fill('bez-gen'));
	assert.deepEqual(planRound(ids, new Map(), NOW, seeded(), ['no-such']), []);
	assert.deepEqual(planRound([], new Map(), NOW, seeded()), []);
});

test("a round of a lesson is that lesson's points, dealt evenly and apart", () => {
	const lesson = LESSONS.find((each) => each.id === 'where-to')!;
	// Two of them met long ago and one never: what is due or new makes no difference here
	const round = planRound(ids, reviewed(['u-acc', 'na-acc'], 30), NOW, seeded(3), lesson.points);
	assert.equal(round.length, ROUND);
	assert.deepEqual([...new Set(round)].sort(), [...lesson.points].sort());
	for (const id of lesson.points) assert.ok(round.filter((each) => each === id).length >= 3, id);
	for (let i = 1; i < round.length; i++) assert.notEqual(round[i], round[i - 1]);
	// A rule with no sentences is left out, not asked
	assert.deepEqual([...new Set(planRound(['u-acc'], new Map(), NOW, seeded(), lesson.points))], ['u-acc']);
});

test('every point has a short example phrase in Ukrainian letters', () => {
	for (const point of POINTS) assert.match(point.example, /^[0-9]* ?[а-щьюяєіїґʼ' ]+$/u, point.id);
	assert.equal(new Set(POINTS.map((point) => point.example)).size, POINTS.length);
});

const SUGAR: Gap = {
	point: 'bez-gen', uk: 'Кава без цукру.', en: 'Coffee without sugar.', start: 9, length: 5, answer: 'цу́кру',
	also: [], number: 'singular', word: 'цукор', headword: 'цу́кор',
	choices: ['цу́кор', 'цу́кру', 'цу́кром', 'цу́крі'], forms: ['цукор', 'цукру', 'цукрові', 'цукром', 'цукрі', 'цукри'],
	tatoeba_id: 1
};

test('a typed answer is right whatever its stress, capitals or apostrophe', () => {
	assert.equal(checkAnswer(SUGAR, 'цукру'), 'right');
	assert.equal(checkAnswer(SUGAR, ' Цу́кру '), 'right');
	assert.equal(checkAnswer({ ...SUGAR, answer: "м'яче́м" }, 'м’ячем'), 'right');
});

test('the right word in the wrong form is told from a wrong word', () => {
	assert.equal(checkAnswer(SUGAR, 'цукор'), 'form');
	assert.equal(checkAnswer(SUGAR, 'цукром'), 'form');
	assert.equal(checkAnswer(SUGAR, 'сіль'), 'wrong');
	assert.equal(checkAnswer(SUGAR, '  '), 'wrong');
});

test('a second spelling of the same case is right', () => {
	const table = { ...SUGAR, answer: 'столі́', also: ['столу'], forms: ['стіл', 'стола', 'столу', 'столі'] };
	assert.equal(checkAnswer(table, 'столу'), 'right');
	assert.equal(checkAnswer(table, 'стола'), 'form');
});

test('a typed answer in Latin letters counts in the national transliteration', () => {
	assert.equal(checkAnswer(SUGAR, 'tsukru'), 'right');
	assert.equal(checkAnswer(SUGAR, ' Tsúkru '), 'right');
	assert.equal(checkAnswer(SUGAR, 'tsukor'), 'form');
	assert.equal(checkAnswer(SUGAR, 'sil'), 'wrong');
	// Exact, not loose: stoly is столи, another case than столі
	const table = { ...SUGAR, answer: 'столі́', also: [], forms: ['стіл', 'стола', 'столі', 'столи'] };
	assert.equal(checkAnswer(table, 'stoli'), 'right');
	assert.equal(checkAnswer(table, 'stoly'), 'form');
});

test('Latin near the word is close: spelled another way, or not finished', () => {
	assert.equal(checkAnswer(SUGAR, 'cukru'), 'close');
	assert.equal(checkAnswer(SUGAR, 'tsukr'), 'close');
	assert.equal(checkAnswer(SUGAR, 't'), 'wrong');
});

test('a sentence splits round its gap', () => {
	assert.deepEqual(split(SUGAR), { before: 'Кава без ', word: 'цукру', after: '.' });
});

test('one miss outweighs a round of right answers, and help outweighs none', () => {
	assert.equal(ratingOf(['right', 'right']), GOOD);
	assert.equal(ratingOf(['right', 'helped']), HARD);
	assert.equal(ratingOf(['helped', 'missed', 'right']), AGAIN);
});

test('a round is one review of a point, however many of its sentences were asked', () => {
	const once = gradePoint('bez-gen', undefined, ['right'], NOW);
	const thrice = gradePoint('bez-gen', undefined, ['right', 'right', 'right'], NOW);
	assert.deepEqual(thrice, once);
	assert.equal(once.word, 'grammar:bez-gen');
	assert.equal(once.state, LEARNING);
	assert.equal(once.reps, 1);

	// A miss later in the round replaces the review, it does not add one
	const missed = gradePoint('bez-gen', undefined, ['right', 'missed'], NOW);
	assert.equal(missed.reps, 1);
	assert.ok(missed.due < once.due);

	const before = reviewed(['bez-gen'], 30).get('grammar:bez-gen')!;
	const after = gradePoint('bez-gen', before, ['right'], NOW);
	assert.equal(after.reps, before.reps + 1);
	assert.ok(after.stability > before.stability);
	assert.equal(gradePoint('bez-gen', before, ['missed'], NOW).lapses, 1);
});

test('a point kept among the flashcards is told from a word, and takes no new word\'s place', () => {
	assert.ok(isPointKey('grammar:bez-gen'));
	assert.ok(!isPointKey('grammar:no-such'));
	assert.ok(!isPointKey('кава'));

	const point = gradePoint('bez-gen', undefined, ['right'], NOW);
	const word = answer(newCard('кава', NOW), GOOD, NOW);
	const cards = new Map([[point.word, point], [word.word, word]]);
	// Two new words a day, one met already: the point met today is not a second
	const today = plan(cards, ['кава', 'чай', 'вода'], 2, NOW);
	assert.deepEqual(today.fresh, ['чай']);
	assert.deepEqual(today.learning.map((card) => card.word), ['кава']);
});

test('a point is new, then learning, then known once it holds three weeks', () => {
	assert.equal(stateOf(undefined, NOW), 'new');
	const card = gradePoint('bez-gen', undefined, ['right'], NOW);
	assert.equal(stateOf(card, NOW), 'learning');
	assert.equal(stateOf({ ...card, state: REVIEW, stability: 5 }, NOW), 'learning');
	assert.equal(stateOf({ ...card, state: REVIEW, stability: 30 }, NOW), 'known');
});

test('a point is shaky after a miss or help, and when left long past its day', () => {
	// A first round with a miss, or with the case shown, and one got right unaided
	assert.equal(stateOf(gradePoint('bez-gen', undefined, ['right', 'missed'], NOW), NOW), 'weak');
	assert.equal(stateOf(gradePoint('bez-gen', undefined, ['helped'], NOW), NOW), 'weak');
	assert.equal(stateOf(gradePoint('bez-gen', undefined, ['right', 'right'], NOW), NOW), 'learning');
	// A point under review that is missed, and the same point got right in its next round
	const held = reviewed(['bez-gen'], 0).get(cardKey('bez-gen'))!;
	const lapsed = gradePoint('bez-gen', held, ['missed'], NOW);
	assert.equal(stateOf(lapsed, NOW), 'weak');
	assert.notEqual(stateOf(gradePoint('bez-gen', lapsed, ['right'], NOW), NOW), 'weak');
	// Left alone, a point slips: on its day it is still held, long after it is not
	assert.equal(stateOf(held, held.due), 'learning');
	assert.equal(stateOf(held, NOW + 400 * DAY), 'weak');
	assert.equal(stateOf({ ...held, stability: 30 }, NOW + 400 * DAY), 'weak');
});

test('a round of weak spots is the shaky points, filled up to a mix from the least held', () => {
	assert.deepEqual(planWeak(ids, new Map(), NOW, seeded()), []);

	// Six met and held, two of them missed today: those two and the least held of the rest
	const cards = reviewed(ids.slice(0, 6), 2);
	for (const id of ['na-loc', 'do-gen']) {
		const card = gradePoint(id, cards.get(cardKey(id)), ['missed'], NOW);
		cards.set(card.word, card);
	}
	const round = planWeak(ids, cards, NOW, seeded());
	assert.equal(round.length, ROUND);
	const asked = [...new Set(round)];
	assert.equal(asked.length, 3);
	assert.ok(asked.includes('na-loc') && asked.includes('do-gen'));
	assert.ok(asked.every((id) => cards.has(cardKey(id))), 'nothing new is brought in');
	for (let i = 1; i < round.length; i++) assert.notEqual(round[i], round[i - 1]);

	// Many shaky ones: four at most, so each is asked more than twice
	const slipped = reviewed(ids.slice(0, 8), 400);
	assert.equal(new Set(planWeak(ids, slipped, NOW, seeded())).size, 4);

	// One point met: the round is that point
	assert.deepEqual(planWeak(ids, reviewed(['bez-gen'], 0), NOW, seeded()), Array(ROUND).fill('bez-gen'));
});

// --- The sentences ---

const skip = existsSync('nebokrai.db') ? false : 'nebokrai.db is missing';

test('the database has sentences for exactly the points the page lists', { skip }, async () => {
	const counts = await pointCounts(openLocal('nebokrai.db'));
	assert.deepEqual(Object.keys(counts).sort(), [...ids].sort());
	for (const count of Object.values(counts)) assert.ok(count >= MAX_GAPS);
	for (const id of numbers) assert.equal(counts[id], numberCount(id));
});

test('sentences are drawn in the order asked, each with its gap and four forms to choose among', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const asked = [...found, 'no-such'];
	for (const seed of [1, 2, 3]) {
		const gaps = await drawGaps(db, asked.slice(0, MAX_GAPS), seeded(seed));
		assert.deepEqual(gaps.map((gap) => gap.point), found.slice(0, MAX_GAPS));
		for (const gap of gaps) {
			const { word } = split(gap);
			assert.equal(plain(word), plain(gap.answer), gap.uk);
			assert.equal(checkAnswer(gap, word), 'right');
			assert.ok(gap.en && gap.tatoeba_id > 0);
			assert.ok(gap.forms.includes(plain(gap.answer)));

			assert.ok(gap.choices.length >= 2 && gap.choices.length <= 4, gap.uk);
			assert.equal(new Set(gap.choices.map(plain)).size, gap.choices.length);
			// Exactly one choice is right: no second spelling of the case is offered as wrong
			assert.deepEqual(gap.choices.filter((choice) => checkAnswer(gap, choice) === 'right'), [gap.answer]);
			for (const choice of gap.choices) assert.ok(gap.forms.includes(plain(choice)));
		}
	}
	// One request for the meta row, one for the sentences, one for their nouns' forms
	assert.equal(db.queries, 9);
});

test('a point asked twice gives two different sentences', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const gaps = await drawGaps(db, Array(MAX_GAPS + 5).fill('sered-gen'), seeded(4));
	assert.equal(gaps.length, MAX_GAPS);
	assert.equal(new Set(gaps.map((gap) => gap.tatoeba_id + ':' + gap.start)).size, MAX_GAPS);
	assert.deepEqual(await drawGaps(db, ['no-such'], seeded()), []);
});

test('the noun standing after a preposition that asks for one case of it', { skip }, async () => {
	// Every sentence of the smallest point, read through the same code as a round
	const db = openLocal('nebokrai.db');
	const rows = await db.all<{ uk: string; start: number; length: number; form: string }>(
		"SELECT uk, start, length, form FROM cloze WHERE point = 'bez-gen'");
	assert.ok(rows.length >= MAX_GAPS);
	for (const row of rows) {
		assert.equal(plain(row.uk.slice(row.start, row.start + row.length)), plain(row.form));
		assert.match(row.uk.slice(0, row.start).toLowerCase(), /(^|[^Ѐ-ӿ])без $/);
	}
});

// --- Numbers with nouns ---

test('after two, three and four a noun is stressed as its genitive singular is', () => {
	assert.equal(stressLike('брати́', 'бра́та'), 'бра́ти');
	assert.equal(stressLike('се́стри', 'сестри́'), 'сестри́');
	assert.equal(stressLike('ві́кна', 'вікна́'), 'вікна́');
	assert.equal(stressLike('кни́ги', 'кни́ги'), 'кни́ги');
	// One vowel: nothing to move. Not as many vowels: left alone
	assert.equal(stressLike('дні', 'дня'), 'дні');
	assert.equal(stressLike('дівча́та', 'ді́вчини'.slice(0, -2)), 'дівча́та');
});

test('a number is drawn with a noun it makes sense with, and no noun twice while others are left', () => {
	const random = seeded(5);
	for (const point of numbers) {
		const taken = new Set<number>();
		const words = new Set<string>();
		for (let i = 0; i < 12; i++) {
			const draw = drawNumber(point, random, taken)!;
			assert.ok(draw.n >= draw.noun.min && draw.n <= draw.noun.max);
			words.add(draw.noun.frame + ' ' + draw.noun.word);
		}
		assert.equal(words.size, 12);
		assert.ok(numberCount(point) >= MAX_GAPS);
	}
	assert.equal(drawNumber('bez-gen', random, new Set()), null);
});

test('every counted noun is in the dictionary with the three forms the numbers ask for', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	for (const [point, numeral] of [['one-nom', '1'], ['few-nom', '3'], ['many-gen', '5']]) {
		const once = [...new Set(COUNTED.filter((noun) => !noun.manyOnly || point === 'many-gen').map((noun) => noun.word))];
		const seen = new Set<string>();
		// Enough rounds of the point alone to meet every noun
		for (let seed = 1; seed <= 60 && seen.size < once.length; seed++) {
			for (const gap of await drawGaps(db, Array(MAX_GAPS).fill(point), seeded(seed))) {
				seen.add(gap.word);
				const { before, word, after } = split(gap);
				assert.match(before, /\d+ $/, gap.uk);
				assert.equal(after, '.');
				assert.equal(word, gap.answer.replaceAll('\u0301', ''));
				assert.equal(checkAnswer(gap, word), 'right');
				assert.equal(gap.tatoeba_id, 0);
				assert.match(gap.en, /\d/);
				assert.equal(gap.choices.length, 4, gap.uk);
				assert.equal(new Set(gap.choices.map(plain)).size, 4);
				assert.deepEqual(gap.choices.filter((choice) => checkAnswer(gap, choice) === 'right'), [gap.answer]);
				// After two and after five the noun is not as the dictionary has it: there is something to choose
				if (point !== 'one-nom') assert.notEqual(plain(gap.answer), gap.word, gap.uk);
				// The number ends as the point's numbers do
				const n = Number(/\d+/.exec(gap.uk)![0]);
				const few = n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14);
				const one = n % 10 === 1 && n % 100 !== 11;
				assert.equal(one ? '1' : few ? '3' : '5', numeral, gap.uk);
			}
		}
		assert.deepEqual([...seen].sort(), [...once].sort(), point);
	}
});

test('numbers ask for книга, книги and книг, and a round of them reads no sentences', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const answers: Record<string, Set<string>> = {};
	// A round of the numbers: the nouns and their forms, two requests, and none for sentences
	assert.equal((await drawGaps(db, numbers, seeded())).length, 3);
	assert.equal(db.queries, 2);
	for (let seed = 1; seed <= 20; seed++) {
		for (const point of numbers) {
			for (const gap of await drawGaps(db, Array(MAX_GAPS).fill(point), seeded(seed))) {
				(answers[gap.word + ' ' + gap.point] ??= new Set()).add(gap.answer);
			}
		}
	}
	const only = (key: string) => [...(answers[key] ?? [])].join();
	assert.equal(only('книга one-nom'), 'кни\u0301га');
	assert.equal(only('книга few-nom'), 'кни\u0301ги');
	assert.equal(only('книга many-gen'), 'книг');
	assert.equal(only('брат few-nom'), 'бра\u0301ти');
	assert.equal(only('сестра few-nom'), 'сестри\u0301');
	assert.equal(only('рік many-gen'), 'ро\u0301ків');
});
