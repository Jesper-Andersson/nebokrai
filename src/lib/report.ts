// What people can report (see /report). Shared by the page and its server load.
export const REPORT_KINDS = ['meaning', 'stress', 'forms', 'missing', 'example', 'site', 'resource', 'other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const isReportKind = (value: string | null): value is ReportKind =>
	(REPORT_KINDS as readonly string[]).includes(value ?? '');

/**
 * The public half of the report form's bot check (Cloudflare Turnstile, see
 * src/lib/Turnstile.svelte). It is tied to nebokrai.app and is no secret:
 * every visitor's browser is given it. The secret half is TURNSTILE_SECRET.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAF-kL-Cfy9JJ-XZP';

/**
 * Remove characters that have no place in a report and can do harm where one
 * is read: control characters (an escape sequence can clear a terminal or
 * rewrite what it shows) and the marks that reorder text, which can make a
 * link read as a different address. Line breaks and tabs stay.
 */
export const stripControls = (text: string) =>
	text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '');

/** The dictionary entry a report is about, when it was opened from a word page. */
export interface ReportEntry {
	id: number;
	word: string;
	headword: string;
	pos: string;
}
