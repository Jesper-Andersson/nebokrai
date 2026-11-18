// Comments under a grammar point's page (/grammar/<id>): what the form, the
// endpoints and the database agree on. Anyone may write one, with or without
// a name; it is shown at once, anyone may report it, and the site's keeper
// can hide it. The rows are in the accounts database (server/users.ts).
//
// No SvelteKit imports and no server code, so the page's form can use the
// limits and tests can run it directly.
import { stripControls } from './report.ts';

/** The longest comment, in characters: room for a question and an example or two. */
export const MAX_COMMENT = 1000;
/** The longest name a comment may be signed with. */
export const MAX_COMMENT_NAME = 40;
/** The most comments a page shows, newest first. */
export const MAX_LISTED = 200;

/** A comment as the page and GET /api/comments show it. */
export interface Comment {
	id: number;
	/** null: posted without a name. */
	name: string | null;
	body: string;
	/** Milliseconds since 1970, the server's clock. */
	created_at: number;
	/** Only in what the site's keeper is shown: hidden from everyone else. */
	hidden?: boolean;
	/** Only in what the site's keeper is shown: how many times readers reported it. */
	reports?: number;
}

/**
 * A comment's text and name as sent by a browser, cleaned, or why not:
 * `missing_body` when there is no text, `too_large` when the text or the
 * name is over its limit. Control characters and the marks that reorder
 * text are removed, as in a report, and runs of more than two blank lines
 * are closed up, so one comment cannot push the next off the screen.
 */
export function cleanComment(
	body: unknown, name: unknown
): { body: string; name: string | null } | 'missing_body' | 'too_large' {
	const text = typeof body === 'string' ? stripControls(body).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '';
	const signed = typeof name === 'string' ? stripControls(name).replace(/\s+/g, ' ').trim() : '';
	if (text.length > MAX_COMMENT || signed.length > MAX_COMMENT_NAME) return 'too_large';
	if (!text) return 'missing_body';
	return { body: text, name: signed || null };
}
