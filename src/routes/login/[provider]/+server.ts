// GET /login/google, /login/github: send the visitor to the provider to sign in.
import { error, redirect } from '@sveltejs/kit';
import { ATTEMPT_COOKIE, RETURN_COOKIE, authorizeUrl, isProvider, newAttempt } from '#lib/server/oauth.ts';
import { returnPath } from '#lib/server/request.ts';
import { hasUserDb } from '#lib/server/user-db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, cookies, request }) => {
	if (!isProvider(params.provider) || !hasUserDb()) error(404);
	const attempt = newAttempt();
	const target = await authorizeUrl(params.provider, url.origin, attempt);
	if (!target) error(404);
	cookies.set(ATTEMPT_COOKIE, `${attempt.state}.${attempt.verifier}`, {
		path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600
	});
	// The sign-in panel is in the settings menu of every page: remember which,
	// so the callback returns there. A stale one from an abandoned try is dropped.
	const from = returnPath(request.headers.get('referer'), url.origin);
	if (from) cookies.set(RETURN_COOKIE, from, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600 });
	else cookies.delete(RETURN_COOKIE, { path: '/' });
	redirect(302, target, { external: true });
};
