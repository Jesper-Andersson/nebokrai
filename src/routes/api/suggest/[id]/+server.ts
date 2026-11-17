// POST /api/suggest/<id>: the site's keeper accepts, rejects, reopens or marks
// as applied one suggestion from a reader (src/lib/server/suggestions.ts).
//
// Body (JSON): { status: 'new' | 'accepted' | 'rejected' | 'applied', note? }
//
// Only the accounts in the secret STATS_USER_IDS may call it. Everyone else
// gets the 404 of an address that does not exist, as on /stats: the endpoint
// then says nothing about there being anything to review.
import { STATS_USER_IDS } from '$app/env/private';
import { fail } from '#lib/server/account.ts';
import { readJson } from '#lib/server/request.ts';
import { ownerIds } from '#lib/server/stats.ts';
import { getSuggestionDb } from '#lib/server/suggestion-db.ts';
import { isSuggestionStatus, reviewSuggestion } from '#lib/server/suggestions.ts';
import { stripControls } from '#lib/report.ts';
import { MAX_SUGGEST_NOTE } from '#lib/suggest.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.user || !ownerIds(STATS_USER_IDS).includes(locals.user.id)) return fail(404, 'not_found');

	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) return fail(404, 'not_found');

	const parsed = await readJson(request, 8 * 1024);
	if (parsed instanceof Response) return parsed;
	if (!parsed || typeof parsed !== 'object') return fail(400, 'invalid_json');
	const body = parsed as Record<string, unknown>;

	if (!isSuggestionStatus(body.status)) return fail(400, 'invalid_status');
	const note = typeof body.note === 'string'
		? stripControls(body.note).trim().slice(0, MAX_SUGGEST_NOTE) || null
		: null;

	const found = await reviewSuggestion(await getSuggestionDb(), id, body.status, note);
	return found ? Response.json({ ok: true }) : fail(404, 'not_found');
};
