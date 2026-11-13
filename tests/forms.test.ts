// What a search result says about the form that found it (groupMatched in src/lib/forms.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cellKey, coverable, formTables, groupMatched } from '../src/lib/forms.ts';

test('the forms a query spells, grouped for reading', () => {
	// руки: one spelling, two stresses. The rows come in the order of the table.
	assert.deepEqual(groupMatched([
		{ form: 'ру́ки', tags: ['nominative', 'plural'] },
		{ form: 'руки́', tags: ['genitive', 'singular'] },
		{ form: 'ру́ки', tags: ['accusative', 'plural'] },
		{ form: 'ру́ки', tags: ['plural', 'vocative'] }
	]), {
		groups: [
			{ form: 'ру́ки', labels: ['nominative, accusative, vocative plural'] },
			{ form: 'руки́', labels: ['genitive singular'] }
		],
		more: 0
	});

	// A verb form has no case; the aspect is said beside the headword already
	assert.deepEqual(groupMatched([
		{ form: 'чита́ю', tags: ['first-person', 'imperfective', 'present', 'singular'] }
	]), { groups: [{ form: 'чита́ю', labels: ['1st person singular present'] }], more: 0 });

	// One cell of an adjective's table can stand for two genders
	assert.deepEqual(groupMatched([
		{ form: 'до́брого', tags: ['genitive', 'masculine', 'neuter', 'singular'] },
		{ form: 'до́брого', tags: ['accusative', 'animate', 'masculine', 'singular'] }
	]), {
		groups: [{
			form: 'до́брого', labels: ['genitive masculine/neuter singular', 'accusative animate masculine singular']
		}],
		more: 0
	});

	assert.deepEqual(groupMatched([]), { groups: [], more: 0 });
});

test('a long list is cut short and says how much is left', () => {
	const forms = ['masculine', 'feminine', 'neuter'].flatMap((gender) =>
		['singular', 'plural'].map((number) => ({ form: 'х', tags: ['genitive', gender, number] })));
	const { groups, more } = groupMatched(forms, 4);
	assert.equal(groups[0].labels.length, 4);
	assert.equal(more, 2);
	assert.deepEqual(groupMatched(forms, 6).more, 0);
});

test('covering a table leaves the dictionary form in sight, once', () => {
	// стіл: the accusative is spelt as the dictionary form is, and is still one to recall
	const stil = formTables('noun', [
		{ form: 'стіл', tags: ['nominative', 'singular'] },
		{ form: 'стола́', tags: ['genitive', 'singular'] },
		{ form: 'сто́лу', tags: ['genitive', 'singular'] },
		{ form: 'стіл', tags: ['accusative', 'singular'] },
		{ form: 'столи́', tags: ['nominative', 'plural'] }
	], 'стіл').tables;
	const title = stil[0].title;
	const { cells, given } = coverable(stil, 'стіл');
	assert.equal(given, cellKey(title, 'Nominative', 0));
	// One cell for the two genitives, and none for the cells that hold no form
	assert.deepEqual(cells, [
		cellKey(title, 'Nominative', 1), cellKey(title, 'Genitive', 0), cellKey(title, 'Accusative', 0)
	]);

	// No headword to compare with (a pronoun), or a table without it (a verb): every form is covered
	assert.equal(coverable(stil, '').given, null);
	assert.equal(coverable(stil, '').cells.length, 4);
	const verb = formTables('verb', [
		{ form: 'чита́ю', tags: ['first-person', 'present', 'singular'] },
		{ form: 'чита́єш', tags: ['second-person', 'present', 'singular'] }
	], 'читати').tables;
	assert.deepEqual(coverable(verb, 'чита́ти'), {
		cells: [cellKey('Present', '1st person', 0), cellKey('Present', '2nd person', 0)], given: null
	});
	assert.deepEqual(coverable([], 'стіл'), { cells: [], given: null });
});
