// GET /auth/callback/<provider>: the provider sends the visitor back here.
// Check the answer belongs to the attempt this browser started, find or create
// the account, start a session, and go back to the page the visitor signed in
// from (the Saved page when that is not known).
import { error, redirect } from '@sveltejs/kit';
import { ATTEMPT_COOKIE, RETURN_COOKIE, fetchProfile, isProvider, setSessionCookie } from '#lib/server/oauth.ts';
import { isLocalPath } from '#lib/server/request.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { createSession, findOrCreateUser } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

/** The Saved page shows a "sign-in didn't work" note for this address. */
const FAILED = '/saved?login=failed';

export const GET: RequestHandler = async ({ params, url, cookies, fetch }) => {
	const provider = params.provider;
	if (!isProvider(provider)) error(404);

	const [state, verifier] = (cookies.get(ATTEMPT_COOKIE) ?? '').split('.');
	cookies.delete(ATTEMPT_COOKIE, { path: '/' });
	const from = cookies.get(RETURN_COOKIE) ?? '';
	cookies.delete(RETURN_COOKIE, { path: '/' });
	const code = url.searchParams.get('code');
	// No code: the visitor pressed Cancel at the provider. Wrong state: this
	// answer was not asked for by this browser.
	if (!code || !state || !verifier || url.searchParams.get('state') !== state) redirect(303, FAILED);

	const users = await getUserDb();
	if (!users) error(404);
	const profile = await fetchProfile(provider, url.origin, code, verifier, fetch);
	if (!profile) redirect(303, FAILED);

	const userId = await findOrCreateUser(users, provider, profile.id, profile.name);
	const session = await createSession(users, userId);
	setSessionCookie(cookies, session.token, session.expiresAt);
	redirect(303, isLocalPath(from) ? from : '/saved');
};
