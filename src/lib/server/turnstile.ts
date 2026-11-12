// Cloudflare Turnstile, the check that a report is sent from a real browser
// (see src/lib/Turnstile.svelte for the widget). The widget gives the form a
// token; only Cloudflare can say whether the token is real, so the server
// asks it here before a report is stored or announced.
//
// No SvelteKit imports, so tests/turnstile.test.ts runs this file directly.

const VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's own limit on a token's length. */
export const MAX_TOKEN = 2048;

/**
 * `refused`: Cloudflare says the token is false, used already or older than
 * its five minutes. `unreachable`: no verdict, because Cloudflare did not
 * answer or did not accept our secret. A report is stored only on `ok`: a
 * check that lets everything through whenever it cannot be made is no check.
 */
export type Verdict = 'ok' | 'refused' | 'unreachable';

// Codes that say the fault is on our side or Cloudflare's, not the visitor's
const OURS = new Set(['missing-input-secret', 'invalid-input-secret', 'bad-request', 'internal-error']);

export async function verifyTurnstile(
	token: string,
	secret: string,
	ip: string | null,
	fetcher: typeof fetch = fetch
): Promise<Verdict> {
	try {
		const res = await fetcher(VERIFY, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return 'unreachable';
		const verdict = (await res.json()) as { success?: unknown; 'error-codes'?: unknown };
		if (verdict.success === true) return 'ok';
		const codes = Array.isArray(verdict['error-codes']) ? verdict['error-codes'] : [];
		if (codes.some((code) => OURS.has(code))) {
			// The codes name no visitor and no secret
			console.error('Turnstile could not check a token:', codes.join(', '));
			return 'unreachable';
		}
		return 'refused';
	} catch {
		return 'unreachable';
	}
}
