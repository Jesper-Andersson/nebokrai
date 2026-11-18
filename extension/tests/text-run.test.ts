import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeIn, textRun } from '../lib/text-run.ts';
import { wordAt } from '../lib/word-at.ts';

// Just enough of a page for the walk: there is no DOM here
interface Fake {
	nodeType: number;
	tag?: string;
	data?: string;
	parentNode: Fake | null;
	previousSibling: Fake | null;
	nextSibling: Fake | null;
	firstChild: Fake | null;
	lastChild: Fake | null;
}

const blank = (): Omit<Fake, 'nodeType'> => ({
	parentNode: null,
	previousSibling: null,
	nextSibling: null,
	firstChild: null,
	lastChild: null
});
const text = (data: string): Fake => ({ ...blank(), nodeType: 3, data });
const comment = (): Fake => ({ ...blank(), nodeType: 8 });
function el(tag: string, ...children: Fake[]): Fake {
	const element: Fake = { ...blank(), nodeType: 1, tag };
	children.forEach((child, i) => {
		child.parentNode = element;
		child.previousSibling = children[i - 1] ?? null;
		child.nextSibling = children[i + 1] ?? null;
	});
	element.firstChild = children[0] ?? null;
	element.lastChild = children.at(-1) ?? null;
	return element;
}

const INLINE = new Set(['span', 'a', 'b', 'br']);
const inline = (element: Element) => INLINE.has((element as unknown as Fake).tag!);
const run = (node: Fake) => textRun(node as unknown as Text, inline);

test('a stressed vowel in a span of its own does not part the word', () => {
	const pieces = [text('кн'), text('и́'), text('га')];
	el('p', pieces[0], el('span', pieces[1]), pieces[2]);
	for (const [i, piece] of pieces.entries()) {
		const found = run(piece);
		assert.equal(found.text, 'кни́га');
		assert.equal(found.origin, [0, 2, 4][i]);
		assert.equal(wordAt(found.text, found.origin + 1)?.word, 'кни́га');
	}
});

test('a word that ends in its stressed vowel, and the comments a framework leaves', () => {
	const last = text('а́');
	el('p', text('будь '), el('b', comment(), text('ласк'), el('span', last), comment()), text(', дякую'));
	const found = run(last);
	assert.equal(found.text, 'будь ласка́, дякую');
	assert.deepEqual(wordAt(found.text, found.origin + 1), { word: 'ласка́', before: 'будь', start: 5, end: 11 });
});

test('a paragraph, a line break and an empty element end the run', () => {
	const cell = text('рука́');
	el('div', el('p', text('вода')), el('p', cell), el('p', text('ї́жа')));
	assert.equal(run(cell).text, 'рука́');

	const line = text('рука');
	el('p', text('вода'), el('br'), line, el('span'), text('їжа'));
	assert.equal(run(line).text, 'рука');
});

test('a place in the run is a place in one of its pieces', () => {
	const pieces = [text('кн'), text('и́'), text('га')];
	el('p', pieces[0], el('span', pieces[1]), pieces[2]);
	const found = run(pieces[1]);
	const node = (i: number) => pieces[i] as unknown as Text;
	assert.deepEqual(placeIn(found, 0), { node: node(0), offset: 0 });
	assert.deepEqual(placeIn(found, 2), { node: node(1), offset: 0 });
	assert.deepEqual(placeIn(found, 4, true), { node: node(1), offset: 2 });
	assert.deepEqual(placeIn(found, 6, true), { node: node(2), offset: 2 });
});

test('a long page is not read to its end', () => {
	const middle = text('слово');
	const many = (n: number) => Array.from({ length: n }, () => el('span', text('а'.repeat(50) + ' ')));
	el('p', ...many(40), middle, ...many(40));
	assert.ok(run(middle).text.length < 600);
});
