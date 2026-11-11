// Sign-in with Google or GitHub: the OAuth 2.0 authorisation code flow with
// PKCE, written out with fetch. Only the provider's id for the person and their
// display name are read; no email is requested.
//
// A provider is offered when its client id and secret are set (src/env.ts).
// Each needs this redirect address registered: <site>/auth/callback/<provider>.
import type { Cookies } from '@sveltejs/kit';
import {
	GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
} from '$app/env/private';
import { SESSION_COOKIE, type Provider } from './users.ts';

interface Endpoints {
	authorize: string;
	token: string;
	profile: string;
	scope: string;
	/** Pick the id and display name out of the provider's profile response. */
	read(profile: Record<string, unknown>): { id: unknown; name: unknown };
}

const ENDPOINTS: Record<Provider, Endpoints> = {
	google: {
		authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
		token: 'https://oauth2.googleapis.com/token',
		profile: 'https://openidconnect.googleapis.com/v1/userinfo',
		scope: 'openid profile',
		read: (p) => ({ id: p.sub, name: p.name })
	},
	github: {
		authorize: 'https://github.com/login/oauth/authorize',
		token: 'https://github.com/login/oauth/access_token',
		profile: 'https://api.github.com/user',
		scope: '', // the public profile needs no scope
		read: (p) => ({ id: p.id, name: p.name ?? p.login })
	}
};

function credentials(provider: Provider): { id: string; secret: string } | undefined {
	const [id, secret] = provider === 'google'
		? [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]
		: [GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET];
	return id && secret ? { id, secret } : undefined;
}

export function isProvider(name: string): name is Provider {
	return name === 'google' || name === 'github';
}

/** The providers that have credentials here, in the order the buttons are shown. */
export function configuredProviders(): Provider[] {
	return (['google', 'github'] as const).filter((p) => credentials(p));
}

const base64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

/** A fresh `state` (ties the callback to this browser) and PKCE verifier. */
export function newAttempt(): { state: string; verifier: string } {
	const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
	return { state: random(), verifier: random() };
}

const redirectUri = (origin: string, provider: Provider) => `${origin}/auth/callback/${provider}`;

/** The provider's page to send the visitor to, or undefined if it is not configured. */
export async function authorizeUrl(
	provider: Provider, origin: string, attempt: { state: string; verifier: string }
): Promise<string | undefined> {
	const client = credentials(provider);
	if (!client) return undefined;
	const { authorize, scope } = ENDPOINTS[provider];
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(attempt.verifier));
	const url = new URL(authorize);
	url.search = new URLSearchParams({
		response_type: 'code',
		client_id: client.id,
		redirect_uri: redirectUri(origin, provider),
		state: attempt.state,
		code_challenge: base64url(new Uint8Array(digest)),
		code_challenge_method: 'S256',
		...(scope && { scope })
	}).toString();
	return url.href;
}

/**
 * Trade the callback's `code` for the person's id and display name at the
 * provider. Null if the provider refuses or answers something unexpected.
 */
export async function fetchProfile(
	provider: Provider, origin: string, code: string, verifier: string, fetcher: typeof fetch
): Promise<{ id: string; name: string | null } | null> {
	const client = credentials(provider);
	if (!client) return null;
	const { token, profile, read } = ENDPOINTS[provider];
	try {
		const tokens = await fetcher(token, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				client_id: client.id,
				client_secret: client.secret,
				redirect_uri: redirectUri(origin, provider),
				code_verifier: verifier
			})
		});
		const { access_token } = (await tokens.json()) as { access_token?: unknown };
		if (!tokens.ok || typeof access_token !== 'string') return null;

		const res = await fetcher(profile, {
			// GitHub's API rejects requests without a User-Agent.
			headers: { accept: 'application/json', authorization: `Bearer ${access_token}`, 'user-agent': 'nebokrai' }
		});
		if (!res.ok) return null;
		const { id, name } = read(await res.json());
		if (typeof id !== 'string' && typeof id !== 'number') return null;
		return { id: String(id), name: typeof name === 'string' && name ? name.slice(0, 100) : null };
	} catch {
		return null;
	}
}

/** Short-lived cookie that carries `state` and the verifier to the callback. */
export const ATTEMPT_COOKIE = 'oauth';

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: number): void {
	// SvelteKit adds Secure everywhere except on localhost.
	cookies.set(SESSION_COOKIE, token, {
		path: '/', httpOnly: true, sameSite: 'lax', expires: new Date(expiresAt)
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
