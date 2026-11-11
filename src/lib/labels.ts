// How common a word is, from its frequency rank. The display names are in
// i18n.ts (`tiers`), and part-of-speech names too (`posLabel`).
export type Commonality = 'very-common' | 'common' | 'uncommon' | 'rare';

// About 20,000 words are ranked (data/README.md "Frequency ranking"); words
// without a rank are rarer than all of them.
const TIERS: [maxRank: number, tier: Commonality][] = [
	[1000, 'very-common'],
	[5000, 'common'],
	[12000, 'uncommon'],
	[Infinity, 'rare']
];

export function commonality(freqRank: number | null): Commonality {
	return TIERS.find(([max]) => (freqRank ?? Infinity) <= max)![1];
}
