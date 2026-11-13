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

/** True for the tags of a case form ("genitive"): a form of the word itself, not a word of its own. */
export const hasCase = (tags: string[]) => tags.some((t) => CASE_TAGS.has(t));
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

// Shown elsewhere on the page (the aspect is beside the headword), or noise.
const HIDDEN_TAGS = new Set(['imperfective', 'perfective', 'pronoun', 'personal']);

const readable = (tag: string) =>
	tag.replace('first-person', '1st person').replace('second-person', '2nd person')
		.replace('third-person', '3rd person');

// The order a form is described in: "1st person singular present",
// "animate masculine singular". Tags not listed follow, in alphabetical order.
const PHRASE_ORDER = [
	'first-person', 'second-person', 'third-person', 'animate', 'inanimate',
	'masculine', 'feminine', 'neuter', 'singular', 'plural', 'present', 'future', 'past', 'imperative'
];
const GENDERS = new Set(['masculine', 'feminine', 'neuter']);
const CASE_ORDER = CASES.flatMap(([, tags]) => tags);

/** The tags of a form, without its case, as a phrase: "masculine/neuter singular". */
function phrase(tags: string[]): string {
	const place = (t: string) => (PHRASE_ORDER.includes(t) ? PHRASE_ORDER.indexOf(t) : PHRASE_ORDER.length);
	const ordered = tags.filter((t) => !HIDDEN_TAGS.has(t))
		.sort((a, b) => place(a) - place(b) || (a < b ? -1 : a > b ? 1 : 0));
	const genders = ordered.filter((t) => GENDERS.has(t));
	return ordered
		.filter((t) => !GENDERS.has(t) || t === genders[0])
		.map((t) => (GENDERS.has(t) ? genders.join('/') : readable(t)))
		.join(' ');
}

/** A cell's name among an entry's tables, for telling which are shown while the forms are covered. */
export const cellKey = (table: string, row: string, column: number): string => `${table}|${row}|${column}`;

/**
 * What covering the forms leaves to recall (FormTables.svelte): the cells
 * that hold a form, by their keys, and the one that stays in sight.
 *
 * That one is the cell of the dictionary form itself, the first whose only
 * form is the headword: a noun's nominative singular. The other forms are
 * made from it, and it stands at the top of the page anyway. Only the first:
 * the accusative of a thing is spelt the same (стіл), and that is one of the
 * forms to recall. A verb's tables do not hold the infinitive, so none is given.
 */
export function coverable(tables: FormTable[], headword: string): { cells: string[]; given: string | null } {
	const cells: string[] = [];
	let given: string | null = null;
	for (const table of tables) {
		for (const row of table.rows) {
			row.cells.forEach((cell, column) => {
				if (!cell.length) return;
				const key = cellKey(table.title, row.label, column);
				if (given === null && headword && cell.every((item) => item.form === headword)) given = key;
				else cells.push(key);
			});
		}
	}
	return { cells, given };
}

export interface MatchedForm {
	/** With its stress: руки́ */
	form: string;
	/** What it is, one label per kind of form: "genitive singular" */
	labels: string[];
}

/**
 * What a search result says about the form that found it (`matched_forms`).
 * One spelling is often several forms, and they may be stressed apart, so the
 * forms are grouped by their stressed spelling, and the cases that share
 * everything else are named together:
 *
 *   руки → руки́: genitive singular · ру́ки: nominative, accusative, vocative plural
 *
 * At most `limit` labels are given; `more` counts the rest (an adjective's
 * доброго is six forms).
 */
export function groupMatched(forms: Form[], limit = 4): { groups: MatchedForm[]; more: number } {
	const byForm = new Map<string, Map<string, string[]>>(); // form → what it is, without the case → cases
	for (const f of forms) {
		const kinds = byForm.get(f.form) ?? new Map<string, string[]>();
		byForm.set(f.form, kinds);
		const kind = phrase(f.tags.filter((t) => !CASE_TAGS.has(t)));
		const cases = kinds.get(kind) ?? [];
		kinds.set(kind, cases);
		for (const t of f.tags) if (CASE_TAGS.has(t) && !cases.includes(t)) cases.push(t);
	}
	const groups: MatchedForm[] = [];
	let more = 0;
	let room = limit;
	for (const [form, kinds] of byForm) {
		const labels: string[] = [];
		for (const [kind, cases] of kinds) {
			if (room-- <= 0) {
				more++;
				continue;
			}
			const named = CASE_ORDER.filter((c) => cases.includes(c)).join(', ');
			labels.push([named, kind].filter(Boolean).join(' '));
		}
		if (labels.length) groups.push({ form, labels });
	}
	return { groups, more };
}
