// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			settings: import('#lib/settings.ts').Settings;
			/** The signed-in visitor, or null. Set in hooks.server.ts from the session cookie. */
			user: import('#lib/server/users.ts').User | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			/** Cloudflare's cache, and the way to keep working after answering (see src/lib/server/cache.ts) */
			caches?: import('#lib/server/cache.ts').EdgePlatform['caches'];
			ctx?: import('#lib/server/cache.ts').EdgePlatform['ctx'];
			env?: {
				/** Cloudflare D1 with nebokrai.db */
				DB?: Parameters<typeof import('#lib/search/db.ts').fromD1>[0];
				/** Cloudflare D1 with vesum.db (optional, kept separate for licensing) */
				VESUM?: Parameters<typeof import('#lib/search/db.ts').fromD1>[0];
				/** Cloudflare D1 for "Report an issue" reports (private, see src/lib/server/reports.ts) */
				REPORTS?: import('#lib/server/reports.ts').D1Writable;
				/** Cloudflare D1 for accounts and saved words (private, see src/lib/server/user-db.ts) */
				USERS?: import('#lib/server/user-db.ts').D1Users;
			};
		}
	}
}

export {};
