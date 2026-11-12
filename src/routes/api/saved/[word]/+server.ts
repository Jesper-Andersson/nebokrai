// PUT and DELETE /api/saved/<word> — see docs/api.md.
import { fail, signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import { MAX_LISTS, MAX_WORD_LENGTH } from '#lib/saved.ts';
import { addToLists, removeWord, saveWord } from '#lib/server/users.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// The body is optional: the lists to put the word in, which is how Undo
	// brings a removed word back into the lists it was in.
	let lists: unknown;
	if (request.headers.get('content-type')?.includes('json')) {
		const body = await readJson(request, 8 * 1024);
		if (body instanceof Response) return body;
		lists = (body as { lists?: unknown } | null)?.lists;
	}
	// Only dictionary words are kept, so the account cannot be used to store other text.
	const { db } = await getDatabases();
	const known = params.word.length <= MAX_WORD_LENGTH && (await wordSummaries(db, [params.word])).length;
	if (!known) return fail(404, 'not_found');
	if (!(await saveWord(who.users, who.user.id, params.word))) return fail(409, 'full');
	// A list the account does not have is skipped: it may have been deleted in another tab.
	const ids = Array.isArray(lists) ? lists.filter((id) => typeof id === 'string').slice(0, MAX_LISTS) : [];
	await addToLists(who.users, who.user.id, ids.map((id) => [id, params.word]));
	return Response.json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	await removeWord(who.users, who.user.id, params.word);
	return Response.json({ ok: true });
};
