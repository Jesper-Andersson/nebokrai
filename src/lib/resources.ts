// The learning resources listed on /resources: other places to learn Ukrainian,
// chosen by hand. To add one, add an object to RESOURCES; the page, its filter
// and tests/resources.test.ts pick it up.
//
// What goes in: something we have opened and tried, that is useful without
// paying or is plainly marked as paid. No Russian-made resources, no paid
// placements and no affiliate links.
import { plain } from './search/normalize.ts';

/** In the order the list shows them. */
export const KINDS = ['course', 'podcast', 'reading', 'dictionary', 'tool', 'tutor', 'book'] as const;
export type Kind = (typeof KINDS)[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

/** The runs of levels a resource can suit: one level, or neighbours. */
export const LEVEL_SPANS = [
	'beginner', 'intermediate', 'advanced',
	'beginner-intermediate', 'intermediate-advanced', 'beginner-intermediate-advanced'
] as const;
export type LevelSpan = (typeof LEVEL_SPANS)[number];

/** `freemium`: a useful free part, with more for money. */
export type Cost = 'free' | 'freemium' | 'paid';

export interface Resource {
	name: string;
	url: string;
	/** One line on what it is, in English and in Ukrainian */
	en: string;
	uk: string;
	kind: Kind;
	levels: Level[];
	cost: Cost;
	/** The language it explains things in. Горох is all in Ukrainian, so a beginner cannot use it yet. */
	explainedIn: 'en' | 'uk';
	/** The day (ISO) the link and the description were last looked at */
	checked: string;
}

export const RESOURCES: Resource[] = [
	{
		name: 'Ukrainian Lessons',
		url: 'https://www.ukrainianlessons.com/',
		en: 'Podcast, lessons and grammar notes for learners at every level.',
		uk: 'Подкаст, уроки й пояснення граматики для будь-якого рівня.',
		kind: 'course',
		levels: ['beginner', 'intermediate', 'advanced'],
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Горох',
		url: 'https://goroh.pp.ua/',
		en: 'Ukrainian-language dictionaries: meanings, synonyms, stress and inflection.',
		uk: 'Тлумачення, синоніми, наголоси й словозміна українською.',
		kind: 'dictionary',
		levels: ['intermediate', 'advanced'],
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'Wiktionary',
		url: 'https://en.wiktionary.org/wiki/Category:Ukrainian_language',
		en: 'The source of Nebokrai’s entries, with etymology and usage notes.',
		uk: 'Джерело статей Nebokrai, з етимологією та поясненнями вживання.',
		kind: 'dictionary',
		levels: ['beginner', 'intermediate', 'advanced'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Tatoeba',
		url: 'https://tatoeba.org/',
		en: 'Example sentences with translations, many with audio.',
		uk: 'Речення з перекладами, багато з аудіо.',
		kind: 'tool',
		levels: ['beginner', 'intermediate', 'advanced'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Forvo',
		url: 'https://forvo.com/languages/uk/',
		en: 'Pronunciations recorded by native speakers.',
		uk: 'Вимова, записана носіями мови.',
		kind: 'tool',
		levels: ['beginner', 'intermediate', 'advanced'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	}
];

/** `['beginner', 'intermediate']` -> `'beginner-intermediate'`, the key of its label in i18n.ts. */
export function levelSpan(levels: Level[]): LevelSpan {
	return LEVELS.filter((level) => levels.includes(level)).join('-') as LevelSpan;
}

/** The kinds that have at least one resource, in list order: the filter offers no empty choice. */
export function kindsIn(list: Resource[]): Kind[] {
	return KINDS.filter((kind) => list.some((r) => r.kind === kind));
}

/**
 * The resources of one kind (or of all, for `null`) whose name or description
 * has every word typed. Compared through `plain()`, so neither case nor a
 * stress mark matters: «горох» finds Горох.
 */
export function filterResources(list: Resource[], kind: Kind | null, text: string): Resource[] {
	const words = plain(text).split(/\s+/).filter(Boolean);
	return list.filter((r) => {
		if (kind && r.kind !== kind) return false;
		const hay = plain(`${r.name} ${r.en} ${r.uk}`);
		return words.every((word) => hay.includes(word));
	});
}

/** The newest `checked` day in the list: when the page was last reviewed. */
export function lastChecked(list: Resource[]): string {
	return list.reduce((latest, r) => (r.checked > latest ? r.checked : latest), '');
}
