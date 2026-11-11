// Where "Report an issue" reports are kept: a private database of their own,
// never nebokrai.db. The dictionary database is rebuilt from open data and
// published under CC BY-SA; reports hold personal data (an optional email) and
// must survive rebuilds.
//
// Production: the Cloudflare D1 binding REPORTS. `npm run dev`: reports.db in
// the repo root (git-ignored, like every *.db). The table is created on first
// use. To read them: `npm run reports` locally, or in production
// `wrangler d1 execute <reports database> --remote --command "SELECT * FROM reports ORDER BY id DESC LIMIT 20"`.
//
// Retention: the email is only for replying; clear it when a report is closed
// (status leaves 'new' / 'confirmed'). IP addresses are never stored.
import { dev } from '$app/env';
import type { ReportKind } from '#lib/report.ts';
import { openLocalWritable, type LocalWritable } from './db.ts';

export interface NewReport {
	kind: ReportKind;
	message: string;
	email: string | null;
	entryId: number | null;
	word: string | null;
	pos: string | null;
	query: string | null;
	lang: string;
	layout: string;
	page: string | null;
	userAgent: string | null;
}

/** The part of Cloudflare's D1Database used here. */
export interface D1Writable {
	prepare(sql: string): {
		bind(...params: unknown[]): { run(): Promise<{ meta?: { last_row_id?: number } }> };
		run(): Promise<unknown>;
	};
}

// status: new → confirmed → fixed_upstream | fixed_locally | wont_fix
const SCHEMA = `CREATE TABLE IF NOT EXISTS reports (
	id INTEGER PRIMARY KEY,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
	status TEXT NOT NULL DEFAULT 'new',
	kind TEXT NOT NULL,
	message TEXT NOT NULL,
	email TEXT,
	entry_id INTEGER,
	word TEXT,
	pos TEXT,
	query TEXT,
	lang TEXT,
	layout TEXT,
	page TEXT,
	user_agent TEXT,
	closed_at TEXT
)`;

const INSERT = `INSERT INTO reports
	(kind, message, email, entry_id, word, pos, query, lang, layout, page, user_agent)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const values = (r: NewReport) => [
	r.kind, r.message, r.email, r.entryId, r.word, r.pos, r.query, r.lang, r.layout, r.page, r.userAgent
];

let d1Ready: Promise<unknown> | undefined;
let local: Promise<LocalWritable> | undefined;

/** Store a report; returns its id. */
export async function saveReport(platform: App.Platform | undefined, report: NewReport): Promise<number | null> {
	const d1 = platform?.env?.REPORTS;
	if (d1) {
		await (d1Ready ??= d1.prepare(SCHEMA).run().catch((err) => {
			// Forget the failure, so the next report tries again.
			d1Ready = undefined;
			throw err;
		}));
		const result = await d1.prepare(INSERT).bind(...values(report)).run();
		return result.meta?.last_row_id ?? null;
	}
	if (dev) {
		const sqlite = await (local ??= openLocalWritable('reports.db', SCHEMA));
		return Number(sqlite.run(INSERT, values(report)).lastInsertRowid);
	}
	throw new Error('No reports database: bind REPORTS to the Cloudflare worker.');
}
