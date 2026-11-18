// POST /api/comments/<id>: the site's keeper hides a comment under a grammar
// point's page, or shows it again (src/lib/server/users.ts).
//
// Body (JSON): { hidden: true | false }
//
// Only the accounts in the secret STATS_USER_IDS may call it. Everyone else
// gets the 404 of an address that does not exist, as on /stats.
import { STATS_USER_IDS } from '$app/env/private';
import { fail } from '#lib/server/account.ts';
import { readJson } from '#lib/server/request.ts';
import { ownerIds } from '#lib/server/stats.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { setCommentHidden } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.user || !ownerIds(STATS_USER_IDS).includes(locals.user.id)) return fail(404, 'not_found');

	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) return fail(404, 'not_found');

	const parsed = await readJson(request, 1024);
	if (parsed instanceof Response) return parsed;
	if (!parsed || typeof parsed !== 'object') return fail(400, 'invalid_json');
	const { hidden } = parsed as Record<string, unknown>;
	if (typeof hidden !== 'boolean') return fail(400, 'invalid_hidden');

	const db = await getUserDb();
	if (!db) return fail(503, 'unavailable');
	return (await setCommentHidden(db, id, hidden)) ? Response.json({ ok: true }) : fail(404, 'not_found');
};
