// GET /api/saved — see docs/api.md.
import { signedIn } from '#lib/server/account.ts';
import { listExported, listLists, listSaved } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	const [words, exported, lists] = await Promise.all([
		listSaved(who.users, who.user.id), listExported(who.users, who.user.id), listLists(who.users, who.user.id)
	]);
	return Response.json({ words, exported, lists });
};
