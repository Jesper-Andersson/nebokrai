import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedWords } from '../src/lib/edited.ts';

const struck = (original: string, fixed: string) =>
	changedWords(original, fixed).filter((p) => p.changed).map((p) => p.text);

test('a corrected ending strikes only that word', () => {
	assert.deepEqual(
		struck('Цікаво, чи сніжитиме в нашомі місті цієї зими?', 'Цікаво, чи сніжитиме в нашому місті цієї зими?'),
		['нашомі']);
});

test('a replaced phrase strikes each word it drops', () => {
	assert.deepEqual(struck('Гра не відбулася із-за дощу.', 'Гра не відбулася через дощ.'), ['із-за', 'дощу']);
});

test('the parts give back the original, punctuation and spaces included', () => {
	const original = 'Том — добрий тесляр, чи не так?';
	assert.equal(changedWords(original, 'Том — гарний тесляр, чи не так?').map((p) => p.text).join(''), original);
});

test('an unchanged sentence strikes nothing', () => {
	assert.deepEqual(struck('Я граю у футбол.', 'Я граю у футбол.'), []);
});
