// PUT and DELETE /api/lists/<id> — see docs/api.md.
import { fail, signedIn } from '#lib/server/account.ts';
import { LIST_ID, cleanListName } from '#lib/lists.ts';
import { readJson } from '#lib/server/request.ts';
import { deleteList, putList } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

/** Create the list, or rename it: the browser chose the id, so both are the same request. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	const body = await readJson(request, 1024);
	if (body instanceof Response) return body;
	const name = cleanListName((body as { name?: unknown } | null)?.name);
	if (!LIST_ID.test(params.id) || name === null) return fail(400, 'invalid_list');
	const result = await putList(who.users, who.user.id, params.id, name);
	return result === 'ok' ? Response.json({ ok: true }) : fail(409, result);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	await deleteList(who.users, who.user.id, params.id);
	return Response.json({ ok: true });
};
