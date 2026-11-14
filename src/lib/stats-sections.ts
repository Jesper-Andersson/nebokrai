// The parts of the site a page view is counted in, for the "Where people go"
// bar of /stats. Here and not in server/stats.ts, because the page needs the
// list too and a component may not import values from the server's files.
export const SECTION_NAMES = ['words', 'search', 'learn', 'saved', 'other'] as const;
export type Section = (typeof SECTION_NAMES)[number];
