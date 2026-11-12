// POST /api/lists/<id>/words — see docs/api.md. Puts saved words into a list
// and takes words out of it, in one request so that ticking many words on the
// Saved page is one request too.
import { fail, signedIn } from '#lib/server/account.ts';
import { readJson } from '#lib/server/request.ts';
import { addToLists, hasList, parseWords, removeFromList } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// A full list of 5,000 long words comes to about 800 KB.
	const body = await readJson(request, 1024 * 1024);
	if (body instanceof Response) return body;
	const { add: sentAdd, remove: sentRemove } = (body ?? {}) as { add?: unknown; remove?: unknown };
	const add = parseWords(sentAdd ?? []);
	const remove = parseWords(sentRemove ?? []);
	if (!add || !remove) return fail(400, 'invalid_words');
	// Told apart from "nothing to do": the browser then knows its list is gone.
	if (!(await hasList(who.users, who.user.id, params.id))) return fail(404, 'not_found');
	// Words that are not saved are skipped, so only dictionary words get here.
	await addToLists(who.users, who.user.id, add.map((word) => [params.id, word]));
	await removeFromList(who.users, who.user.id, params.id, remove);
	return Response.json({ ok: true });
};
