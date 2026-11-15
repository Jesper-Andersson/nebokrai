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
// When a visitor is first counted on a day, three things about the visit are
// added to that day's counts (the `breakdowns` table): the country Cloudflare
// names for the request, phone or desktop, and the site that sent them (its
// host name only, never the address of the page). They are counts beside the
// others, not columns of the visitor: nothing ties a country to a search.
//
// The words people search for are kept per day for 90 days, and only when
// they are short (MAX_QUERY_KEPT): a pasted sentence counts as a search but
// its text is not kept. The /stats page shows only words searched by two or
// more visitors in a day.
//
// Nothing here imports from SvelteKit, so `npm test` runs it against an
// in-memory SQLite database (tests/stats.test.ts).
import { NOT_FOUND, SECTION_NAMES, type Section } from '../stats-sections.ts';

/** A statement and its parameters. */
export type Statement = [sql: string, params: unknown[]];

/**
 * The database as this file needs it: read rows, or run a statement. `batch`
 * is for a database that is a network trip away (D1): several statements in
 * one trip and one transaction, each answering with its rows. Without it the
 * statements are run one by one.
 */
export interface StatsDb {
	all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
	run(sql: string, params?: unknown[]): Promise<void>;
	batch?(statements: Statement[]): Promise<Record<string, unknown>[][]>;
}

