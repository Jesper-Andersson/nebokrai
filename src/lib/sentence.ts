// Splits a Ukrainian sentence into its words and what stands between them, so
// a page can treat each word by itself (Sentence.svelte).

export interface Token {
	text: string;
	/** A Ukrainian word; false for spaces, punctuation, numbers and Latin text. */
	word: boolean;
}

// The same words data/import_wiktionary.py finds when it attaches a sentence
// to its entries (TOKEN there), plus the stress mark, which the quotes taken
// from Wiktionary carry: «Вона́ чита́є кни́гу».
const WORD = /[Ѐ-ӿ́]+(?:['’ʼ-][Ѐ-ӿ́]+)*/g;

export function tokens(text: string): Token[] {
	const out: Token[] = [];
	let end = 0;
	for (const match of text.matchAll(WORD)) {
		if (match.index > end) out.push({ text: text.slice(end, match.index), word: false });
		out.push({ text: match[0], word: true });
		end = match.index + match[0].length;
	}
	if (end < text.length) out.push({ text: text.slice(end), word: false });
	return out;
}
