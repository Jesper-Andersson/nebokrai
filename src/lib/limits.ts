// Limits the search box and the search endpoint share.

/**
 * Longest query /api/search answers; the search box stops typing there. The
 * longest dictionary word has 60 letters, and no useful English query is longer.
 */
export const MAX_QUERY_LENGTH = 100;
