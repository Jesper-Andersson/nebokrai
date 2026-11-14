// Tells the site that a page was shown or a search made, for the visit
// counts (POST /api/hit, src/lib/server/stats.ts). sendBeacon goes out even
// while the page is being left, sets no cookie of its own and is never waited for.

export type Hit = { kind: 'view'; path: string } | { kind: 'search'; query: string; results: number };

export function sendHit(hit: Hit): void {
	if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
	try {
		navigator.sendBeacon('/api/hit', JSON.stringify(hit));
	} catch {
		// A browser may refuse a beacon (too many queued): the count is not worth an error.
	}
}

/**
 * Report a search once its answer has been looked at: on screen for
 * SEARCH_SEEN_MS, or a result opened before that. Not per letter typed.
 * Call `shown` with each new answer (null when the box is emptied, which
 * drops one not yet reported) and `leaving` before a result is opened.
 */
export const SEARCH_SEEN_MS = 1500;

export function searchReporter() {
	let reported = '';
	let pending: { query: string; results: number } | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const flush = () => {
		clearTimeout(timer);
		if (pending && pending.query !== reported) {
			reported = pending.query;
			sendHit({ kind: 'search', ...pending });
		}
		pending = null;
	};
	return {
		shown(answer: { query: string; results: unknown[] } | null) {
			clearTimeout(timer);
			pending = answer && answer.query.trim() ? { query: answer.query.trim(), results: answer.results.length } : null;
			if (pending) timer = setTimeout(flush, SEARCH_SEEN_MS);
		},
		leaving: flush
	};
}
