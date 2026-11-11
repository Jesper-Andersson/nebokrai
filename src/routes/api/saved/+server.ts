// GET /api/saved — see docs/api.md.
import { signedIn } from '#lib/server/account.ts';
import { listSaved } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const who = await signedIn(locals, platform);
	if (who instanceof Response) return who;
	return Response.json({ words: await listSaved(who.users, who.user.id) });
};
