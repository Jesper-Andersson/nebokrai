// Drawing sentences for a round of grammar practice, and offering each with
// the forms to choose among. A preposition's sentences are in the `cloze`
// table (data/import_wiktionary.py, add_cloze); a number's are made from a
// list of nouns (numbers.ts) and the forms the dictionary has for them, and
// so are the "who does what to whom" sentences (roles.ts). Runs
// on D1 and on a local SQLite file alike (search/db.ts), so `npm test` checks
// it against the real sentences.
import type { Db } from '../search/db.ts';
import { plain } from '../search/normalize.ts';
import { withAdapted, withColumn } from '../search/word.ts';
import { COUNTED, drawNumber, isNumberPoint, numberCount, numberGap, type NumberDraw } from './numbers.ts';
import type { PointCase } from './points.ts';
import type { Gap, Random } from './round.ts';
import { ROLES_POINT, drawRoles, isRolesPoint, rolesCount, rolesGap, type RolesDraw } from './roles.ts';
import { WHERE, WHERE_MARK, isWherePoint, partnerOf } from './where.ts';

/** The most sentences one request may ask for: two rounds. */
export const MAX_GAPS = 20;
const CHOICES = 4;

const CASE_OF: Record<string, PointCase> = {
	gen: 'genitive', dat: 'dative', acc: 'accusative', ins: 'instrumental', loc: 'locative'
};

/**
 * The wrong cases most worth offering, the likeliest first: what a learner
 * puts instead. After a verb that asks for the dative, the accusative is the
 * usual slip (дякую маму), then the genitive and the dictionary form; after
 * на or у with the accusative, the locative (на столі for на стіл). A case not
 * named comes after these, in no order.
 */
const LIKELY: Record<string, readonly PointCase[]> = {
	dative: ['accusative', 'genitive', 'nominative'],
	genitive: ['accusative', 'nominative'],
	instrumental: ['nominative', 'accusative'],
	'na-accusative': ['locative'],
	'u-accusative': ['locative'],
	'z-instrumental': ['genitive']
};

/** The likely wrong cases of a point, by its id: на + accusative is na-acc, чекати на + кого? chekaty-na-acc. */
function likelyOf(point: string, wanted: PointCase): readonly PointCase[] {
	const parts = point.split('-');
	const prep = parts.length > 1 ? parts[parts.length - 2] : '';
	return LIKELY[`${prep}-${wanted}`] ?? LIKELY[wanted] ?? [];
}

/**
 * How many sentences each grammar point has. A database built before the
 * sentences were has only the numbers' points, which need none.
 */
export async function pointCounts(db: Db): Promise<Record<string, number>> {
	const counts = await clozeCounts(db);
	for (const point of ['one-nom', 'few-nom', 'many-gen']) counts[point] = numberCount(point);
	counts[ROLES_POINT] = rolesCount();
	return counts;
}

async function clozeCounts(db: Db): Promise<Record<string, number>> {
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
	adapted: number;
	cue_start: number | null;
	cue_length: number | null;
	word: string;
	headword: string;
}

/**
 * With `cloze.cue_start` and `cue_length`, where the verb of a government
 * point stands; a table made before they were added (November 2026) has none.
 */
const withCue = <T>(query: (columns: string) => Promise<T>) =>
	withColumn('c.cue_start, c.cue_length', 'NULL AS cue_start, NULL AS cue_length', query);

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
 * The noun in the case of the other question, with stress: вершині beside
 * вершину. The first spelling the dictionary gives, where it has two (столі,
 * столу); none where it has no such form.
 */
function partnerForm(forms: FormRow[], point: string, number: 'singular' | 'plural'): string | undefined {
	const wanted = CASE_OF[point.slice(point.lastIndexOf('-') + 1)];
	return forms.find((form) => {
		const tags: string[] = JSON.parse(form.tags);
		return tags.includes(wanted) && tags.includes(number);
	})?.form;
}

/** A sentence picked for a where item: its point and its Tatoeba id (where.ts). */
interface WhereDraw {
	where: string;
	id: number;
}

/** One of a point's where sentences not yet taken this round, or none when all are. */
function drawWhere(point: string, random: Random, taken: Set<string>): WhereDraw | null {
	const ids = WHERE[point];
	let at = Math.floor(random() * ids.length);
	for (let tries = 0; tries < ids.length && taken.has(`${point} t${ids[at]}`); tries++) at = (at + 1) % ids.length;
	if (taken.has(`${point} t${ids[at]}`)) return null;
	taken.add(`${point} t${ids[at]}`);
	return { where: point, id: ids[at] };
}

/**
 * One sentence for each of `points`, in their order; a point named twice
 * gets two different sentences. A point with no sentences is passed over.
 *
 * A point named with `:where` (`u-acc:where`) is asked as де? or куди?: its
 * sentence is one of those picked by hand in where.ts, and comes back with
 * `kind: 'where'`. A point with no such sentences is drawn as if unmarked.
 *
 * A sentence is found by its number within the point, drawn here, so a round
 * reads ten rows of `cloze` and not the thousand a point may have.
 */
