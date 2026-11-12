// DELETE /api/account — see docs/api.md. Removes the account and everything
// kept for it: saved words, sessions and the link to Google or GitHub.
import { signedIn } from '#lib/server/account.ts';
import { clearSessionCookie } from '#lib/server/oauth.ts';
import { deleteUser } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, cookies }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	await deleteUser(who.users, who.user.id);
	clearSessionCookie(cookies);
	return Response.json({ ok: true });
};
