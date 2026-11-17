// GET /auth/callback/<provider>: the provider sends the visitor back here.
// Check the answer belongs to the attempt this browser started, find or create
// the account, start a session, and go back to the page the visitor signed in
// from (the Saved page when that is not known).
import { error, redirect } from '@sveltejs/kit';
import { ATTEMPT_COOKIE, RETURN_COOKIE, fetchProfile, isProvider, setSessionCookie } from '#lib/server/oauth.ts';
import { isLocalPath } from '#lib/server/request.ts';
import { getUserDb, hasUserDb } from '#lib/server/user-db.ts';
import { SESSION_COOKIE, createSession, deleteSession, findOrCreateUser } from '#lib/server/users.ts';
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

	if (!hasUserDb()) error(404);
	let session: { token: string; expiresAt: number } | null = null;
	try {
		const users = await getUserDb();
		const profile = users && (await fetchProfile(provider, url.origin, code, verifier, fetch));
		if (users && profile) {
			// Signing in again, perhaps to another account: the session this
			// browser had ends here instead of staying valid for its 30 days.
			const previous = cookies.get(SESSION_COOKIE);
			if (previous) await deleteSession(users, previous);
			const userId = await findOrCreateUser(users, provider, profile.id, profile.name);
			session = await createSession(users, userId);
		}
	} catch (err) {
		// The provider or the user database failed: the Saved page says so,
		// rather than the visitor meeting an error page.
		console.error('sign-in failed', err);
	}
	if (!session) redirect(303, FAILED);
	setSessionCookie(cookies, session.token, session.expiresAt);
	redirect(303, isLocalPath(from) ? from : '/saved');
};
