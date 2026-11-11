import { configuredProviders } from '#lib/server/oauth.ts';
import { hasUserDb } from '#lib/server/user-db.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, platform }) => ({
	settings: locals.settings,
	user: locals.user,
	/** The sign-in buttons to offer. Empty where accounts are not set up. */
	providers: hasUserDb(platform) ? configuredProviders() : []
});
