// POST /api/saved/merge — see docs/api.md. Called once after signing in, to
// add the words this browser saved while signed out to the account, and the
// marks of which of them it exported.
import { signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import { listExported, markExported, mergeSaved, parseExportedMarks, parseSavedWords } from '#lib/server/users.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// A full list of 5,000 long words comes to about 800 KB.
	const body = await readJson(request, 1024 * 1024);
	if (body instanceof Response) return body;
	const { words: sentWords, exported: sentMarks } = (body ?? {}) as { words?: unknown; exported?: unknown };
	const sent = parseSavedWords(sentWords);
	// Only dictionary words are kept, as in PUT /api/saved/<word>.
	const { db } = await getDatabases();
	const known = new Set((await wordSummaries(db, sent.map((w) => w.word))).map((s) => s.word));
	const words = await mergeSaved(who.users, who.user.id, sent.filter((w) => known.has(w.word)));
	// After the words: a mark is kept only for a word in the account's list.
	await markExported(who.users, who.user.id, parseExportedMarks(sentMarks));
	return Response.json({ words, exported: await listExported(who.users, who.user.id) });
};
