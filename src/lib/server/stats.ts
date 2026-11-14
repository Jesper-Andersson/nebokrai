// How many people use the site: page views, visitors a day and searches,
// counted by the site itself (POST /api/hit) into a private database of its
// own (stats-db.ts), never nebokrai.db or users.db.
//
// No cookie is set and no IP address is stored. A visitor is the SHA-256 of
// a random salt for the day, their IP address and their browser's user agent.
// The salt and the hashes are deleted once the day is over, so even the
// database cannot tell whether yesterday's visitor came back today: what is
// left is counts per day, per page and per search.
//
// The words people search for are kept per day for 90 days, and only when
// they are short (MAX_QUERY_KEPT): a pasted sentence counts as a search but
// its text is not kept. The /stats page shows only words searched by two or
// more visitors in a day.
//
// Nothing here imports from SvelteKit, so `npm test` runs it against an
// in-memory SQLite database (tests/stats.test.ts).
import { SECTION_NAMES, type Section } from '../stats-sections.ts';

/** The database as this file needs it: read rows, or run a statement. */
export interface StatsDb {
	all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
	run(sql: string, params?: unknown[]): Promise<void>;
}

/** One statement per item: D1 prepares a single statement at a time. */
export const STATS_SCHEMA = [
	// Today's salt. Deleted with the visitors when the day is over.
	`CREATE TABLE IF NOT EXISTS salts (
		day TEXT PRIMARY KEY,
		salt TEXT NOT NULL
	)`,
	// Today's visitors, only so that a second page view is not a second visitor.
	`CREATE TABLE IF NOT EXISTS visitors (
		day TEXT NOT NULL,
		hash TEXT NOT NULL,
		signed_in INTEGER NOT NULL,
		PRIMARY KEY (day, hash)
	) WITHOUT ROWID`,
	// Who searched for a word today, only to count them once each.
	`CREATE TABLE IF NOT EXISTS search_visitors (
		day TEXT NOT NULL,
		query TEXT NOT NULL,
		hash TEXT NOT NULL,
		PRIMARY KEY (day, query, hash)
	) WITHOUT ROWID`,
	// The totals of a day, kept for good. day is Kyiv's date, "2026-11-14".
	`CREATE TABLE IF NOT EXISTS daily (
		day TEXT PRIMARY KEY,
		views INTEGER NOT NULL DEFAULT 0,
		visitors INTEGER NOT NULL DEFAULT 0,
		signed_in_visitors INTEGER NOT NULL DEFAULT 0,
		searches INTEGER NOT NULL DEFAULT 0,
		empty_searches INTEGER NOT NULL DEFAULT 0
	)`,
	`CREATE TABLE IF NOT EXISTS page_views (
		day TEXT NOT NULL,
		path TEXT NOT NULL,
		views INTEGER NOT NULL,
		PRIMARY KEY (day, path)
	) WITHOUT ROWID`,
	// empty: how many of those searches found nothing, the words the
	// dictionary lacks.
	`CREATE TABLE IF NOT EXISTS searches (
		day TEXT NOT NULL,
		query TEXT NOT NULL,
		count INTEGER NOT NULL,
		visitors INTEGER NOT NULL,
		empty INTEGER NOT NULL,
		PRIMARY KEY (day, query)
	) WITHOUT ROWID`
];

/** Longest search text kept (after normalising); longer ones are only counted. */
export const MAX_QUERY_KEPT = 40;
/** How long search words and page counts are kept, in days. Day totals are kept for good. */
export const SEARCH_DAYS = 90;
export const PAGE_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;
const KYIV = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });

/** The date in Kyiv at `now`, "2026-11-14": most readers are in Europe, and a day should end at night there. */
export function statsDay(now: number): string {
	return KYIV.format(new Date(now));
}

// The site's own sections. Anything else (a mistyped address, a scanner
// trying /wp-admin) is counted as OTHER, so the table cannot fill with junk.
const SECTIONS = new Set([
	'', 'about', 'alphabet', 'common-words', 'grammar', 'learn', 'practice', 'privacy', 'report', 'resources',
	'review', 'saved', 'sources', 'support', 'words'
]);
export const OTHER = '(other)';

/**
 * The path a page view is counted under: /word/voda keeps its word, a
 * section keeps one level below it (/words/a), the query string is dropped.
 */
