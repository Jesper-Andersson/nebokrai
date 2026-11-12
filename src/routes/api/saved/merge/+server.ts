// POST /api/saved/merge — see docs/api.md. Called once after signing in, to
// add the words this browser saved while signed out to the account, with the
// lists it sorted them into and the marks of which of them it exported.
import { signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { parseLists } from '#lib/lists.ts';
import { readJson } from '#lib/server/request.ts';
import {
	listExported, markExported, mergeLists, mergeSaved, parseExportedMarks, parseSavedWords
} from '#lib/server/users.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// A full list of 5,000 long words comes to about 800 KB; the same words
	// again, sorted into lists, fit in the rest.
	const body = await readJson(request, 2 * 1024 * 1024);
	if (body instanceof Response) return body;
	const { words: sentWords, exported: sentMarks, lists: sentLists } =
		(body ?? {}) as { words?: unknown; exported?: unknown; lists?: unknown };
	const sent = parseSavedWords(sentWords);
	// Only dictionary words are kept, as in PUT /api/saved/<word>.
	const { db } = await getDatabases();
	const known = new Set((await wordSummaries(db, sent.map((w) => w.word))).map((s) => s.word));
	const words = await mergeSaved(who.users, who.user.id, sent.filter((w) => known.has(w.word)));
	// After the words: a list holds, and a mark is kept for, only words in the account.
	const lists = await mergeLists(who.users, who.user.id, parseLists(sentLists));
	await markExported(who.users, who.user.id, parseExportedMarks(sentMarks));
	return Response.json({ words, exported: await listExported(who.users, who.user.id), lists });
};
