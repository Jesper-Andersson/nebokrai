// What this site uses from Cloudflare's runtime module. The bindings are the
// four D1 databases and the mail sender in wrangler.jsonc. Each is described
// by the few methods
// the code calls (see the files named below), not by Cloudflare's full types,
// so the type check needs no generated file.
//
// During `npm run dev` the SvelteKit adapter stands in for this module with
// empty local databases; the code under src/lib/server/ checks `dev` first and
// reads the .db files in the repo root instead.
//
// This file must stay free of top-level imports and exports, or TypeScript
// reads the block below as a change to a module it cannot find.
declare module 'cloudflare:workers' {
	export const env: {
		/** The dictionary: nebokrai.db loaded into D1 */
		DB?: Parameters<typeof import('#lib/search/db.ts').fromD1>[0];
		/** vesum.db, kept in a database of its own for its licence. The site works without it. */
		VESUM?: Parameters<typeof import('#lib/search/db.ts').fromD1>[0];
		/** "Report an issue" reports (private, see src/lib/server/reports.ts) */
		REPORTS?: import('#lib/server/reports.ts').D1Writable;
		/** Accounts and saved words (private, see src/lib/server/user-db.ts) */
		USERS?: import('#lib/server/user-db.ts').D1Users;
		/** Sends the email that announces a new report (see src/lib/server/reports.ts) */
		MAIL?: import('#lib/server/reports.ts').Mailer;
	};

	/** Keep the Worker running until `promise` settles, after the answer has been sent. */
	export function waitUntil(promise: Promise<unknown>): void;
}