export function countedPath(path: string): string {
	if (typeof path !== 'string' || !path.startsWith('/') || path.length > 200) return OTHER;
	const parts = path.split(/[?#]/)[0].split('/').slice(1);
	if (parts.at(-1) === '' && parts.length > 1) parts.pop();
	const [section, sub, ...rest] = parts;
	if (rest.length) return OTHER;
	const segment = /^[\w%.-]{1,100}$/;
	if (section === 'word') return sub && segment.test(sub) ? `/word/${sub}` : OTHER;
	if (!SECTIONS.has(section)) return OTHER;
	if (sub === undefined) return `/${section}`;
	return segment.test(sub) ? `/${section}/${sub}` : OTHER;
}

/** A search as it is counted: one spacing, lower case, no stress marks (во́да and вода are one word). */
export function countedQuery(query: string): string {
	return query.normalize('NFC').replace(/́/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('uk');
}

/** User agents that are programs, not people. Most never run the page's script anyway. */
const BOT = /bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|fetch|curl|wget|python|java\/|httpclient|okhttp|go-http/i;

/** Whether a request should not be counted: a program, or a browser that asks not to be followed. */
export function skipCounting(headers: { get(name: string): string | null }): boolean {
	const ua = headers.get('user-agent') ?? '';
	return !ua || BOT.test(ua) || headers.get('sec-gpc') === '1' || headers.get('dnt') === '1';
}

export interface Visit {
	ip: string;
	userAgent: string;
	signedIn: boolean;
	now: number;
}

const hex = (bytes: ArrayBuffer | Uint8Array) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Days already cleared by this Worker. Two Workers clearing the same day is
// harmless: the deletes find nothing the second time.
let clearedFor = '';

/** Delete what only mattered for a finished day, and counts past their keeping time. */
export async function clearOld(db: StatsDb, now: number): Promise<void> {
	const today = statsDay(now);
	if (clearedFor === today) return;
	await db.run('DELETE FROM visitors WHERE day < ?', [today]);
	await db.run('DELETE FROM search_visitors WHERE day < ?', [today]);
	await db.run('DELETE FROM salts WHERE day < ?', [today]);
	await db.run('DELETE FROM searches WHERE day < ?', [statsDay(now - SEARCH_DAYS * DAY_MS)]);
	await db.run('DELETE FROM page_views WHERE day < ?', [statsDay(now - PAGE_DAYS * DAY_MS)]);
	clearedFor = today;
}

/** Forget which days were cleared (tests move the clock backwards). */
export function resetClearedForTests(): void {
	clearedFor = '';
}

/** Count the visitor for today, once, and return their hash. */
async function countVisitor(db: StatsDb, day: string, visit: Visit): Promise<string> {
	let [row] = await db.all<{ salt: string }>('SELECT salt FROM salts WHERE day = ?', [day]);
	if (!row) {
		const salt = hex(crypto.getRandomValues(new Uint8Array(32)));
		await db.run('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)', [day, salt]);
		// Another request may have made the day's salt first: use the one that was kept.
		[row] = await db.all<{ salt: string }>('SELECT salt FROM salts WHERE day = ?', [day]);
	}
	const data = new TextEncoder().encode(`${row.salt}\n${visit.ip}\n${visit.userAgent}`);
	const hash = hex(await crypto.subtle.digest('SHA-256', data));

	await db.run('INSERT OR IGNORE INTO daily (day) VALUES (?)', [day]);
	const signedIn = visit.signedIn ? 1 : 0;
	const added = await db.all(
		'INSERT OR IGNORE INTO visitors (day, hash, signed_in) VALUES (?, ?, ?) RETURNING 1 AS added',
		[day, hash, signedIn]
	);
	if (added.length) {
		await db.run(
			'UPDATE daily SET visitors = visitors + 1, signed_in_visitors = signed_in_visitors + ? WHERE day = ?',
			[signedIn, day]
		);
	} else if (signedIn) {
		// Read signed out earlier today, signed in now: one visitor, now a signed-in one.
		const changed = await db.all(
			'UPDATE visitors SET signed_in = 1 WHERE day = ? AND hash = ? AND signed_in = 0 RETURNING 1 AS changed',
			[day, hash]
		);
		if (changed.length) await db.run('UPDATE daily SET signed_in_visitors = signed_in_visitors + 1 WHERE day = ?', [day]);
	}
	return hash;
}

/** Count one page view. */
export async function recordView(db: StatsDb, path: string, visit: Visit): Promise<void> {
	await clearOld(db, visit.now);
	const day = statsDay(visit.now);
	await countVisitor(db, day, visit);
	await db.run('UPDATE daily SET views = views + 1 WHERE day = ?', [day]);
	await db.run(
		`INSERT INTO page_views (day, path, views) VALUES (?, ?, 1)
		 ON CONFLICT (day, path) DO UPDATE SET views = views + 1`,
		[day, countedPath(path)]
	);
}

/** Count one search, and what it found. */
export async function recordSearch(db: StatsDb, query: string, results: number, visit: Visit): Promise<void> {
	const text = countedQuery(query);
	if (!text) return;
	await clearOld(db, visit.now);
	const day = statsDay(visit.now);
	const hash = await countVisitor(db, day, visit);
	const empty = results > 0 ? 0 : 1;
	await db.run('UPDATE daily SET searches = searches + 1, empty_searches = empty_searches + ? WHERE day = ?', [empty, day]);
	if (text.length > MAX_QUERY_KEPT) return;
	const first = await db.all(
		'INSERT OR IGNORE INTO search_visitors (day, query, hash) VALUES (?, ?, ?) RETURNING 1 AS first',
		[day, text, hash]
	);
	await db.run(
		`INSERT INTO searches (day, query, count, visitors, empty) VALUES (?, ?, 1, ?, ?)
		 ON CONFLICT (day, query) DO UPDATE SET count = count + 1, visitors = visitors + excluded.visitors,
		 empty = empty + excluded.empty`,
		[day, text, first.length ? 1 : 0, empty]
	);
}

export interface DayRow {
	day: string;
	views: number;
	visitors: number;
	signed_in_visitors: number;
	searches: number;
	empty_searches: number;
}
export interface Ranked {
	key: string;
	count: number;
	visitors?: number;
}

const LEARN = new Set(['learn', 'practice', 'review', 'grammar', 'alphabet', 'common-words']);

/** Which part of the site a counted path is in: /word/voda and /words/a are words, / is search. */
export function sectionOf(path: string): Section {
	if (path === '/') return 'search';
	const top = path.split('/')[1];
	if (top === 'word' || top === 'words') return 'words';
	if (LEARN.has(top)) return 'learn';
	if (top === 'saved') return 'saved';
	return 'other';
}

export interface StatsReport {
	/** The last `days` days, oldest first, a day without visits as zeros. */
	days: DayRow[];
	/** Visitors a day for the calendar: whole weeks from a Monday, the last one up to today. */
	calendar: { day: string; visitors: number }[];
	sections: Record<Section, number>;
	pages: Ranked[];
	searches: Ranked[];
	missing: Ranked[];
}

/** The date `n` days after `day` ("2026-11-14"), by the calendar, not by hours. */
export function addDays(day: string, n: number): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Weeks shown in the calendar. */
export const CALENDAR_WEEKS = 13;

/**
 * The numbers the /stats page shows for the last `days` days: each day, the
 * parts of the site visited, and the top pages, searches and searches that
 * found nothing. A search shows only on a day two or more visitors made it.
 */
export async function statsReport(db: StatsDb, now: number, days = 30, top = 20): Promise<StatsReport> {
	const today = statsDay(now);
	const since = addDays(today, 1 - days);
	// Monday of the first calendar week (getUTCDay: Sunday is 0)
	const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
	const calendarFrom = addDays(today, -weekday - 7 * (CALENDAR_WEEKS - 1));
	const first = since < calendarFrom ? since : calendarFrom;

	const rows = await db.all<DayRow>('SELECT * FROM daily WHERE day >= ? ORDER BY day', [first]);
	const byDay = new Map(rows.map((row) => [row.day, row]));
	const zero = (day: string): DayRow => ({ day, views: 0, visitors: 0, signed_in_visitors: 0, searches: 0, empty_searches: 0 });
	const range = (from: string) => {
		const out: string[] = [];
		for (let day = from; day <= today; day = addDays(day, 1)) out.push(day);
		return out;
	};

	// Word pages are thousands of paths: summed as one in the database.
	const grouped = await db.all<{ path: string; views: number }>(
		`SELECT CASE WHEN path LIKE '/word/%' THEN '/word' ELSE path END AS path, sum(views) AS views
		 FROM page_views WHERE day >= ? GROUP BY 1`,
		[since]
	);
	const sections = Object.fromEntries(SECTION_NAMES.map((name) => [name, 0])) as Record<Section, number>;
	for (const { path, views } of grouped) sections[sectionOf(path)] += views;

	const pages = await db.all<Ranked>(
		`SELECT path AS key, sum(views) AS count FROM page_views WHERE day >= ?
		 GROUP BY path ORDER BY count DESC, path LIMIT ?`,
		[since, top]
	);
	const shown = 'FROM searches WHERE day >= ? AND visitors >= 2';
	const searches = await db.all<Ranked>(
		`SELECT query AS key, sum(count) AS count, sum(visitors) AS visitors ${shown}
		 GROUP BY query ORDER BY count DESC, query LIMIT ?`,
		[since, top]
	);
	const missing = await db.all<Ranked>(
		`SELECT query AS key, sum(empty) AS count, sum(visitors) AS visitors ${shown} AND empty > 0
		 GROUP BY query ORDER BY count DESC, query LIMIT ?`,
		[since, top]
	);
	return {
		days: range(since).map((day) => byDay.get(day) ?? zero(day)),
		calendar: range(calendarFrom).map((day) => ({ day, visitors: byDay.get(day)?.visitors ?? 0 })),
		sections,
		pages,
		searches,
		missing
	};
}
