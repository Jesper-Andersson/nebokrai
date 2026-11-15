// The parts of the site a page view is counted in, for the "Where people go"
// bar of /stats. Here and not in server/stats.ts, because the page needs the
// list too and a component may not import values from the server's files.
export const SECTION_NAMES = ['words', 'search', 'learn', 'saved', 'other'] as const;
export type Section = (typeof SECTION_NAMES)[number];

/**
 * What a page that does not exist is counted as, whatever its address: the
 * layout sends this in place of the path, so mistyped and made-up addresses
 * are one row and not thousands.
 */
export const NOT_FOUND = '(not found)';

/** A visit that no other site sent: a typed address, a bookmark, or a browser that does not say. */
export const DIRECT = '(direct)';
/** What is counted together: paths outside the site's sections, and keys past a day's limit. */
export const OTHER = '(other)';

/** A counted path as it is read: /words/%D0%B0 is /words/а. One that cannot be decoded is shown as it is. */
export function readablePath(path: string): string {
	try {
		return decodeURIComponent(path);
	} catch {
		return path;
	}
}