export async function drawGaps(db: Db, points: readonly string[], random: Random): Promise<Gap[]> {
	const asked = points.slice(0, MAX_GAPS);
	// The meta row is read only where a preposition is asked for: a round of numbers needs no sentences
	const made = (point: string) => isNumberPoint(point) || isRolesPoint(point);
	const counts = asked.some((point) => !made(point)) ? await clozeCounts(db) : {};
	const drawn: ([point: string, n: number] | NumberDraw | WhereDraw | RolesDraw)[] = [];
	const taken = new Set<string>();
	const counted = new Set<number>();
	const beings = new Set<string>();
	for (const named of asked) {
		const where = named.endsWith(WHERE_MARK) ? named.slice(0, -WHERE_MARK.length) : null;
		if (where !== null && isWherePoint(where)) {
			const draw = drawWhere(where, random, taken);
			if (draw) drawn.push(draw);
			continue;
		}
		const point = where ?? named;
		if (isRolesPoint(point)) {
			drawn.push(drawRoles(random, beings));
			continue;
		}
		if (isNumberPoint(point)) {
			const draw = drawNumber(point, random, counted);
			if (draw) drawn.push(draw);
			continue;
		}
		const count = counts[point];
		if (!count) continue;
		let n = Math.floor(random() * count);
		// Taken already in this round: the next free one, round the end if need be
		for (let tries = 0; tries < count && taken.has(`${point} ${n}`); tries++) n = (n + 1) % count;
		taken.add(`${point} ${n}`);
		drawn.push([point, n]);
	}
	if (!drawn.length) return [];

	const sentences = drawn.filter((draw) => Array.isArray(draw));
	const rows = sentences.length
		? await withAdapted('c', (column) => withCue((cue) => db.all<ClozeRow>(
				`SELECT c.point, c.n, c.entry_id, c.uk, c.en, c.start, c.length, c.form, c.number, c.tatoeba_id, ${column},
				        ${cue}, e.word, e.headword
				 FROM json_each(?) j
				 CROSS JOIN cloze c ON c.point = json_extract(j.value, '$[0]') AND c.n = json_extract(j.value, '$[1]')
				 JOIN entries e ON e.id = c.entry_id`,
				[JSON.stringify(sentences)]
			)))
		: [];
	const found = new Map(rows.map((row) => [`${row.point} ${row.n}`, row]));

	// A where item's sentence is named by its Tatoeba id (where.ts). The index
	// on (point, n) narrows the search to the point's rows, so this reads up to
	// a point's thousand or so, not the whole table; an index on tatoeba_id
	// would make it one, at the next rebuild of the dictionary.
	const wheres = drawn.filter((draw): draw is WhereDraw => 'where' in draw);
	const whereRows = wheres.length
		? await withAdapted('c', (column) => withCue((cue) => db.all<ClozeRow>(
				`SELECT c.point, c.n, c.entry_id, c.uk, c.en, c.start, c.length, c.form, c.number, c.tatoeba_id, ${column},
				        ${cue}, e.word, e.headword
				 FROM json_each(?) j
				 CROSS JOIN cloze c
				   ON c.point = json_extract(j.value, '$[0]') AND c.tatoeba_id = json_extract(j.value, '$[1]')
				 JOIN entries e ON e.id = c.entry_id`,
				[JSON.stringify(wheres.map((draw) => [draw.where, draw.id]))]
			)))
		: [];
	const foundWhere = new Map(whereRows.map((row) => [`${row.point} ${row.tatoeba_id}`, row]));
	rows.push(...whereRows);

	// The nouns counted, and those of a who item: a word can have two entries
	// (стіл, собака), tried in the dictionary's order
	const words = [
		...new Set(
			drawn.flatMap((draw) =>
				'noun' in draw ? [draw.noun.word] : 'verb' in draw ? [draw.doer.word, draw.done.word] : []
			)
		)
	];
	const nouns = words.length
		? await db.all<{ id: number; word: string; headword: string }>(
				`SELECT id, word, headword FROM entries
				 WHERE pos = 'noun' AND word IN (SELECT value FROM json_each(?)) ORDER BY id`,
				[JSON.stringify(words)]
			)
		: [];

	const forms = new Map<number, FormRow[]>();
	const ids = [...new Set([...rows.map((row) => row.entry_id), ...nouns.map((noun) => noun.id)])];
	for (const form of await db.all<FormRow>(
		'SELECT entry_id, form, plain, tags FROM forms WHERE entry_id IN (SELECT value FROM json_each(?))',
		[JSON.stringify(ids)]
	)) {
		const list = forms.get(form.entry_id) ?? [];
		list.push(form);
		forms.set(form.entry_id, list);
	}

	const gaps: Gap[] = [];
	for (const draw of drawn) {
		if (Array.isArray(draw)) {
			const row = found.get(`${draw[0]} ${draw[1]}`);
			if (row) gaps.push(gapOf(row, forms.get(row.entry_id) ?? [], random));
			continue;
		}
		if ('where' in draw) {
			const row = foundWhere.get(`${draw.where} ${draw.id}`);
			if (row) {
				const own = forms.get(row.entry_id) ?? [];
				const partner = partnerForm(own, partnerOf(row.point), row.number);
				gaps.push({ ...gapOf(row, own, random), kind: 'where', ...(partner ? { partner } : {}) });
			}
			continue;
		}
		if ('verb' in draw) {
			const entries = (word: string) =>
				nouns.filter((entry) => entry.word === word).map((entry) => ({ ...entry, forms: forms.get(entry.id) ?? [] }));
			const gap = entries(draw.doer.word)
				.flatMap((doer) => entries(draw.done.word).map((done) => rolesGap(draw, doer, done)))
				.find((made) => made !== null);
			if (gap) gaps.push(gap);
			continue;
		}
		for (const noun of nouns.filter((entry) => entry.word === draw.noun.word)) {
			const gap = numberGap(draw, noun, forms.get(noun.id) ?? [], random);
			if (gap) {
				gaps.push(gap);
				break;
			}
		}
	}
	return gaps;
}

