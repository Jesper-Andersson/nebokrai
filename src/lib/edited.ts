// Which words of Tatoeba's sentence a correction changed, so the note on an
// edited example can strike them through: in «Цікаво, чи сніжитиме в нашомі
// місті цієї зими?» corrected to «…в нашому місті…», only «нашомі».
//
// Words are compared whole, punctuation and spaces kept as they are, by the
// longest run the two sentences share (a longest common subsequence). Short
// sentences only, so the quadratic table is a few hundred cells.

export type Part = { text: string; changed: boolean };

/** Splits a sentence into words and the gaps between them, keeping every character. */
function pieces(text: string): string[] {
	return text.match(/[\p{L}\p{M}'’ʼ-]+|[^\p{L}\p{M}'’ʼ-]+/gu) ?? [];
}

const isWord = (piece: string) => /\p{L}/u.test(piece);

/** `original` cut into parts, each word marked `changed` when `fixed` does not keep it. */
export function changedWords(original: string, fixed: string): Part[] {
	const a = pieces(original);
	const b = pieces(fixed).filter(isWord);
	const words = a.map((p, i) => [p, i] as const).filter(([p]) => isWord(p));
	// lcs[i][j]: longest shared run of words[i..] and b[j..]
	const lcs = Array.from({ length: words.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = words.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i][j] = words[i][0] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}
	const kept = new Set<number>();
	for (let i = 0, j = 0; i < words.length && j < b.length;) {
		if (words[i][0] === b[j]) { kept.add(words[i][1]); i++; j++; }
		else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
		else j++;
	}
	return a.map((text, i) => ({ text, changed: isWord(text) && !kept.has(i) }));
}
