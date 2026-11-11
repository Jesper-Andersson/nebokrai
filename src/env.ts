// Environment variables the server reads (`.env` during `npm run dev`, Worker
// secrets in production). All four are optional: a provider whose pair is
// missing simply has no sign-in button.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	GOOGLE_CLIENT_ID: { schema: optional, description: 'Google OAuth client id' },
	GOOGLE_CLIENT_SECRET: { schema: optional, description: 'Google OAuth client secret' },
	GITHUB_CLIENT_ID: { schema: optional, description: 'GitHub OAuth app client id' },
	GITHUB_CLIENT_SECRET: { schema: optional, description: 'GitHub OAuth app client secret' }
});
