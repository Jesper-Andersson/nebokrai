// The text editor of `npm run dev`: finding a clicked text in the source and
// writing a change back (scripts/edit-text/source.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyEdit, EditError, markupSpots, messageSpots, notePending, quotedSpots } from '../scripts/edit-text/source.ts';
import type { Pending } from '../scripts/edit-text/source.ts';

const MESSAGES = `// Interface text
type Lang = 'en' | 'uk';
const en = {
	nav: { saved: 'Saved', about: 'About' },
	home: {
		placeholder: 'Search a word...',
		noMatches: (query: string) => \`No matches for “\${query}”.\`,
		words: (n: number) => (n === 1 ? '1 word' : \`\${n} words\`),
		quoted: "It's here",
		kind: (tag: string) => (tag === 'feminine' ? 'she' : 'it'),
		entry: (word: string, pos: string) => \`\${word} (\${pos})\`
	}
};
const uk: typeof en = {
	nav: { saved: 'Збережені', about: 'Про сайт' },
	home: {
		placeholder: 'Шукати слово...',
		noMatches: (query: string) => \`Нічого не знайдено для «\${query}».\`,
		words: (n: number) => \`\${n} слів\`,
		quoted: 'Воно тут',
		kind: (tag: string) => (tag === 'feminine' ? 'вона' : 'воно')
	}
};
`;

const find = (text: string) => messageSpots(MESSAGES, 'i18n.ts', text);

test('a message is found by its text, with its key and language', () => {
	const [spot, ...rest] = find('Search a word...');
	assert.equal(rest.length, 0);
	assert.deepEqual(
		{ key: spot.key, lang: spot.lang, kind: spot.kind, line: spot.line, text: spot.text },
		{ key: 'home.placeholder', lang: 'en', kind: 'string', line: 6, text: 'Search a word...' }
	);
	assert.equal(find('Збережені')[0].lang, 'uk');
	assert.equal(find('Збережені')[0].key, 'nav.saved');
	// The page may have broken the line or padded it
	assert.equal(find('  Search a\n word... ')[0].key, 'home.placeholder');
	assert.deepEqual(find('Nothing like this'), []);
	assert.deepEqual(find('  '), []);
});

test('text inside a function is found; a string compared with is not', () => {
	assert.equal(find('1 word')[0].key, 'home.words');
	assert.equal(find('she')[0].key, 'home.kind');
	assert.deepEqual(find('feminine'), []);
	// Nor a type written as a string
	assert.deepEqual(find('en'), []);
});

test('a template is found from what it printed', () => {
	const [spot] = find('No matches for “kava”.');
	assert.equal(spot.key, 'home.noMatches');
	assert.equal(spot.kind, 'template');
	assert.equal(spot.text, 'No matches for “${query}”.');
	assert.deepEqual(spot.holes, ['${query}']);
	assert.equal(find('12 words')[0].text, '${n} words');
	assert.equal(find('12 слів')[0].lang, 'uk');
	// A template with no words of its own claims nothing
	assert.deepEqual(find('to carry (on foot)'), []);
});

test('a changed message is written back in its own quotes', () => {
	const change = (text: string, value: string) => applyEdit(MESSAGES, find(text)[0], value);
	assert.match(change('Search a word...', 'Find a word'), /placeholder: 'Find a word',/);
	assert.match(change('Search a word...', "Don't stop"), /placeholder: 'Don\\'t stop',/);
	assert.match(change("It's here", 'Say "hi"'), /quoted: "Say \\"hi\\"",/);
	assert.match(change('About', 'Two\nlines'), /about: 'Two\\nlines' \}/);
	// Everything else in the file is as it was
	const changed = change('Saved', 'Kept');
	assert.equal(changed.length, MESSAGES.length - 1);
	assert.equal(changed.replace("saved: 'Kept'", "saved: 'Saved'"), MESSAGES);
});

test('a changed template keeps its holes', () => {
	const spot = find('No matches for “kava”.')[0];
	assert.match(applyEdit(MESSAGES, spot, 'Nothing found for “${query}”, sorry.'), /=> `Nothing found for “\$\{query\}”, sorry\.`,/);
	// A backtick or a stray ${ in the new text must not become code
	assert.match(applyEdit(MESSAGES, spot, 'A `${query}` and ${more}'), /=> `A \\`\$\{query\}\\` and \\\$\{more\}`,/);
	assert.throws(() => applyEdit(MESSAGES, spot, 'Nothing found.'), EditError);
	assert.throws(() => applyEdit(MESSAGES, spot, '   '), EditError);
});

const PAGE = `<!-- About this page: Free for everyone. -->
<script lang="ts">
	const title = 'Free for everyone.';
</script>

<TextPage>
	{#if settings.lang === 'uk'}
		<p>Безкоштовно для всіх.</p>
	{:else}
		<p class="lead">
			Nebokrai is a free Ukrainian–English dictionary for people learning Ukrainian. It finds a
			word however you type it.
		</p>
		<ul>
			<li>Search in Latin letters (<i>pryvit</i>) or in English.</li>
			<li>Free for everyone.</li>
			<li>Tom &amp; Jerry</li>
		</ul>
	{/if}
</TextPage>

<style>
	p::after { content: 'Free for everyone.'; }
</style>
`;

const inPage = (text: string) => markupSpots(PAGE, 'about.svelte', text);

