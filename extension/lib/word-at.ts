// Which word of a run of text a double-click landed on, and the words either
// side of it. In "Дайте, будь ласка, склянку води." a click on ласка gives
//
//   { word: 'ласка', before: 'будь' }
//
// with no `after`: a comma stands before склянку. The neighbours let the site
// read a pair that is an entry of its own (будь ласка, "please"); the rule is
// the one Sentence.svelte has on the site, and the words are found by the
// same `tokens()`.
import { tokens } from '../../src/lib/sentence.ts';

/** `MAX_GLOSS_WORD` in src/lib/gloss.ts: a longer word gets a 400 from /api/gloss. */
export const MAX_WORD = 40;

export interface WordAt {
	word: string;
	before?: string;
	after?: string;
	/** Where the word stands in the text, for drawing the card beside it. */
	start: number;
	end: number;
}

/** The Ukrainian word at `offset` in `text`; null on a space, a number or a Latin word. */
export function wordAt(text: string, offset: number): WordAt | null {
	const parts = tokens(text);
	let start = 0;
	for (let i = 0; i < parts.length; i++) {
		const end = start + parts[i].text.length;
		// A caret at the very end of a word still belongs to it
		if (parts[i].word && offset >= start && offset <= end) {
			if (parts[i].text.length > MAX_WORD) return null;
			const neighbour = (step: -2 | 2): string | undefined => {
				const between = parts[i + step / 2];
				const word = parts[i + step];
				return between && word?.word && word.text.length <= MAX_WORD && /^\s+$/.test(between.text)
					? word.text
					: undefined;
			};
			const found: WordAt = { word: parts[i].text, start, end };
			const before = neighbour(-2);
			const after = neighbour(2);
			if (before) found.before = before;
			if (after) found.after = after;
			return found;
		}
		start = end;
	}
	return null;
}
