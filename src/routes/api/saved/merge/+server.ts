// POST /api/saved/merge — see docs/api.md. Called once after signing in, to
// add the words this browser saved while signed out to the account.
import { signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import { mergeSaved, parseSavedWords } from '#lib/server/users.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const who = await signedIn(locals, platform);
	if (who instanceof Response) return who;
	// A full list of 5,000 long words comes to about 800 KB.
	const body = await readJson(request, 1024 * 1024);
	if (body instanceof Response) return body;
	const sent = parseSavedWords((body as { words?: unknown } | null)?.words);
	// Only dictionary words are kept, as in PUT /api/saved/<word>.
	const { db } = await getDatabases(platform);
	const known = new Set((await wordSummaries(db, sent.map((w) => w.word))).map((s) => s.word));
	const words = await mergeSaved(who.users, who.user.id, sent.filter((w) => known.has(w.word)));
	return Response.json({ words });
};
