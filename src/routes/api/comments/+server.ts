// GET and POST /api/comments: the comments under a grammar point's page
// (src/lib/comments.ts; the rows are in the accounts database, users.ts).
//
// GET ?page=<id>: the page's comments, newest first. The site's keeper (an
// account in the secret STATS_USER_IDS) also gets the hidden ones, marked.
//
// POST, body (JSON): { page, body, name?, website?, turnstile? }. Shown at
// once; nobody approves it first. `website` is a honeypot and `turnstile` the
// bot check's token, as in /api/report; a signed-in visitor is not asked for
// a token. The account is not stored with the comment, and IP addresses are
// used only for the rate limit, in memory.
import { STATS_USER_IDS } from '$app/env/private';
import { cleanComment, MAX_COMMENT, MAX_COMMENT_NAME } from '#lib/comments.ts';
import { introOf } from '#lib/practice/intros.ts';
import { fail } from '#lib/server/account.ts';
import { botCheck, rateLimiter } from '#lib/server/bot-check.ts';
import { rateKey, readJson } from '#lib/server/request.ts';
import { ownerIds } from '#lib/server/stats.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { addComment, listComments } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

// At most 5 comments per 10 minutes from one address: a brake, not a wall
// (see rateLimiter). Turnstile is the protection against real spam.
const tooMany = rateLimiter(5, 10 * 60 * 1000);

// A comment and a name at their longest, as Ukrainian text in JSON, and a token.
const MAX_BODY = 4 * (MAX_COMMENT + MAX_COMMENT_NAME) + 4096;

export const GET: RequestHandler = async ({ url, locals }) => {
	const page = url.searchParams.get('page') ?? '';
	if (!introOf(page)) return fail(404, 'not_found');
	const db = await getUserDb();
	if (!db) return fail(503, 'unavailable');
	const keeper = Boolean(locals.user && ownerIds(STATS_USER_IDS).includes(locals.user.id));
	return Response.json(
		{ comments: await listComments(db, page, keeper) },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const parsed = await readJson(request, MAX_BODY);
	if (parsed instanceof Response) return parsed;
	if (!parsed || typeof parsed !== 'object') return fail(400, 'invalid_json');
	const body = parsed as Record<string, unknown>;

	if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true, comment: null });

	const page = typeof body.page === 'string' ? body.page : '';
	if (!introOf(page)) return fail(404, 'not_found');

	const comment = cleanComment(body.body, body.name);
	if (comment === 'too_large') return fail(413, 'too_large');
	if (comment === 'missing_body') return fail(400, 'missing_body');

	const db = await getUserDb();
	if (!db) return fail(503, 'unavailable');

	// After the mistakes a person can fix and send again: a token is good for one check
	if (!locals.user) {
		const refused = await botCheck(body.turnstile, getClientAddress());
		if (refused) return refused;
	}
	if (tooMany(rateKey(getClientAddress()))) return fail(429, 'too_many');

	return Response.json({ ok: true, comment: await addComment(db, page, comment) });
};
