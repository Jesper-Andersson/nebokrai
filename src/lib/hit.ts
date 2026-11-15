// Tells the site that a page was shown or a search made, for the visit
// counts (POST /api/hit, src/lib/server/stats.ts). sendBeacon goes out even
// while the page is being left, sets no cookie of its own and is never waited for.

// `referrer` goes with the first page of a visit only (referringSite below).
// `suggested` is how many "did you mean" guesses stood under the answer: a
// search with no results but a guess is not counted as one that found nothing.
export type Hit =
	| { kind: 'view'; path: string; referrer?: string }
	| { kind: 'search'; query: string; results: number; suggested: number };

/**
 * The site that sent the visitor here, as a host name: `www.google.com`
 * from `https://www.google.com/search?q=…`. The rest of that address never
 * leaves the browser. Empty when there is none, or when it is this site (a
 * reload, a link opened in a new tab).
 */
export function referringSite(referrer: string, here: string): string {
	try {
		const host = new URL(referrer).hostname;
		return host === here ? '' : host;
	} catch {
		return ''; // no referrer at all
	}
}

export function sendHit(hit: Hit): void {
	if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
	// A browser driven by a program (a test, a screenshot run) is not a visitor
	if (navigator.webdriver) return;
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
 * Closing the tab or leaving the site with an answer on screen reports it
 * too (pagehide): the visitor read it and went.
 */
export const SEARCH_SEEN_MS = 1500;

export function searchReporter() {
	let reported = '';
	let pending: { query: string; results: number; suggested: number } | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Listening only while an answer waits, so a reporter that is done holds nothing
	const listen = (on: boolean) => {
		if (typeof window === 'undefined') return;
		if (on) window.addEventListener('pagehide', flush);
		else window.removeEventListener('pagehide', flush);
	};
	const flush = () => {
		clearTimeout(timer);
		listen(false);
		if (pending && pending.query !== reported) {
			reported = pending.query;
			sendHit({ kind: 'search', ...pending });
		}
		pending = null;
	};
	return {
		shown(answer: { query: string; results: unknown[]; suggestions: unknown[] } | null) {
			clearTimeout(timer);
			pending = answer && answer.query.trim()
				? { query: answer.query.trim(), results: answer.results.length, suggested: answer.suggestions.length }
				: null;
			listen(Boolean(pending));
			if (pending) timer = setTimeout(flush, SEARCH_SEEN_MS);
		},
		leaving: flush
	};
}
