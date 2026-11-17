// The run of text a piece of text stands in: the piece itself and its
// neighbours across the edges of inline elements. A page may set one letter of
// a word apart, as the site does with a stressed vowel:
//
//   кн<span>и́</span>га
//
// is three pieces of text and one word, and a pointer on any of the three is on
// книга. A paragraph, a table cell, a line break or a picture ends the run.

const ELEMENT = 1;
const TEXT = 3;

/** Enough for the longest word looked up and a neighbour of the same length, with room to spare. */
const REACH = 200;

export interface Piece {
	node: Text;
	/** Where the piece starts in the run's text. */
	start: number;
}

export interface TextRun {
	text: string;
	pieces: Piece[];
	/** Where the piece the run was asked about starts in `text`. */
	origin: number;
}

/**
 * The text next to `from` on one side, or null where the line of text ends.
 * `inline` says whether an element flows within a line (a span, a link) or
 * stands by itself (a paragraph, a button).
 */
function beside(from: Node, back: boolean, inline: (element: Element) => boolean): Text | null {
	let node: Node = from;
	for (;;) {
		let next = back ? node.previousSibling : node.nextSibling;
		// The edge of an inline element: go on from the element itself
		while (!next) {
			const parent = node.parentNode;
			if (!parent || parent.nodeType !== ELEMENT || !inline(parent as Element)) return null;
			node = parent;
			next = back ? node.previousSibling : node.nextSibling;
		}
		node = next;
		// Into an inline element, to the end of it nearest where we came from
		while (node.nodeType === ELEMENT) {
			if (!inline(node as Element)) return null;
			const child = back ? node.lastChild : node.firstChild;
			// Nothing inside: a line break or a picture, which do part two words
			if (!child) return null;
			node = child;
		}
		if (node.nodeType === TEXT) return node as Text;
		// A comment: frameworks leave them between pieces of text. Look past it.
	}
}

/** The text `node` stands in, joined across inline elements, about `REACH` characters each way. */
export function textRun(node: Text, inline: (element: Element) => boolean): TextRun {
	const before: Text[] = [];
	let reached = 0;
	for (let at = beside(node, true, inline); at && reached < REACH; at = beside(at, true, inline)) {
		before.unshift(at);
		reached += at.data.length;
	}
	const after: Text[] = [];
	reached = 0;
	for (let at = beside(node, false, inline); at && reached < REACH; at = beside(at, false, inline)) {
		after.push(at);
		reached += at.data.length;
	}

	const pieces: Piece[] = [];
	let text = '';
	let origin = 0;
	for (const piece of [...before, node, ...after]) {
		if (piece === node) origin = text.length;
		pieces.push({ node: piece, start: text.length });
		text += piece.data;
	}
	return { text, pieces, origin };
}

/**
 * The piece and the place in it for a place in the run's text. A place where
 * two pieces meet is the start of the later one, or with `end` the end of the
 * earlier one, so that a word's range holds its own letters and nothing else.
 */
export function placeIn(run: TextRun, offset: number, end = false): { node: Text; offset: number } {
	let found = run.pieces[0];
	for (const piece of run.pieces) {
		if (end ? piece.start < offset : piece.start <= offset) found = piece;
	}
	return { node: found.node, offset: offset - found.start };
}
