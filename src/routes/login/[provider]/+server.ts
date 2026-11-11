// GET /login/google, /login/github: send the visitor to the provider to sign in.
import { error, redirect } from '@sveltejs/kit';
import { ATTEMPT_COOKIE, authorizeUrl, isProvider, newAttempt } from '#lib/server/oauth.ts';
import { hasUserDb } from '#lib/server/user-db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, cookies }) => {
	if (!isProvider(params.provider) || !hasUserDb()) error(404);
	const attempt = newAttempt();
	const target = await authorizeUrl(params.provider, url.origin, attempt);
	if (!target) error(404);
	cookies.set(ATTEMPT_COOKIE, `${attempt.state}.${attempt.verifier}`, {
		path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600
	});
	redirect(302, target, { external: true });
};
