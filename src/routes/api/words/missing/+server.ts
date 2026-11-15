// POST /api/words/missing — see docs/api.md. Words an import found in no
// dictionary entry, kept so they can be added (src/lib/server/missing-words.ts).
// Anyone may send them, signed in or not, and nothing about the sender is
// stored. IP addresses are used only for the rate limit below, in memory.
import { fail } from '#lib/server/account.ts';
import { saveMissing } from '#lib/server/missing-words.ts';
import { rateKey, readJson } from '#lib/server/request.ts';
import { cleanMissing } from '#lib/import/missing.ts';
import type { RequestHandler } from './$types';

// At most 20 requests per 10 minutes from one address: one import sends one
// or two. Kept in memory, so on Cloudflare it counts per server instance: a
// brake on filling the list with junk, not a wall.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 20;
const recent = new Map<string, number[]>();

function tooMany(key: string): boolean {
	const now = Date.now();
	const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
	const over = times.length >= LIMIT;
	if (!over) times.push(now);
	recent.set(key, times);
	if (recent.size > 10_000) recent.clear(); // keep memory bounded
	return over;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// 200 words of 100 letters at most, as Ukrainian in JSON, stay under 64 KB.
	const body = await readJson(request, 64 * 1024);
	if (body instanceof Response) return body;
	const words = cleanMissing((body as { words?: unknown } | null)?.words);
	if (!words) return fail(400, 'invalid_words');
	if (tooMany(rateKey(getClientAddress()))) return fail(429, 'too_many');
	await saveMissing(words);
	return Response.json({ stored: words.length });
};
