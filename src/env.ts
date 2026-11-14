// Environment variables the server reads (`.env` during `npm run dev`, Worker
// secrets in production). All are optional: a provider whose pair is
// missing simply has no sign-in button, and without TURNSTILE_SECRET the
// report form has no bot check.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	GOOGLE_CLIENT_ID: { schema: optional, description: 'Google OAuth client id' },
	GOOGLE_CLIENT_SECRET: { schema: optional, description: 'Google OAuth client secret' },
	GITHUB_CLIENT_ID: { schema: optional, description: 'GitHub OAuth app client id' },
	GITHUB_CLIENT_SECRET: { schema: optional, description: 'GitHub OAuth app client secret' },
	REPORT_EMAIL: { schema: optional, description: 'Where a new report is announced by email (production only)' },
	TURNSTILE_SECRET: { schema: optional, description: 'Cloudflare Turnstile secret key: turns on the bot check of the report form' },
	STATS_USER_IDS: {
		schema: optional,
		description: 'Comma-separated user ids (users.id) that may open /stats; without it /stats is 404 for everyone'
	},
	STATS_IN_DEV: { schema: optional, description: 'Set to 1 to count visits into stats.db during npm run dev' },
	TURNSTILE_SITE_KEY: {
		schema: optional,
		description: 'Turnstile site key to use in place of nebokrai.app’s own (for Cloudflare’s test keys)'
	}
});
