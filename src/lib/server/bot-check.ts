// What the endpoints that store text from strangers share (/api/report,
// /api/suggest): the Turnstile verdict and a brake on how fast one address
// can send.
import { TURNSTILE_SECRET } from '$app/env/private';
import { fail } from './account.ts';
import { MAX_TOKEN, verifyTurnstile } from './turnstile.ts';

/**
 * A limit of `limit` sends per `windowMs` from one key (an address, through
 * rateKey). Returns the function to ask: true means over the limit, and a
 * send that is let through is counted. Kept in memory, so on Cloudflare it
 * counts per server instance: a brake, not a wall. Turnstile is the
 * protection against real spam.
 */
export function rateLimiter(limit: number, windowMs: number): (key: string) => boolean {
	const recent = new Map<string, number[]>();
	return (key) => {
		const now = Date.now();
		const times = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
		if (times.length >= limit) {
			recent.set(key, times);
			return true;
		}
		times.push(now);
		recent.set(key, times);
		if (recent.size > 10_000) recent.clear(); // keep memory bounded
		return false;
	};
}

/**
 * Checks the token of the form's bot check (src/lib/Turnstile.svelte) and
 * returns the answer to refuse with, or null to go on. When the server has
 * TURNSTILE_SECRET, a send without a token Cloudflare accepts gets 403
 * `bot_check`, and 503 `bot_check_unavailable` when Cloudflare gives no
 * verdict. Without the secret (`npm run dev`) nothing is checked.
 *
 * A token is good for one check, so call this after the mistakes a person can
 * fix and send again.
 */
export async function botCheck(token: unknown, address: string): Promise<Response | null> {
	if (!TURNSTILE_SECRET) return null;
	if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return fail(403, 'bot_check');
	const verdict = await verifyTurnstile(token, TURNSTILE_SECRET, address);
	if (verdict === 'refused') return fail(403, 'bot_check');
	if (verdict === 'unreachable') return fail(503, 'bot_check_unavailable');
	return null;
}
