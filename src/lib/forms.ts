// Turns the flat `forms` list of a word (one row per table cell, placed by its
// tags, see docs/api.md "Reading forms") into tables the Details page can draw.
// A form that fits no table cell goes into `other`, so nothing is lost when
// Wiktionary uses an unusual layout.
import { pronounFor, shownTags } from './grammar.ts';

export interface Form {
	form: string;
	tags: string[];
}

export interface CellItem {
	form: string;
	/** The tag that tells apart the variants one cell holds: "animate", "inanimate", "dated" */
	note?: string;
}

export interface FormTable {
	title: string;
	columns: string[];
	rows: {
		label: string;
		cells: CellItem[][];
		/** A verb's pronouns, one for each cell: я beside чита́ю. Absent in a declension. */
		leads?: (string | undefined)[];
	}[];
}

type Axis = [label: string, tags: string[]][];

interface Spec {
	title: string;
	/** Tags every form in the table has, e.g. ["present"]. */
	tags: string[];
	rows: Axis;
	columns: Axis;
}

const CASES: Axis = [
	['Nominative', ['nominative']],
	['Genitive', ['genitive']],
	['Dative', ['dative']],
	['Accusative', ['accusative']],
	['Instrumental', ['instrumental']],
	['Locative', ['locative']],
	['Vocative', ['vocative']]
];

const NUMBER: Axis = [
	['Singular', ['singular']],
	['Plural', ['plural']]
];

const PERSONS: Axis = [
	['1st person', ['first-person']],
	['2nd person', ['second-person']],
	['3rd person', ['third-person']]
];

const SPECS: Record<string, Spec[]> = {
	noun: [{ title: 'Declension', tags: [], rows: CASES, columns: NUMBER }],
	adj: [
		{
			title: 'Declension',
			tags: [],
			rows: CASES,
			columns: [
				['Masculine', ['masculine']],
				['Neuter', ['neuter']],
				['Feminine', ['feminine']],
				['Plural', ['plural']]
			]
		}
	],
	verb: [
		{ title: 'Present', tags: ['present'], rows: PERSONS, columns: NUMBER },
		{ title: 'Future', tags: ['future'], rows: PERSONS, columns: NUMBER },
		{
			title: 'Past',
			tags: ['past'],
			rows: [
				['Masculine', ['masculine', 'singular']],
				['Feminine', ['feminine', 'singular']],
				['Neuter', ['neuter', 'singular']],
				['Plural', ['plural']]
			],
			columns: [['', []]]
		},
		{
			title: 'Imperative',
			tags: ['imperative'],
			rows: [
				['2nd person singular', ['second-person', 'singular']],
				['1st person plural', ['first-person', 'plural']],
				['2nd person plural', ['second-person', 'plural']]
			],
			columns: [['', []]]
		}
	]
};
SPECS.name = SPECS.noun;
SPECS.num = SPECS.adj;
const PERSONAL_PRONOUN: Spec[] = [{ title: 'Declension', tags: [], rows: CASES, columns: [['', []]] }];

const CASE_TAGS = new Set(CASES.flatMap(([, tags]) => tags));
const PERSONS_TAGS = new Set(PERSONS.flatMap(([, tags]) => tags));

// Wiktionary gives every personal pronoun (я, ти, він, себе…) one shared table.
// Keep only this pronoun's forms: those labelled like the form that spells the
// word, apart from the case (він: masculine singular 3rd person).
function ownPronounForms(word: string, forms: Form[]): Form[] {
	const plainForm = (f: Form) => f.form.replace(/́/g, '').toLowerCase();
	const self = forms
		.filter((f) => plainForm(f) === word.toLowerCase())
		.sort((a, b) => Number(b.tags.includes('nominative')) - Number(a.tags.includes('nominative')))[0];
	if (!self) return forms;
	const identity = (f: Form) => f.tags.filter((t) => !CASE_TAGS.has(t)).sort().join(' ');
	const own = identity(self);
	return forms.filter((f) => identity(f) === own);
}

const NOTES = new Set(['animate', 'inanimate', 'dated', 'dialectal', 'colloquial', 'rare', 'archaic']);

// Participles and adverbial forms also carry "present" or "past", but they are
// not part of the conjugation tables.
const NOT_IN_TABLES = new Set(['adverbial', 'passive', 'impersonal', 'active', 'participle']);

export interface OtherForms {
	/** What the forms have in common; grammar.ts (`otherFormLabel`) names it for a reader. */
	tags: string[];
	forms: string[];
}

export function formTables(
	pos: string, forms: Form[], word = ''
): { tables: FormTable[]; other: OtherForms[] } {
	let specs = SPECS[pos] ?? [];
	if (pos === 'pron') {
		// Personal pronouns have a person; the rest (мій, цей) decline like adjectives.
		const personal = forms.some((f) => f.tags.some((t) => PERSONS_TAGS.has(t)) || f.tags.includes('reflexive'));
		if (personal) forms = ownPronounForms(word, forms);
		specs = personal ? PERSONAL_PRONOUN : SPECS.adj;
	}
	const used = new Set<Form>();
	const tables: FormTable[] = [];
	for (const spec of specs) {
		const rows = spec.rows.map(([label, rowTags]) => ({
			label,
			cells: spec.columns.map(([, colTags]) => {
				const need = [...spec.tags, ...rowTags, ...colTags];
				const items: CellItem[] = [];
				for (const f of forms) {
					if (!need.every((t) => f.tags.includes(t))) continue;
					if (f.tags.some((t) => NOT_IN_TABLES.has(t))) continue;
					used.add(f);
					const note = f.tags.find((t) => NOTES.has(t));
					if (!items.some((i) => i.form === f.form && i.note === note)) items.push({ form: f.form, note });
				}
				return items;
			})
		}));
		// Drop columns and rows with nothing in them (Київ has no plural).
		const keep = spec.columns.map((_, c) => rows.some((r) => r.cells[c].length));
		const columns = spec.columns.filter((_, c) => keep[c]);
		const filled = spec.rows
			.map(([, rowTags], r) => ({
				label: rows[r].label,
				cells: rows[r].cells.filter((_, c) => keep[c]),
				// Only a verb's cells have someone who acts: я чита́ю, вона чита́ла
				leads: pos === 'verb'
					? columns.map(([, colTags]) => pronounFor([...spec.tags, ...rowTags, ...colTags]))
					: undefined
			}))
			.filter((r) => r.cells.some((cell) => cell.length));
		if (filled.length) {
			tables.push({
				title: spec.title,
				columns: columns.map(([label]) => label),
				rows: filled
			});
		}
	}

	// Everything else, with variants that share their tags grouped together.
	const other = new Map<string, OtherForms>();
	for (const f of forms) {
		if (used.has(f)) continue;
		const tags = shownTags(f.tags);
		const key = [...tags].sort().join(' ');
		const group = other.get(key) ?? { tags, forms: [] };
		if (!group.forms.includes(f.form)) group.forms.push(f.form);
		other.set(key, group);
	}
	return { tables, other: [...other.values()] };
}
