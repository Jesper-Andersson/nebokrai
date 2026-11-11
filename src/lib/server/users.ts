// Accounts, sessions and saved words. They live in a private database of their
// own, never nebokrai.db: the dictionary database is rebuilt from open data and
// published under CC BY-SA, while these rows are personal and must survive
// rebuilds. See user-db.ts for where that database is.
//
// What is stored about a person: the id their provider (Google or GitHub) gives
// them, their display name, and the words they saved. No email, no password.
//
// Nothing here imports from SvelteKit, so `npm test` can run it against an
// in-memory SQLite database.
import { MAX_SAVED, MAX_WORD_LENGTH, type SavedWord } from '../saved.ts';

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
	) WITHOUT ROWID`
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
	for (const table of ['saved_words', 'sessions', 'identities']) {
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
