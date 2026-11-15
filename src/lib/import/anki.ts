// Reading an Anki package (.apkg, .colpkg) into plain objects: note types,
// notes, cards with their memory, and the review log. Nothing is sent
// anywhere; the page decides what to keep (deck.ts).
//
// The collection inside the zip is an SQLite file. Anki 23.10 and later
// write it zstd-compressed as collection.anki21b; older versions write
// collection.anki21 or collection.anki2 as they are. The SQLite engine and the
// zstd decoder are passed in, so the browser can load them only when needed
// and the tests can use their own.
import { readFirst } from './zip.ts';

/** The part of an SQLite engine this file uses. */
export interface SqlDb {
	all(sql: string): Record<string, unknown>[];
	close(): void;
}
export type OpenSql = (bytes: Uint8Array) => SqlDb | Promise<SqlDb>;

/** The part of sql.js (SQLite compiled to WebAssembly) that `fromSqlJs` uses. */
interface SqlJsLike {
	Database: new (bytes: Uint8Array) => {
		exec(sql: string): { columns: string[]; values: unknown[][] }[];
		close(): void;
	};
}

/** Open databases with sql.js, as the browser does. */
export function fromSqlJs(SQL: SqlJsLike): OpenSql {
	return (bytes) => {
		const db = new SQL.Database(bytes);
		return {
			all(sql) {
				const [result] = db.exec(sql);
				if (!result) return [];
				return result.values.map((row) => Object.fromEntries(result.columns.map((c, i) => [c, row[i]])));
			},
			close: () => db.close()
		};
	};
}
export type Unzstd = (bytes: Uint8Array) => Uint8Array;

export class AnkiError extends Error {
	readonly code: 'no_collection' | 'unreadable';
	constructor(code: 'no_collection' | 'unreadable') {
		super(code);
		this.code = code;
	}
}

export interface AnkiNoteType {
	id: number;
	name: string;
	fields: string[];
}

export interface AnkiNote {
	id: number;
	type: number;
	/** The fields as stored, HTML and all. */
	fields: string[];
}

/** One answer from the review log. */
export interface AnkiReview {
	/** When, in ms. */
	at: number;
	/** 1 Again, 2 Hard, 3 Good, 4 Easy. */
	ease: 1 | 2 | 3 | 4;
}

export interface AnkiCard {
	id: number;
	note: number;
	deck: number;
	/** Which of the note type's templates: 0 for the front-to-back card, 1 for the reverse. */
	ord: number;
	/** 0 new, 1 learning, 2 review, 3 relearning. */
	type: number;
	/** -1 suspended, -2 and -3 buried, otherwise what is due. */
	queue: number;
	/** A day number from the collection's start for review cards; a time in seconds for cards being learnt. */
	due: number;
	/** Days, for review cards. */
	interval: number;
	reps: number;
	lapses: number;
	/** The FSRS memory Anki kept, when FSRS was switched on. */
	memory: { stability: number; difficulty: number } | null;
	/** Answers in time order, without manual reschedules. */
	reviews: AnkiReview[];
}

export interface AnkiCollection {
	/** The collection's start, ms: day numbers count from it. */
	created: number;
	decks: Map<number, string>;
	noteTypes: AnkiNoteType[];
	notes: AnkiNote[];
	cards: AnkiCard[];
}

const NAMES = ['collection.anki21b', 'collection.anki21', 'collection.anki2'];
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

/**
 * Anki's tables name a collation of its own, "unicase", that no other SQLite
 * knows; any query on those tables then fails ("no query solution"). Renaming
 * it to "nocase " in the schema text (same length, so no byte moves) lets a
 * plain SQLite read them.
 */
export function patchCollation(db: Uint8Array): Uint8Array {
	const from = new TextEncoder().encode('COLLATE unicase');
	const to = new TextEncoder().encode('COLLATE nocase ');
	const out = new Uint8Array(db);
	outer: for (let i = out.indexOf(from[0]); i >= 0 && i <= out.length - from.length; i = out.indexOf(from[0], i + 1)) {
		for (let j = 1; j < from.length; j++) if (out[i + j] !== from[j]) continue outer;
		out.set(to, i);
	}
	return out;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : Number(v ?? 0));
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function json(text: unknown): Record<string, any> {
	try {
		const value = JSON.parse(str(text));
		return value && typeof value === 'object' ? value : {};
	} catch {
		return {};
	}
}

