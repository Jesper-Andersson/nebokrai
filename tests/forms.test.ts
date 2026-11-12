// What a search result says about the form that found it (groupMatched in src/lib/forms.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupMatched } from '../src/lib/forms.ts';

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
