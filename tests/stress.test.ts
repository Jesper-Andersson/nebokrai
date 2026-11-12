// Where the stress falls, and whether a form moves it (src/lib/stress.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { differOnlyByStress, stressedSyllables, stressMoved, stressShift } from '../src/lib/stress.ts';

test('the stressed syllable', () => {
	assert.deepEqual(stressedSyllables('рука́'), [1]);
	assert.deepEqual(stressedSyllables('ру́ки'), [0]);
	assert.deepEqual(stressedSyllables('Украї́на'), [2]); // ї keeps its dots and counts as a vowel
	assert.deepEqual(stressedSyllables('стіл'), [0]); // one syllable needs no mark
	assert.deepEqual(stressedSyllables('по́ми́лка'), [0, 1]); // both stresses are in use
	assert.deepEqual(stressedSyllables('книга'), []); // no mark: cannot be told
	assert.deepEqual(stressedSyllables('бу́ду чита́ти'), []); // two words
	assert.deepEqual(stressedSyllables(''), []);
});

test('a form that moves the stress', () => {
	assert.ok(stressMoved('рука́', 'ру́ки'));
	assert.ok(!stressMoved('рука́', 'руки́'));
	assert.ok(!stressMoved('рука́', 'рук')); // one syllable: nowhere else to put it
	assert.ok(stressMoved('стіл', 'стола́'));
	assert.ok(stressMoved('писа́ти', 'пи́шеш'));
	assert.ok(!stressMoved('писа́ти', 'пишу́'));
	assert.ok(!stressMoved('кни́га', 'кни́гами'));
	assert.ok(!stressMoved('по́ми́лка', 'поми́лки')); // shares one of the two
	assert.ok(!stressMoved('книга', 'кни́ги')); // headword without a mark
	assert.ok(!stressMoved('чита́ти', 'бу́ду чита́ти'));
});

test('what the forms of a word do with its stress', () => {
	assert.equal(stressShift('рука́', ['рука́', 'руки́', 'ру́ки', 'рук']), 'moves');
	assert.equal(stressShift('кни́га', ['кни́га', 'кни́ги', 'книг']), 'stays');
	assert.equal(stressShift('книга', ['кни́га', 'кни́ги']), null); // headword without a mark
	assert.equal(stressShift('чита́ти', ['бу́ду чита́ти']), null); // nothing to compare
	assert.equal(stressShift('', ['мене́']), null);
});

test('spelled alike, stressed apart', () => {
	assert.ok(differOnlyByStress('за́мок', 'замо́к'));
	assert.ok(differOnlyByStress('ви́дати', 'вида́ти'));
	assert.ok(!differOnlyByStress('стан', 'стан'));
	assert.ok(!differOnlyByStress('за́мок', 'за́мки'));
	assert.ok(!differOnlyByStress('Рома́н', 'рома́н')); // the capital is a different spelling
	assert.ok(!differOnlyByStress('замок', 'замо́к')); // one of them cannot be told
});
