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

// The database keeps an entry's grammar tags in alphabetical order, which
// puts "feminine" before "inanimate" and "masculine" after it. Shown to a
// reader they go gender first, then animacy, then number: "masculine ·
// inanimate". Tags not named here (the verb aspects) keep their order, last.
const TAG_ORDER = [
	'masculine', 'feminine', 'neuter',
	'inanimate', 'animate', 'person', 'personal', 'animal-not-person', 'by-personal-gender',
	'singular', 'plural'
];

export function orderedTags(tags: string[]): string[] {
	const place = (tag: string) => {
		const i = TAG_ORDER.indexOf(tag);
		return i < 0 ? TAG_ORDER.length : i;
	};
	return [...tags].sort((a, b) => place(a) - place(b));
}
