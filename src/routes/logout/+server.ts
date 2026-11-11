// POST /logout: end the session. A form post, so SvelteKit's origin check
// stops another site from signing a visitor out.
import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '#lib/server/oauth.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { SESSION_COOKIE, deleteSession } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	const users = token ? await getUserDb() : undefined;
	if (token && users) await deleteSession(users, token);
	clearSessionCookie(cookies);
	redirect(303, '/');
};
