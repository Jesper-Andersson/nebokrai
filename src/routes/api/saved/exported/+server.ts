// POST /api/saved/exported — see docs/api.md. Called by the Saved page after
// it has made an export file, with the words that are in it.
import { signedIn } from '#lib/server/account.ts';
import { readJson } from '#lib/server/request.ts';
import { markExported, parseExportedWords } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// A full list of 5,000 long words comes to about 800 KB.
	const body = await readJson(request, 1024 * 1024);
	if (body instanceof Response) return body;
	await markExported(who.users, who.user.id, parseExportedWords((body as { words?: unknown } | null)?.words));
	return Response.json({ ok: true });
};
