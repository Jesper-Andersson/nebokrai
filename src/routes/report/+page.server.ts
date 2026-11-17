// /report?entry=<id>&kind=<kind>&q=<query>
// Links from the word page and from "No matches" fill these in, so the form
// opens already knowing what the report is about.
//
// `turnstile` is the site key of the bot check, or null when the server has
// no secret to check a token with (`npm run dev`, a copy of the site without
// one): the form then shows no check and the endpoint asks for none.
import { TURNSTILE_SECRET, TURNSTILE_SITE_KEY as OTHER_SITE_KEY } from '$app/env/private';
import { FROM_TRANSLATIONS, entrySource } from '#lib/search/word.ts';
import { getDatabases } from '#lib/server/db.ts';
import { TURNSTILE_SITE_KEY, isReportKind, type ReportEntry } from '#lib/report.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const askedKind = url.searchParams.get('kind');
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	let entry: ReportEntry | null = null;
	let ownEntry = false;
	let noPage = false;
	const id = Number(url.searchParams.get('entry'));
	if (Number.isInteger(id) && id > 0) {
		const { db } = await getDatabases();
		const rows = await db.all<ReportEntry>('SELECT id, word, headword, pos FROM entries WHERE id = ?', [id]);
		entry = rows[0] ?? null;
		const source = entry === null ? null : await entrySource(db, id);
		// An entry written for Nebokrai has no Wiktionary page to send the reporter to.
		ownEntry = source === 'nebokrai';
		// One made from translation tables has none either, but Wiktionary would take one.
		noPage = source === FROM_TRANSLATIONS;
	}

	const kind = isReportKind(askedKind) ? askedKind : entry ? 'meaning' : query ? 'missing' : null;
	const turnstile = TURNSTILE_SECRET ? (OTHER_SITE_KEY ?? TURNSTILE_SITE_KEY) : null;
	return { kind, entry, ownEntry, noPage, query, turnstile };
};