/**
 * The sentence with what is offered beside it. The wrong choices are other
 * forms of the same noun, of the same number where there are enough: what is
 * practised is the case, and a singular beside three plurals would give
 * itself away. A second spelling of the case wanted (стіл has both столі
 * and столу for the locative) is never offered as wrong, and is taken as
 * right when typed. Of the wrong ones, the likeliest slips come first
 * (likelyOf): ма́му and ма́ми beside ма́мі.
 *
 * A personal pronoun's page holds the table of every pronoun (мені is under
 * ти too), so only the row of the one in the sentence is used: тобі is
 * offered beside тебе and тобою, never beside мені.
 */
function gapOf(row: ClozeRow, forms: FormRow[], random: Random): Gap {
	const wanted = CASE_OF[row.point.slice(row.point.lastIndexOf('-') + 1)];
	const own = plain(row.form);
	forms = ownRow(forms, own, wanted);
	const likely = likelyOf(row.point, wanted);

	const spellings = new Map<string, { form: string; right: boolean; near: boolean; rank: number }>();
	for (const form of forms) {
		const tags: string[] = JSON.parse(form.tags);
		const sameNumber = tags.includes(row.number);
		const right = sameNumber && tags.includes(wanted);
		// A spelling that is only the vocative (краватко) stands back with the
		// other number's forms: it follows no preposition, so it is no temptation.
		const near = sameNumber && !tags.includes('vocative');
		const at = likely.findIndex((kase) => tags.includes(kase));
		const rank = at < 0 ? likely.length : at;
		const had = spellings.get(form.plain);
		spellings.set(form.plain, {
			form: had?.form ?? form.form,
			right: right || (had?.right ?? false),
			near: near || (had?.near ?? false),
			rank: Math.min(rank, had?.rank ?? rank)
		});
	}

	const wrong = [...spellings.values()].filter((s) => !s.right);
	// Shuffled first, so that the sort, which keeps ties in place, leaves them in no order
	const byRank = (list: typeof wrong) => shuffled(list, random).sort((a, b) => a.rank - b.rank);
	const near = byRank(wrong.filter((s) => s.near));
	const far = byRank(wrong.filter((s) => !s.near));
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
		tatoeba_id: row.tatoeba_id,
		adapted: Boolean(row.adapted),
		...(row.cue_start !== null && row.cue_length !== null ? { cue_start: row.cue_start, cue_length: row.cue_length } : {})
	};
}

/** The case names among a form's tags, taken away to leave which pronoun's row it is in. */
const CASE_TAGS = new Set(['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'locative', 'vocative']);

/**
 * A personal pronoun's forms in the row of the one asked (ти: ти, тебе, тобі,
 * тобою), found by the tags the answer has besides its case; any other
 * word's forms as they are.
 */
function ownRow(forms: FormRow[], own: string, wanted: PointCase): FormRow[] {
	const parsed = forms.map((form) => ({ form, tags: JSON.parse(form.tags) as string[] }));
	const answer = parsed.find(({ form, tags }) => form.plain === own && tags.includes(wanted));
	if (!answer || !answer.tags.includes('personal')) return forms;
	const row = (tags: string[]) => tags.filter((tag) => !CASE_TAGS.has(tag)).sort().join(' ');
	const wantedRow = row(answer.tags);
	return parsed.filter(({ tags }) => row(tags) === wantedRow).map(({ form }) => form);
}
