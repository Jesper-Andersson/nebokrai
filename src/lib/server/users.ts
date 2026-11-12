// Accounts, sessions, saved words and review cards. They live in a private database of their
// own, never nebokrai.db: the dictionary database is rebuilt from open data and
// published under CC BY-SA, while these rows are personal and must survive
// rebuilds. See user-db.ts for where that database is.
//
// What is stored about a person: the id their provider (Google or GitHub) gives
// them, their display name, the words they saved, when they exported them and
// how their flashcard reviews went. No email, no password.
//
// Nothing here imports from SvelteKit, so `npm test` can run it against an
// in-memory SQLite database.
import { MAX_REVIEW } from '../review/cards.ts';
import { parseSettings, type ReviewSettings } from '../review/decks.ts';
import type { ReviewCard } from '../review/fsrs.ts';
import { MAX_SAVED, MAX_WORD_LENGTH, type ExportedMarks, type SavedWord } from '../saved.ts';

/** The database as this file needs it: read rows, or run a statement. */
export interface UserDb {
	all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
	run(sql: string, params?: unknown[]): Promise<void>;
}

/** One statement per item: D1 prepares a single statement at a time. */
export const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT,
		created_at INTEGER NOT NULL
	)`,
	// One row per provider login, so one user could later connect both.
	`CREATE TABLE IF NOT EXISTS identities (
		provider TEXT NOT NULL,
		provider_user_id TEXT NOT NULL,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		PRIMARY KEY (provider, provider_user_id)
	) WITHOUT ROWID`,
	// id is the SHA-256 of the cookie's token: a leaked database opens no session.
	`CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	)`,
	// word is entries.word (книга). Never an entry id, which changes on every
	// rebuild of nebokrai.db, and never a slug, which several words can share.
	`CREATE TABLE IF NOT EXISTS saved_words (
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		word TEXT NOT NULL,
		saved_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, word)
	) WITHOUT ROWID`,
	// When a word was last exported to a file (the Saved page's Export menu).
	// A table of its own, not a column of saved_words: the mark outlives the
	// word being removed, because the flashcard made from it still exists if
	// the word is saved again.
	`CREATE TABLE IF NOT EXISTS exported_words (
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		word TEXT NOT NULL,
		exported_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, word)
	) WITHOUT ROWID`,
	// One flashcard's schedule (src/lib/review/fsrs.ts). Like an exported mark
	// it outlives the word being removed from the saved list. updated_at is
	// this server's clock, and is what another browser asks by: "what changed
	// since I last looked"; every other time is the browser's.
	`CREATE TABLE IF NOT EXISTS review_cards (
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		word TEXT NOT NULL,
		due INTEGER NOT NULL,
		stability REAL NOT NULL,
		difficulty REAL NOT NULL,
		state INTEGER NOT NULL,
		step INTEGER NOT NULL,
		reps INTEGER NOT NULL,
		lapses INTEGER NOT NULL,
		added_at INTEGER NOT NULL,
		last_review INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, word)
	) WITHOUT ROWID`,
	// The decks switched on and the new cards a day, as JSON (ReviewSettings).
	`CREATE TABLE IF NOT EXISTS review_settings (
		user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
		settings TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	)`
];

export type Provider = 'google' | 'github';

export interface User {
	id: string;
	name: string | null;
}

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'session';
export const SESSION_MS = 30 * DAY;
/** A session used with less than this left is extended to the full length again. */
const RENEW_BELOW_MS = 15 * DAY;

function randomToken(bytes: number): string {
	const raw = crypto.getRandomValues(new Uint8Array(bytes));
	return btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The user behind a provider login, created on their first sign-in. Returns the user id. */
export async function findOrCreateUser(
	db: UserDb, provider: Provider, providerUserId: string, name: string | null, now = Date.now()
): Promise<string> {
	const find = () => db.all<{ user_id: string }>(
		'SELECT user_id FROM identities WHERE provider = ? AND provider_user_id = ?', [provider, providerUserId]);
	const [known] = await find();
	if (known) {
		await db.run('UPDATE users SET name = ? WHERE id = ?', [name, known.user_id]);
		return known.user_id;
	}
	const id = randomToken(16);
	await db.run('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)', [id, name, now]);
	await db.run(
		'INSERT OR IGNORE INTO identities (provider, provider_user_id, user_id) VALUES (?, ?, ?)',
		[provider, providerUserId, id]);
	// Two sign-ins at the same moment: the first identity row wins, the other user is dropped.
	const [winner] = await find();
	if (winner.user_id !== id) await db.run('DELETE FROM users WHERE id = ?', [id]);
	return winner.user_id;
}

/**
 * What a session token looks like: the 32 random bytes of createSession() in
 * base64url. A cookie that is anything else is refused without a database query.
 */
export const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Start a session. `token` goes in the cookie; only its hash is stored. */
export async function createSession(
	db: UserDb, userId: string, now = Date.now()
): Promise<{ token: string; expiresAt: number }> {
	const token = randomToken(32);
	const expiresAt = now + SESSION_MS;
	await db.run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
		[await sha256Hex(token), userId, expiresAt]);
	// Sign-in is rare, so it is a cheap moment to clear out sessions nobody ended.
	await db.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
	return { token, expiresAt };
}

/**
 * Who a cookie token belongs to, or null if the session is unknown or over.
 * `renewed` says the expiry moved, so the cookie must be set again.
 */
export async function validateSession(
	db: UserDb, token: string, now = Date.now()
): Promise<{ user: User; expiresAt: number; renewed: boolean } | null> {
	const id = await sha256Hex(token);
	const [row] = await db.all<{ expires_at: number; user_id: string; name: string | null }>(
		`SELECT s.expires_at, u.id AS user_id, u.name FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.id = ?`, [id]);
	if (!row) return null;
	if (row.expires_at <= now) {
		await db.run('DELETE FROM sessions WHERE id = ?', [id]);
		return null;
	}
	const user = { id: row.user_id, name: row.name };
	if (row.expires_at - now >= RENEW_BELOW_MS) return { user, expiresAt: row.expires_at, renewed: false };
	const expiresAt = now + SESSION_MS;
	await db.run('UPDATE sessions SET expires_at = ? WHERE id = ?', [expiresAt, id]);
	return { user, expiresAt, renewed: true };
}

export async function deleteSession(db: UserDb, token: string): Promise<void> {
	await db.run('DELETE FROM sessions WHERE id = ?', [await sha256Hex(token)]);
}

/** Delete an account and everything kept for it. */
export async function deleteUser(db: UserDb, userId: string): Promise<void> {
	// Spelled out rather than left to ON DELETE CASCADE, so nothing is left
	// behind even where foreign keys are not enforced.
	for (const table of ['review_settings', 'review_cards', 'exported_words', 'saved_words', 'sessions', 'identities']) {
		await db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
	}
	await db.run('DELETE FROM users WHERE id = ?', [userId]);
}

/** Newest first. */
export async function listSaved(db: UserDb, userId: string): Promise<SavedWord[]> {
	return db.all<SavedWord>(
		'SELECT word, saved_at FROM saved_words WHERE user_id = ? ORDER BY saved_at DESC, word', [userId]);
}

/** Save one word. False when the list is full (MAX_SAVED). Saving a word twice is fine. */
export async function saveWord(db: UserDb, userId: string, word: string, now = Date.now()): Promise<boolean> {
	await db.run(
		`INSERT OR IGNORE INTO saved_words (user_id, word, saved_at)
		 SELECT ?, ?, ? WHERE (SELECT count(*) FROM saved_words WHERE user_id = ?) < ?`,
		[userId, word, now, userId, MAX_SAVED]);
	const found = await db.all('SELECT 1 FROM saved_words WHERE user_id = ? AND word = ?', [userId, word]);
	return found.length > 0;
}

export async function removeWord(db: UserDb, userId: string, word: string): Promise<void> {
	await db.run('DELETE FROM saved_words WHERE user_id = ? AND word = ?', [userId, word]);
}

/**
 * Add a browser's list to the account and return the whole list. A word already
 * in the account keeps its date; words beyond MAX_SAVED are left out.
 */
export async function mergeSaved(db: UserDb, userId: string, words: SavedWord[]): Promise<SavedWord[]> {
	if (words.length) {
		// The list goes in as one JSON parameter: D1 binds at most 100.
		await db.run(
			`INSERT OR IGNORE INTO saved_words (user_id, word, saved_at)
			 SELECT ?, json_extract(value, '$.word'), json_extract(value, '$.saved_at') FROM json_each(?)
			 WHERE json_extract(value, '$.word') NOT IN (SELECT word FROM saved_words WHERE user_id = ?)
			 LIMIT max(0, ? - (SELECT count(*) FROM saved_words WHERE user_id = ?))`,
			[userId, JSON.stringify(words), userId, MAX_SAVED, userId]);
	}
	return listSaved(db, userId);
}

/** When each word of the account was last exported. Includes words since removed from the list. */
export async function listExported(db: UserDb, userId: string): Promise<ExportedMarks> {
	const rows = await db.all<{ word: string; exported_at: number }>(
		'SELECT word, exported_at FROM exported_words WHERE user_id = ?', [userId]);
	return Object.fromEntries(rows.map((r) => [r.word, r.exported_at]));
}

/**
 * Remember when words were exported. Only words in the account's list are
 * marked, so this stores nothing but dictionary words and cannot outgrow the
 * dictionary. A word marked before keeps the later of its two dates.
 */
export async function markExported(db: UserDb, userId: string, marks: ExportedMarks): Promise<void> {
	const rows = Object.entries(marks).map(([word, exported_at]) => ({ word, exported_at }));
	if (!rows.length) return;
	// One JSON parameter for the whole list: D1 binds at most 100.
	await db.run(
		`INSERT INTO exported_words (user_id, word, exported_at)
		 SELECT ?, json_extract(value, '$.word'), json_extract(value, '$.exported_at') FROM json_each(?)
		 WHERE json_extract(value, '$.word') IN (SELECT word FROM saved_words WHERE user_id = ?)
		 ON CONFLICT (user_id, word) DO UPDATE SET exported_at = max(exported_at, excluded.exported_at)`,
		[userId, JSON.stringify(rows), userId]);
}

/** Read the exported marks sent by a browser (`{ word: when }`), dropping anything malformed. */
export function parseExportedMarks(value: unknown, now = Date.now()): ExportedMarks {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const marks: ExportedMarks = {};
	for (const [word, at] of Object.entries(value).slice(0, MAX_SAVED)) {
		if (!word || word.length > MAX_WORD_LENGTH) continue;
		marks[word] = Number.isInteger(at) && at > 0 && at <= now ? at : now;
	}
	return marks;
}

/** Read a list of words sent by a browser as exported just now. */
export function parseExportedWords(value: unknown, now = Date.now()): ExportedMarks {
	if (!Array.isArray(value)) return {};
	const marks: ExportedMarks = {};
	for (const word of value.slice(0, MAX_SAVED)) {
		if (typeof word === 'string' && word && word.length <= MAX_WORD_LENGTH) marks[word] = now;
	}
	return marks;
}

/** Read a list of saved words sent by a browser, dropping anything malformed. */
export function parseSavedWords(value: unknown, now = Date.now()): SavedWord[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const words: SavedWord[] = [];
	for (const item of value.slice(0, MAX_SAVED)) {
		const word = item?.word;
		if (typeof word !== 'string' || !word || word.length > MAX_WORD_LENGTH || seen.has(word)) continue;
		seen.add(word);
		const at = item.saved_at;
		words.push({ word, saved_at: Number.isInteger(at) && at > 0 && at <= now ? at : now });
	}
	return words;
}

const CARD_COLUMNS = ['due', 'stability', 'difficulty', 'state', 'step', 'reps', 'lapses', 'added_at', 'last_review'];
const CARD_VALUES = CARD_COLUMNS.map((column) => `json_extract(value, '$.${column}')`).join(', ');

/**
 * Take in the cards a browser reviewed. Of two copies of a card the one
 * reviewed later is kept, so the same cards can arrive twice, or late from a
 * browser that was offline, and do no harm. New cards beyond MAX_REVIEW are
 * left out. Only dictionary words should get this far: the endpoint checks.
 */
export async function saveReviewCards(
	db: UserDb, userId: string, cards: ReviewCard[], now = Date.now()
): Promise<void> {
	if (!cards.length) return;
	// One JSON parameter for the whole list: D1 binds at most 100.
	const sent = JSON.stringify(cards);
	await db.run(
		`INSERT INTO review_cards (user_id, word, ${CARD_COLUMNS.join(', ')}, updated_at)
		 SELECT ?, json_extract(value, '$.word'), ${CARD_VALUES}, ? FROM json_each(?)
		 WHERE json_extract(value, '$.word') IN (SELECT word FROM review_cards WHERE user_id = ?)
		 ON CONFLICT (user_id, word) DO UPDATE SET
		   ${CARD_COLUMNS.map((column) => `${column} = excluded.${column}`).join(', ')}, updated_at = excluded.updated_at
		 WHERE excluded.last_review > review_cards.last_review
		    OR (excluded.last_review = review_cards.last_review AND excluded.reps > review_cards.reps)`,
		[userId, now, sent, userId]);
	await db.run(
		`INSERT OR IGNORE INTO review_cards (user_id, word, ${CARD_COLUMNS.join(', ')}, updated_at)
		 SELECT ?, json_extract(value, '$.word'), ${CARD_VALUES}, ? FROM json_each(?)
		 WHERE json_extract(value, '$.word') NOT IN (SELECT word FROM review_cards WHERE user_id = ?)
		 LIMIT max(0, ? - (SELECT count(*) FROM review_cards WHERE user_id = ?))`,
		[userId, now, sent, userId, MAX_REVIEW, userId]);
}

/**
 * The account's cards that changed at or after `since` on this server's clock;
 * all of them from 0. "At", so that a card stored in the same millisecond as
 * the last answer is not missed: receiving a card twice costs nothing.
 */
export async function listReviewCards(db: UserDb, userId: string, since = 0): Promise<ReviewCard[]> {
	return db.all<ReviewCard>(
		`SELECT word, ${CARD_COLUMNS.join(', ')} FROM review_cards WHERE user_id = ? AND updated_at >= ? ORDER BY word`,
		[userId, since]);
}

/** Keep the settings, unless the account already has ones changed later. */
export async function saveReviewSettings(db: UserDb, userId: string, settings: ReviewSettings): Promise<void> {
	await db.run(
		`INSERT INTO review_settings (user_id, settings, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT (user_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at
		 WHERE excluded.updated_at > review_settings.updated_at`,
		[userId, JSON.stringify(settings), settings.updated_at]);
}

export async function getReviewSettings(db: UserDb, userId: string): Promise<ReviewSettings | null> {
	const rows = await db.all<{ settings: string }>('SELECT settings FROM review_settings WHERE user_id = ?', [userId]);
	try {
		// Checked against the clock when they were stored: no need to again.
		return rows.length ? parseSettings(JSON.parse(rows[0].settings), Infinity) : null;
	} catch {
		return null;
	}
}
