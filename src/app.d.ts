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
		// No Platform: the Cloudflare adapter no longer passes one. The databases
		// are imported from 'cloudflare:workers' (see src/cloudflare.d.ts).
	}
}

export {};
