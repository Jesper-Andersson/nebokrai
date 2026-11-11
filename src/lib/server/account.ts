// What every account endpoint starts with: who is asking, and their database.
import { getUserDb } from './user-db.ts';
import type { User, UserDb } from './users.ts';

export const fail = (status: number, error: string) => Response.json({ error }, { status });

/** The signed-in visitor and the user database, or the 401 to answer with. */
export async function signedIn(
	locals: App.Locals, platform: App.Platform | undefined
): Promise<{ user: User; users: UserDb } | Response> {
	const users = locals.user ? await getUserDb(platform) : undefined;
	return locals.user && users ? { user: locals.user, users } : fail(401, 'signed_out');
}
