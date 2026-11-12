// The email that tells the site's keeper a report has come in. reports.ts
// sends it; this file only writes it, and imports nothing from SvelteKit or
// Cloudflare, so tests/report-mail.test.ts can read it.
//
// It carries what the report says and never the reporter's own address. The
// form promises that address is deleted once the report is closed, and a copy
// in a mailbox would outlive that. The mail only says that a reply is wanted;
// the address stays in the reports database.
import { wordPath } from '#lib/search/slug.ts';
import type { NewReport } from './reports.ts';

const SITE = 'https://nebokrai.app';

export interface ReportMail {
	subject: string;
	text: string;
}

/** On one line and no longer than `max`: a subject cannot hold a line break. */
function oneLine(value: string, max: number): string {
	const flat = value.replace(/\s+/g, ' ').trim();
	return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

/** The subject and plain text for one stored report; `id` is its row in the database. */
export function reportMail(report: NewReport, id: number | null): ReportMail {
	// What the report is about, when it came from a word's page or a search
	const about = report.word ?? report.query;
	const subject = oneLine(
		`Report${id === null ? '' : ` #${id}`}: ${report.kind}${about ? `, ${about}` : ''}`,
		120
	);

	const lines = [report.message, ''];
	const fact = (label: string, value: string | null) => {
		if (value) lines.push(`${label}: ${oneLine(value, 400)}`);
	};
	fact('Kind', report.kind);
	if (report.word) {
		// The word's own page, so the entry is one click from the mail
		fact('Word', `${report.word}${report.pos ? ` (${report.pos})` : ''} ${SITE}${wordPath(report.word)}`);
	}
	fact('Search', report.query);
	fact('Sent from', report.page);
	fact('Interface', `${report.lang}, ${report.layout} keyboard`);
	fact('Reply wanted', report.email ? 'yes, the address is in the reports database' : 'no');
	fact('Browser', report.userAgent);

	return { subject, text: lines.join('\n') };
}
