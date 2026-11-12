// The files the Saved page offers for download. Needs no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ankiText, csv, exportFile, json, type ExportCard } from '../src/lib/export.ts';

const kalyna: ExportCard = {
	word: 'калина', headword: 'кали́на', pos: 'noun', tags: ['feminine', 'inanimate'], ipa: '[kɐˈɫɪnɐ]',
	glosses: ['viburnum, guelder rose'],
	example: { uk: 'Калина цвіте.', en: 'The viburnum is in bloom.', tatoeba_id: 123 },
	saved_at: Date.UTC(2026, 10, 11, 12)
};
// Text that would break a file if written as it is
const awkward: ExportCard = {
	word: 'Київ', headword: '"Ки́їв"', pos: 'name', tags: [], ipa: null,
	glosses: ['a <b>city</b> & "capital"', 'tab\there\nand a new line'],
	example: null,
	saved_at: Date.UTC(2026, 10, 10)
};
const posName = (pos: string) => pos.toUpperCase();

test('Anki text file', () => {
	const lines = ankiText([kalyna, awkward], posName).split('\n');
	assert.deepEqual(lines.slice(0, 5), ['#separator:tab', '#html:true', '#guid column:1', '#tags column:4', '#deck:Nebokrai']);
	assert.equal(lines.length, 8); // five header lines, two cards, and the file ends with a line break
	assert.equal(lines[7], '');

	const [guid, front, back, tags] = lines[5].split('\t');
	assert.equal(guid, 'nebokrai:калина');
	assert.equal(front, 'кали́на'); // the stress mark stays
	assert.ok(back.includes('NOUN · feminine, inanimate'));
	assert.ok(back.includes('[kɐˈɫɪnɐ]'));
	assert.ok(back.includes('<div>viburnum, guelder rose</div>')); // one meaning: no numbered list
	assert.ok(back.includes('<i lang="uk">Калина цвіте.</i><br>The viburnum is in bloom.'));
	assert.ok(back.includes('<a href="https://nebokrai.app/word/kalyna">Nebokrai</a>'));
	assert.equal(tags, 'nebokrai noun');

	const fields = lines[6].split('\t');
	assert.equal(fields.length, 4); // the tab and the line break inside a meaning did not make new fields
	assert.equal(fields[1], '&quot;Ки́їв&quot;'); // never a bare quote at the start of a field
	assert.ok(fields[2].includes('<ol><li>a &lt;b&gt;city&lt;/b&gt; &amp; &quot;capital&quot;</li><li>tab here and a new line</li></ol>'));
	assert.ok(fields[2].includes('>NAME</div>')); // no tags: no dangling separator
	assert.ok(!fields[2].includes('<i lang="uk">')); // no example
	assert.ok(fields[2].includes('https://nebokrai.app/word/kyiv'));
});

test('CSV', () => {
	const text = csv([kalyna, awkward]);
	assert.equal(text.charCodeAt(0), 0xfeff); // Excel needs the mark to read Ukrainian
	const lines = text.slice(1).split('\r\n');
	assert.equal(lines.length, 4);
	assert.equal(lines[3], '');
	assert.equal(lines[0], '"word","headword","part_of_speech","grammar","ipa","meanings","example_uk","example_en","url","saved_at"');
	assert.equal(lines[1],
		'"калина","кали́на","noun","feminine, inanimate","[kɐˈɫɪnɐ]","viburnum, guelder rose",' +
		'"Калина цвіте.","The viburnum is in bloom.","https://nebokrai.app/word/kalyna","2026-11-11T12:00:00.000Z"');
	// Quotes are doubled, markup is left as text, and the line break stays inside its quoted field
	assert.ok(text.includes('"""Ки́їв""","name","","","a <b>city</b> & ""capital""; tab\there\nand a new line","","",'));
});

test('JSON', () => {
	const now = new Date(Date.UTC(2026, 10, 11, 20, 30));
	const data = JSON.parse(json([kalyna, awkward], now));
	assert.equal(data.exported_at, '2026-11-11T20:30:00.000Z');
	assert.equal(data.source, 'https://nebokrai.app');
	assert.match(data.licence, /CC BY-SA 4\.0.*CC BY 2\.0 FR/);
	assert.deepEqual(data.words.map((w: { word: string }) => w.word), ['калина', 'Київ']);
	assert.deepEqual(data.words[0].example, {
		uk: 'Калина цвіте.', en: 'The viburnum is in bloom.', tatoeba_id: 123, url: 'https://tatoeba.org/sentences/show/123'
	});
	assert.equal(data.words[0].saved_at, kalyna.saved_at);
	assert.equal(data.words[1].example, null);
	assert.equal(data.words[1].ipa, null);
	assert.deepEqual(data.words[1].glosses, awkward.glosses);
});

test('file names and types', () => {
	const now = new Date(Date.UTC(2026, 10, 11, 20, 30));
	const files = (['anki', 'csv', 'json'] as const).map((format) => exportFile(format, [kalyna], posName, now));
	assert.deepEqual(files.map((f) => f.name),
		['nebokrai-saved-2026-11-11.txt', 'nebokrai-saved-2026-11-11.csv', 'nebokrai-saved-2026-11-11.json']);
	assert.deepEqual(files.map((f) => f.type), ['text/plain;charset=utf-8', 'text/csv;charset=utf-8', 'application/json']);
	assert.ok(files[0].text.startsWith('#separator:tab\n'));
	// An empty list still gives a file that opens
	assert.equal(exportFile('csv', [], posName, now).text.split('\r\n').length, 2);
});
