// List recent "Report an issue" reports from the local reports.db.
//   npm run reports            the 20 newest
//   npm run reports -- 50      the 50 newest
// In production the reports are in the REPORTS D1 database; see
// src/lib/server/reports.ts for the wrangler command.
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { stripControls } from '../src/lib/report.ts';

if (!existsSync('reports.db')) {
	console.log('No reports.db yet: it is created when the first report is sent during `npm run dev`.');
	process.exit(0);
}

const limit = Math.max(1, Math.min(500, Number(process.argv[2]) || 20));
const db = new DatabaseSync('reports.db', { readOnly: true });
const stored = db
	.prepare(
		`SELECT id, created_at, status, kind, word, pos, query, message, email, page
		 FROM reports ORDER BY id DESC LIMIT ?`
	)
	.all(limit) as Record<string, string | number | null>[];

// Reports are text from strangers, printed in your terminal. The endpoint
// strips control characters before storing; this covers older rows as well,
// so no report can send the terminal an escape sequence.
const rows = stored.map((row) =>
	Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? stripControls(v) : v]))
);

if (!rows.length) console.log('No reports yet.');
for (const r of rows) {
	const about = r.word ? `${r.word} (${r.pos})` : r.query ? `search “${r.query}”` : '';
	console.log(`#${r.id}  ${r.created_at}  [${r.status}]  ${r.kind}${about ? '  ·  ' + about : ''}`);
	console.log(`    ${String(r.message).replace(/\n/g, '\n    ')}`);
	const extra = [r.email && `email: ${r.email}`, r.page && `from: ${r.page}`].filter(Boolean);
	if (extra.length) console.log(`    ${extra.join('  ·  ')}`);
	console.log();
}