test('text in a page is found only in its markup, and only whole', () => {
	const spots = inPage('Free for everyone.');
	assert.equal(spots.length, 1);
	assert.deepEqual(
		{ line: spots[0].line, key: spots[0].key, lang: spots[0].lang, kind: spots[0].kind },
		{ line: 16, key: null, lang: 'en', kind: 'markup' }
	);
	assert.equal(inPage('Безкоштовно для всіх.')[0].lang, 'uk');
	// The browser has the text on either side of <i> as pieces of their own
	assert.equal(inPage('Search in Latin letters (').length, 1);
	assert.equal(inPage('pryvit').length, 1);
	assert.equal(inPage(') or in English.').length, 1);
	// Part of a sentence is not a place to write to
	assert.deepEqual(inPage('Search in Latin'), []);
	assert.deepEqual(inPage('for everyone.'), []);
	// What is shown as & is written &amp;
	assert.equal(inPage('Tom & Jerry').length, 1);
});

test('a paragraph is found across its lines and wrapped again', () => {
	const shown =
		'Nebokrai is a free Ukrainian–English dictionary for people learning Ukrainian. It finds a word however you type it.';
	const [spot] = inPage(shown);
	assert.equal(spot.line, 11);
	const changed = applyEdit(
		PAGE,
		spot,
		'Nebokrai is a free Ukrainian–English dictionary for everyone who is learning Ukrainian, at any level. It finds a word however you type it, and shows how it is said.'
	);
	assert.ok(
		changed.includes(
			'\t\t<p class="lead">\n' +
				'\t\t\tNebokrai is a free Ukrainian–English dictionary for everyone who is learning Ukrainian, at any\n' +
				'\t\t\tlevel. It finds a word however you type it, and shows how it is said.\n' +
				'\t\t</p>'
		)
	);
	for (const line of changed.split('\n')) assert.ok(line.length <= 100, line);
});

test('a changed line stays one line, and cannot become markup', () => {
	const change = (text: string, value: string) => applyEdit(PAGE, inPage(text)[0], value);
	assert.ok(change('Free for everyone.', 'Free,\n and  open.').includes('<li>Free, and open.</li>'));
	assert.ok(change('Free for everyone.', 'a <b> & {c}').includes('<li>a &lt;b&gt; &amp; &#123;c&#125;</li>'));
	assert.ok(change('Tom & Jerry', 'Tom & Co').includes('<li>Tom &amp; Co</li>'));
	// Windows line endings are kept
	const windows = PAGE.replaceAll('\n', '\r\n');
	const [spot] = markupSpots(windows, 'about.svelte', 'Nebokrai is a free Ukrainian–English dictionary for people learning Ukrainian. It finds a word however you type it.');
	const long = 'Nebokrai is a free dictionary. '.repeat(5);
	const changed = applyEdit(windows, spot, long);
	assert.ok(!/[^\r]\n/.test(changed));
	assert.ok(changed.includes('dictionary.\r\n\t\t\tNebokrai'));
});

test('a text written as a string in a page is found and written back in its quotes', () => {
	const page = `<script lang="ts">
	const kinds = ['saved', 'all words'];
</script>

<p>
	{uk
		? 'Тут поки порожньо. Натисніть закладку.'
		: 'Nothing saved yet. Press the bookmark.'}
</p>
<p title={uk ? "Це ваш список" : "It's your list"}>{count} words</p>

<style>
	p::before { content: 'Nothing saved yet. Press the bookmark.'; }
</style>
`;
	const quoted = (text: string) => quotedSpots(page, 'saved.svelte', text);
	const [spot, ...rest] = quoted('Nothing saved yet. Press the bookmark.');
	assert.equal(rest.length, 0);
	assert.deepEqual(
		{ line: spot.line, lang: spot.lang, kind: spot.kind, key: spot.key },
		{ line: 8, lang: 'en', kind: 'string', key: null }
	);
	assert.equal(quoted('Тут поки порожньо. Натисніть закладку.')[0].lang, 'uk');
	assert.ok(applyEdit(page, spot, "Nothing's saved yet.").includes(": 'Nothing\\'s saved yet.'}"));
	// An apostrophe in the text, in double quotes
	const [list] = quoted("It's your list");
	assert.ok(applyEdit(page, list, 'Your "own" list').includes(': "Your \\"own\\" list"}'));
	// Part of a string is not a place to write to, nor is a single word
	assert.deepEqual(quoted('Nothing saved yet.'), []);
	assert.deepEqual(quoted('saved'), []);
	assert.equal(quoted('all words').length, 1);
});

test('the list of English waiting for its Ukrainian', () => {
	const edit = (was: string, now: string, changed = '2026-11-13'): Pending => ({
		file: 'src/lib/i18n.ts',
		key: 'nav.saved',
		was,
		now,
		changed
	});
	let list = notePending([], edit('Saved', 'Kept'));
	assert.deepEqual(list, [edit('Saved', 'Kept')]);
	// A second change to the same text: the Ukrainian still says "Saved"
	list = notePending(list, edit('Kept', 'Kept words', '2026-11-14'));
	assert.deepEqual(list, [edit('Saved', 'Kept words', '2026-11-14')]);
	// Another key is another entry
	list = notePending(list, { ...edit('About', 'About us'), key: 'nav.about' });
	assert.equal(list.length, 2);
	// Changed back: nothing to translate
	list = notePending(list, edit('Kept words', 'Saved'));
	assert.deepEqual(list.map((entry) => entry.key), ['nav.about']);
	// No change at all
	assert.equal(notePending(list, edit('Same', 'Same ')), list);
});
