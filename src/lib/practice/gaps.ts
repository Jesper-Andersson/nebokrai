// Drawing sentences for a round of grammar practice from the `cloze` table
// (data/import_wiktionary.py, add_cloze), and offering each with the forms to
// choose among. Runs on D1 and on a local SQLite file alike (search/db.ts),
// so `npm test` checks it against the real sentences.
import type { Db } from '../search/db.ts';
import { plain } from '../search/normalize.ts';
import type { PointCase } from './points.ts';
import type { Gap, Random } from './round.ts';

/** The most sentences one request may ask for: two rounds. */
export const MAX_GAPS = 20;
const CHOICES = 4;

const CASE_OF: Record<string, PointCase> = { gen: 'genitive', acc: 'accusative', ins: 'instrumental', loc: 'locative' };

/**
 * How many sentences each grammar point has. Empty for a database built
 * before the sentences were: the page then says there is nothing to practise.
 */
export async function pointCounts(db: Db): Promise<Record<string, number>> {
	const rows = await db.all<{ value: string }>("SELECT value FROM meta WHERE key = 'cloze_points'");
	const counts: Record<string, number> = {};
	try {
		for (const [point, count] of Object.entries(JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>)) {
			if (Number.isInteger(count) && (count as number) > 0) counts[point] = count as number;
		}
	} catch {
		// Not JSON: as if there were no sentences
	}
	return counts;
}

interface ClozeRow {
	point: string;
	n: number;
	entry_id: number;
	uk: string;
	en: string;
	start: number;
	length: number;
	form: string;
	number: 'singular' | 'plural';
	tatoeba_id: number;
	word: string;
	headword: string;
}

interface FormRow {
	entry_id: number;
	form: string;
	plain: string;
	tags: string;
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * One sentence for each of `points`, in their order; a point named twice
 * gets two different sentences. A point with no sentences is passed over.
 *
 * A sentence is found by its number within the point, drawn here, so a round
 * reads ten rows of `cloze` and not the thousand a point may have.
 */
export async function drawGaps(db: Db, points: readonly string[], random: Random): Promise<Gap[]> {
	const counts = await pointCounts(db);
	const drawn: [point: string, n: number][] = [];
	const taken = new Set<string>();
	for (const point of points.slice(0, MAX_GAPS)) {
		const count = counts[point];
		if (!count) continue;
		let n = Math.floor(random() * count);
		// Taken already in this round: the next free one, round the end if need be
		for (let tries = 0; tries < count && taken.has(`${point} ${n}`); tries++) n = (n + 1) % count;
		taken.add(`${point} ${n}`);
		drawn.push([point, n]);
	}
	if (!drawn.length) return [];

	const rows = await db.all<ClozeRow>(
		`SELECT c.point, c.n, c.entry_id, c.uk, c.en, c.start, c.length, c.form, c.number, c.tatoeba_id,
		        e.word, e.headword
		 FROM json_each(?) j
		 CROSS JOIN cloze c ON c.point = json_extract(j.value, '$[0]') AND c.n = json_extract(j.value, '$[1]')
		 JOIN entries e ON e.id = c.entry_id`,
		[JSON.stringify(drawn)]
	);
	const found = new Map(rows.map((row) => [`${row.point} ${row.n}`, row]));

	const forms = new Map<number, FormRow[]>();
	const ids = [...new Set(rows.map((row) => row.entry_id))];
	for (const form of await db.all<FormRow>(
		'SELECT entry_id, form, plain, tags FROM forms WHERE entry_id IN (SELECT value FROM json_each(?))',
		[JSON.stringify(ids)]
	)) {
		const list = forms.get(form.entry_id) ?? [];
		list.push(form);
		forms.set(form.entry_id, list);
	}

	const gaps: Gap[] = [];
	for (const [point, n] of drawn) {
		const row = found.get(`${point} ${n}`);
		if (row) gaps.push(gapOf(row, forms.get(row.entry_id) ?? [], random));
	}
	return gaps;
}

/**
 * The sentence with what is offered beside it. The wrong choices are other
 * forms of the same noun, of the same number where there are enough: what is
 * practised is the case, and a singular beside three plurals would give
 * itself away. A second spelling of the case wanted (стіл has both столі
 * and столу for the locative) is never offered as wrong, and is taken as
 * right when typed.
 */
function gapOf(row: ClozeRow, forms: FormRow[], random: Random): Gap {
	const wanted = CASE_OF[row.point.slice(row.point.lastIndexOf('-') + 1)];
	const own = plain(row.form);

	const spellings = new Map<string, { form: string; right: boolean; near: boolean }>();
	for (const form of forms) {
		const tags: string[] = JSON.parse(form.tags);
		const sameNumber = tags.includes(row.number);
		const right = sameNumber && tags.includes(wanted);
		// A spelling that is only the vocative (краватко) stands back with the
		// other number's forms: it follows no preposition, so it is no temptation.
		const near = sameNumber && !tags.includes('vocative');
		const had = spellings.get(form.plain);
		spellings.set(form.plain, {
			form: had?.form ?? form.form,
			right: right || (had?.right ?? false),
			near: near || (had?.near ?? false)
		});
	}

	const wrong = [...spellings.values()].filter((s) => !s.right);
	const near = shuffled(wrong.filter((s) => s.near), random);
	const far = shuffled(wrong.filter((s) => !s.near), random);
	const offered = [...near, ...far].slice(0, CHOICES - 1).map((s) => s.form);

	return {
		point: row.point,
		uk: row.uk,
		en: row.en,
		start: row.start,
		length: row.length,
		answer: row.form,
		also: [...spellings].filter(([key, s]) => s.right && key !== own).map(([key]) => key),
		number: row.number,
		word: row.word,
		headword: row.headword,
		choices: shuffled([row.form, ...offered], random),
		forms: [...spellings.keys()],
		tatoeba_id: row.tatoeba_id
	};
}
