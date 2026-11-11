// /report?entry=<id>&kind=<kind>&q=<query>
// Links from the word page and from "No matches" fill these in, so the form
// opens already knowing what the report is about.
import { getDatabases } from '#lib/server/db.ts';
import { isReportKind, type ReportEntry } from '#lib/report.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, platform }) => {
	const askedKind = url.searchParams.get('kind');
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	let entry: ReportEntry | null = null;
	const id = Number(url.searchParams.get('entry'));
	if (Number.isInteger(id) && id > 0) {
		const { db } = await getDatabases(platform);
		const rows = await db.all<ReportEntry>('SELECT id, word, headword, pos FROM entries WHERE id = ?', [id]);
		entry = rows[0] ?? null;
	}

	const kind = isReportKind(askedKind) ? askedKind : entry ? 'meaning' : query ? 'missing' : null;
	return { kind, entry, query };
};
