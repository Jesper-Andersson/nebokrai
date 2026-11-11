// Turns the flat `forms` list of a word (one row per table cell, placed by its
// tags, see docs/api.md "Reading forms") into tables the Details page can draw.
// A form that fits no table cell goes into `other`, so nothing is lost when
// Wiktionary uses an unusual layout.

export interface Form {
	form: string;
	tags: string[];
}

export interface CellItem {
	form: string;
	/** Short label when one cell holds variants that differ: "anim.", "inan." */
	note?: string;
}

export interface FormTable {
	title: string;
	columns: string[];
	rows: { label: string; cells: CellItem[][] }[];
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

const NOTES: Record<string, string> = {
	animate: 'anim.', inanimate: 'inan.', dated: 'dated', dialectal: 'dial.',
	colloquial: 'colloq.', rare: 'rare', archaic: 'archaic'
};

// Participles and adverbial forms also carry "present" or "past", but they are
// not part of the conjugation tables.
const NOT_IN_TABLES = new Set(['adverbial', 'passive', 'impersonal', 'active', 'participle']);

export interface OtherForms {
	label: string;
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
					const note = f.tags.map((t) => NOTES[t]).find(Boolean);
					if (!items.some((i) => i.form === f.form && i.note === note)) items.push({ form: f.form, note });
				}
				return items;
			})
		}));
		// Drop columns and rows with nothing in them (Київ has no plural).
		const keep = spec.columns.map((_, c) => rows.some((r) => r.cells[c].length));
		const filled = rows
			.filter((r) => r.cells.some((cell) => cell.length))
			.map((r) => ({ label: r.label, cells: r.cells.filter((_, c) => keep[c]) }));
		if (filled.length) {
			tables.push({
				title: spec.title,
				columns: spec.columns.filter((_, c) => keep[c]).map(([label]) => label),
				rows: filled
			});
		}
	}

	// Everything else, with variants that share a label grouped together.
	const other = new Map<string, string[]>();
	for (const f of forms) {
		if (used.has(f)) continue;
		const label = describeTags(f.tags);
		const group = other.get(label) ?? [];
		if (!group.includes(f.form)) group.push(f.form);
		other.set(label, group);
	}
	return { tables, other: [...other].map(([label, forms]) => ({ label, forms })) };
}

// Shown elsewhere on the page (the aspect is beside the headword), or noise.
const HIDDEN_TAGS = new Set(['imperfective', 'perfective', 'pronoun', 'personal']);

/** "first-person" → "1st person", for labels outside the tables. */
export function describeTags(tags: string[]): string {
	const shown = tags.filter((t) => !HIDDEN_TAGS.has(t));
	return (shown.length ? shown : tags)
		.map((t) => t.replace('first-person', '1st person').replace('second-person', '2nd person')
			.replace('third-person', '3rd person'))
		.join(', ');
}