function memoryOf(data: unknown): AnkiCard['memory'] {
	const { s, d } = json(data);
	return typeof s === 'number' && typeof d === 'number' && s > 0 ? { stability: s, difficulty: d } : null;
}

function hasTable(db: SqlDb, name: string): boolean {
	return db.all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${name}'`).length > 0;
}

/** Read the collection out of an Anki package. Throws AnkiError when the file is not one. */
export async function readAnki(file: Blob, open: OpenSql, unzstd: Unzstd): Promise<AnkiCollection> {
	let found;
	try {
		found = await readFirst(file, NAMES);
	} catch {
		throw new AnkiError('unreadable');
	}
	if (!found) throw new AnkiError('no_collection');
	let bytes = found.data;
	if (ZSTD_MAGIC.every((b, i) => bytes[i] === b)) bytes = unzstd(bytes);
	const db = await open(patchCollation(bytes));
	try {
		return collectionOf(db);
	} catch {
		throw new AnkiError('unreadable');
	} finally {
		db.close();
	}
}

/** The collection in an open Anki database. */
export function collectionOf(db: SqlDb): AnkiCollection {
	const col = db.all('SELECT crt, models, decks FROM col')[0] ?? {};
	const created = num(col.crt) * 1000;

	let noteTypes: AnkiNoteType[];
	if (hasTable(db, 'notetypes')) {
		const fields = db.all('SELECT ntid, ord, name FROM fields');
		noteTypes = db.all('SELECT id, name FROM notetypes').map((t) => ({
			id: num(t.id),
			name: str(t.name),
			fields: fields
				.filter((f) => num(f.ntid) === num(t.id))
				.sort((a, b) => num(a.ord) - num(b.ord))
				.map((f) => str(f.name))
		}));
	} else {
		noteTypes = Object.values(json(col.models)).map((m: any) => ({
			id: num(m.id),
			name: str(m.name),
			fields: [...(m.flds ?? [])].sort((a: any, b: any) => num(a.ord) - num(b.ord)).map((f: any) => str(f.name))
		}));
	}

	const decks = new Map<number, string>();
	if (hasTable(db, 'decks')) {
		// Subdecks are named with \x1f between the parts here, and with :: in older files
		for (const d of db.all('SELECT id, name FROM decks')) decks.set(num(d.id), str(d.name).replaceAll('\x1f', '::'));
	} else {
		for (const d of Object.values(json(col.decks)) as any[]) decks.set(num(d.id), str(d.name));
	}

	const notes = db.all('SELECT id, mid, flds FROM notes').map((n) => ({
		id: num(n.id),
		type: num(n.mid),
		fields: str(n.flds).split('\x1f')
	}));

	const reviews = new Map<number, AnkiReview[]>();
	// Types 0–3 are answers (learning, review, relearning, filtered deck);
	// 4 and 5 are reschedules by hand, and ease 0 marks one as well.
	for (const r of db.all('SELECT id, cid, ease, type FROM revlog WHERE ease BETWEEN 1 AND 4 AND type BETWEEN 0 AND 3 ORDER BY id')) {
		const card = num(r.cid);
		const list = reviews.get(card) ?? [];
		list.push({ at: num(r.id), ease: num(r.ease) as AnkiReview['ease'] });
		reviews.set(card, list);
	}

	const cards = db.all('SELECT id, nid, did, ord, type, queue, due, ivl, reps, lapses, data FROM cards').map((c) => ({
		id: num(c.id),
		note: num(c.nid),
		deck: num(c.did),
		ord: num(c.ord),
		type: num(c.type),
		queue: num(c.queue),
		due: num(c.due),
		interval: num(c.ivl),
		reps: num(c.reps),
		lapses: num(c.lapses),
		memory: memoryOf(c.data),
		reviews: reviews.get(num(c.id)) ?? []
	}));

	return { created, decks, noteTypes, notes, cards };
}