async function runTogether(db: StatsDb, statements: Statement[]): Promise<Record<string, unknown>[][]> {
	if (db.batch) return db.batch(statements);
	const out: Record<string, unknown>[][] = [];
	for (const [sql, params] of statements) out.push(await db.all(sql, params));
	return out;
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
	) WITHOUT ROWID`,
	// Counts of a day by something else than page or search word. kind is
	// 'referrer' (key: a host name or DIRECT), 'country' (key: "UA"), 'device'
	// (key: 'phone' or 'desktop'), each counted once per visitor, or 'search'
	// (key: 'guessed', per search).
	`CREATE TABLE IF NOT EXISTS breakdowns (
		day TEXT NOT NULL,
		kind TEXT NOT NULL,
		key TEXT NOT NULL,
		count INTEGER NOT NULL,
		PRIMARY KEY (day, kind, key)
	) WITHOUT ROWID`
];

/** Longest search text kept (after normalising); longer ones are only counted. */
export const MAX_QUERY_KEPT = 40;
/** How long search words and page counts are kept, in days. Day totals are kept for good. */
export const SEARCH_DAYS = 90;
/** Page counts, and the breakdowns. */
export const PAGE_DAYS = 400;
/** Most keys of one kind in a day's breakdowns; what comes after is counted as OTHER. */
export const MAX_KEYS_A_DAY = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const KYIV = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });

/** The date in Kyiv at `now`, "2026-11-14": most readers are in Europe, and a day should end at night there. */
export function statsDay(now: number): string {
	return KYIV.format(new Date(now));
}

// The site's own sections. Anything else (a mistyped address, a scanner
// trying /wp-admin) is counted as OTHER, so the table cannot fill with junk.
const SECTIONS = new Set([
	'', 'about', 'alphabet', 'common-words', 'grammar', 'import', 'learn', 'practice', 'privacy', 'report',
	'resources', 'review', 'saved', 'sources', 'support', 'words'
]);
export const OTHER = '(other)';

/** Whether a part of an address can be read back: /word/%zz cannot, and would break the page that lists it. */
function decodes(part: string): boolean {
	try {
		decodeURIComponent(part);
		return true;
	} catch {
		return false;
	}
}

/**
 * The path a page view is counted under: /word/voda keeps its word, a
 * section keeps one level below it (/words/a), the query string is dropped.
 * A later page of a list is its list: /words/a/2 is /words/a, and
 * /common-words/7 is /common-words. A page that does not exist arrives as
 * NOT_FOUND (+layout.svelte) and is kept as that.
 */
export function countedPath(path: string): string {
	if (path === NOT_FOUND) return NOT_FOUND;
	if (typeof path !== 'string' || !path.startsWith('/') || path.length > 200) return OTHER;
	const parts = path.split(/[?#]/)[0].split('/').slice(1);
	if (parts.at(-1) === '' && parts.length > 1) parts.pop();
	const [section, sub, ...rest] = parts;
	const page = /^\d{1,4}$/;
	if (section === 'words' && rest.length === 1 && page.test(rest[0])) rest.pop();
	if (rest.length) return OTHER;
	const segment = (part: string) => /^[\w%.-]{1,100}$/.test(part) && decodes(part);
	if (section === 'word') return sub && segment(sub) ? `/word/${sub}` : OTHER;
	if (!SECTIONS.has(section)) return OTHER;
	if (sub === undefined || (section === 'common-words' && page.test(sub))) return `/${section}`;
	return segment(sub) ? `/${section}/${sub}` : OTHER;
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
	/** Cloudflare's two-letter code for where the request came from; absent on a developer's machine. */
	country?: string;
}

/** A visit that no other site sent: a typed address, a bookmark, or a browser that does not say. */
export const DIRECT = '(direct)';

/**
 * The key a referring site is counted under, from the host name the page
 * sent with the first page of a visit (+layout.svelte): `www.reddit.com` is
 * `reddit.com`, nothing or the site itself (`own`) is DIRECT. null when
 * nothing was sent, which is every page after the first, or when it is not a
 * host name: then no referrer is counted.
 */
export function countedReferrer(host: unknown, own: string): string | null {
	if (typeof host !== 'string') return null;
	if (host === '') return DIRECT;
	// Lower case as URL.hostname gives it, with a dot: not `localhost`, not a whole address
	if (host.length > 100 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
	const bare = (name: string) => name.replace(/^www\./, '');
	return bare(host) === bare(own) ? DIRECT : bare(host);
}

/** Phone or desktop, by the user agent. A tablet counts as a desktop: an iPad says it is a Mac. */
export function deviceOf(userAgent: string): 'phone' | 'desktop' {
	return /Mobi|iPhone|iPod|Opera Mini/.test(userAgent) ? 'phone' : 'desktop';
}

/**
 * Add one to a day's count of `key`. A key that is new when the day already
 * has MAX_KEYS_A_DAY of its kind is counted as OTHER, so made-up referrers
 * cannot fill the table.
 */
function countKey(day: string, kind: string, key: string): Statement {
	return [
		`INSERT INTO breakdowns (day, kind, key, count)
		 SELECT ?, ?, CASE
			WHEN EXISTS (SELECT 1 FROM breakdowns WHERE day = ? AND kind = ? AND key = ?)
				OR (SELECT count(*) FROM breakdowns WHERE day = ? AND kind = ?) < ?
			THEN ? ELSE ? END, 1 WHERE true
		 ON CONFLICT (day, kind, key) DO UPDATE SET count = count + 1`,
		[day, kind, day, kind, key, day, kind, MAX_KEYS_A_DAY, key, OTHER]
	];
}

const hex = (bytes: ArrayBuffer | Uint8Array) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The account ids in the secret STATS_USER_IDS: who may read /stats, and whose own visits are not counted. */
export function ownerIds(secret: string | undefined): string[] {
	return (secret ?? '').split(',').map((id) => id.trim()).filter(Boolean);
}

/** Delete what only mattered for a finished day, and counts past their keeping time. */
async function clearOld(db: StatsDb, now: number): Promise<void> {
	const today = statsDay(now);
	await db.run('DELETE FROM visitors WHERE day < ?', [today]);
	await db.run('DELETE FROM search_visitors WHERE day < ?', [today]);
	await db.run('DELETE FROM salts WHERE day < ?', [today]);
	await db.run('DELETE FROM searches WHERE day < ?', [statsDay(now - SEARCH_DAYS * DAY_MS)]);
	await db.run('DELETE FROM page_views WHERE day < ?', [statsDay(now - PAGE_DAYS * DAY_MS)]);
	await db.run('DELETE FROM breakdowns WHERE day < ?', [statsDay(now - PAGE_DAYS * DAY_MS)]);
}

/**
 * Count the visitor for today, once. Returns their hash, and the statements
 * that add them to the day's totals, for the caller to send with its own.
 * A visitor new today also adds their device, their country when Cloudflare
 * gave one, and `referrer` when this is the first page of a visit: once per
 * visitor per day, so a reload or a second tab is not a second arrival.
 *
 * Three trips to the database for a count: the day's salt, the visitor, and
 * the totals. Old rows are cleared by whichever request makes the day's
 * salt, so once a day and not once per Worker started.
 */
async function countVisitor(
	db: StatsDb, day: string, visit: Visit, referrer?: string | null
): Promise<{ hash: string; totals: Statement[] }> {
	let [row] = await db.all<{ salt: string }>('SELECT salt FROM salts WHERE day = ?', [day]);
	if (!row) {
		const salt = hex(crypto.getRandomValues(new Uint8Array(32)));
		await db.run('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)', [day, salt]);
		// Another request may have made the day's salt first: use the one that was kept.
		[row] = await db.all<{ salt: string }>('SELECT salt FROM salts WHERE day = ?', [day]);
		// Two requests clearing the same day is harmless: the second finds nothing.
		await clearOld(db, visit.now);
	}
	const data = new TextEncoder().encode(`${row.salt}\n${visit.ip}\n${visit.userAgent}`);
	const hash = hex(await crypto.subtle.digest('SHA-256', data));

	const signedIn = visit.signedIn ? 1 : 0;
	const [, added] = await runTogether(db, [
		['INSERT OR IGNORE INTO daily (day) VALUES (?)', [day]],
		['INSERT OR IGNORE INTO visitors (day, hash, signed_in) VALUES (?, ?, ?) RETURNING 1 AS added', [day, hash, signedIn]]
	]);
	const totals: Statement[] = [];
	if (added.length) {
		totals.push([
			'UPDATE daily SET visitors = visitors + 1, signed_in_visitors = signed_in_visitors + ? WHERE day = ?',
			[signedIn, day]
		]);
		totals.push(countKey(day, 'device', deviceOf(visit.userAgent)));
		// Two capital letters; XX is Cloudflare's "unknown" and T1 its code for Tor
		if (visit.country && /^[A-Z]{2}$/.test(visit.country) && visit.country !== 'XX') {
			totals.push(countKey(day, 'country', visit.country));
		}
		if (referrer) totals.push(countKey(day, 'referrer', referrer));
	} else if (signedIn) {
		// Read signed out earlier today, signed in now: one visitor, now a signed-in
		// one. The total first, while the visitor's row still says signed out.
		totals.push(
			[
				`UPDATE daily SET signed_in_visitors = signed_in_visitors + 1 WHERE day = ?
				 AND EXISTS (SELECT 1 FROM visitors WHERE day = ? AND hash = ? AND signed_in = 0)`,
				[day, day, hash]
			],
			['UPDATE visitors SET signed_in = 1 WHERE day = ? AND hash = ?', [day, hash]]
		);
	}
	return { hash, totals };
}

/**
 * Count one page view. `referrer` is what countedReferrer() made of the
 * first page's referring site; leave it out for any later page.
 */
export async function recordView(db: StatsDb, path: string, visit: Visit, referrer?: string | null): Promise<void> {
	const day = statsDay(visit.now);
	const { totals } = await countVisitor(db, day, visit, referrer);
	await runTogether(db, [
		...totals,
		['UPDATE daily SET views = views + 1 WHERE day = ?', [day]],
		[
			`INSERT INTO page_views (day, path, views) VALUES (?, ?, 1)
			 ON CONFLICT (day, path) DO UPDATE SET views = views + 1`,
			[day, countedPath(path)]
		]
	]);
}

/**
 * Count one search, and what it found. A search with no results but with
 * `suggested` guesses ("did you mean") did not find nothing: the visitor was
 * shown a word, most often the one they meant. It is counted as 'guessed'
 * and stays out of the searches that found nothing.
 */
export async function recordSearch(
	db: StatsDb, query: string, results: number, visit: Visit, suggested = 0
): Promise<void> {
	const text = countedQuery(query);
	if (!text) return;
	const day = statsDay(visit.now);
	const { hash, totals } = await countVisitor(db, day, visit);
	const guessed = results <= 0 && suggested > 0;
	const empty = results > 0 || guessed ? 0 : 1;
	const writes: Statement[] = [
		...totals,
		['UPDATE daily SET searches = searches + 1, empty_searches = empty_searches + ? WHERE day = ?', [empty, day]]
	];
	if (guessed) writes.push(countKey(day, 'search', 'guessed'));
	if (text.length <= MAX_QUERY_KEPT) {
		writes.push(
			['INSERT OR IGNORE INTO search_visitors (day, query, hash) VALUES (?, ?, ?)', [day, text, hash]],
			// visitors: counted from the rows above, which now include this one
			[
				`INSERT INTO searches (day, query, count, visitors, empty)
				 VALUES (?, ?, 1, (SELECT count(*) FROM search_visitors WHERE day = ? AND query = ?), ?)
				 ON CONFLICT (day, query) DO UPDATE SET count = count + 1, visitors = excluded.visitors,
				 empty = empty + excluded.empty`,
				[day, text, day, text, empty]
			]
		);
	}
	await runTogether(db, writes);
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
	if (!path.startsWith('/')) return 'other'; // OTHER and NOT_FOUND
	const top = path.split('/')[1];
	if (top === 'word' || top === 'words') return 'words';
	if (LEARN.has(top)) return 'learn';
	if (top === 'saved') return 'saved';
	return 'other';
}

export interface StatsReport {
	/** The last `days` days, oldest first, a day without visits as zeros. */
	days: DayRow[];
	/**
	 * Visitors a day on average, over the whole days of the period on which
	 * anything was counted at all: not the days before counting began, and not
	 * today, which is not over (unless today is all there is).
	 */
	visitorsADay: number;
	/** Visitors a day for the calendar: whole weeks from a Monday, the last one up to today. */
	calendar: { day: string; visitors: number }[];
	sections: Record<Section, number>;
	pages: Ranked[];
	searches: Ranked[];
	missing: Ranked[];
	/** The top keys of each kind in `breakdowns`, summed over the period. */
	breakdowns: Record<BreakdownKind, Ranked[]>;
}

export const BREAKDOWN_KINDS = ['referrer', 'country', 'device', 'search'] as const;
export type BreakdownKind = (typeof BREAKDOWN_KINDS)[number];

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
	// Every key of the period, the largest first; a day holds MAX_KEYS_A_DAY of a kind at most
	const keys = await db.all<{ kind: string; key: string; count: number }>(
		`SELECT kind, key, sum(count) AS count FROM breakdowns WHERE day >= ?
		 GROUP BY kind, key ORDER BY count DESC, key`,
		[since]
	);
	const breakdowns = Object.fromEntries(BREAKDOWN_KINDS.map((kind) => [
		kind,
		keys.filter((row) => row.kind === kind).slice(0, top).map(({ key, count }) => ({ key, count }))
	])) as Record<BreakdownKind, Ranked[]>;
	const [{ began }] = await db.all<{ began: string | null }>('SELECT min(day) AS began FROM daily');
	const period = range(since).map((day) => byDay.get(day) ?? zero(day));
	const counted = began ? period.filter((d) => d.day >= began) : [];
	const whole = counted.length > 1 ? counted.slice(0, -1) : counted;
	return {
		days: period,
		visitorsADay: whole.length ? Math.round(whole.reduce((sum, d) => sum + d.visitors, 0) / whole.length) : 0,
		calendar: range(calendarFrom).map((day) => ({ day, visitors: byDay.get(day)?.visitors ?? 0 })),
		sections,
		pages,
		searches,
		missing,
		breakdowns
	};
}
