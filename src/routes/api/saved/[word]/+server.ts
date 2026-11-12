// PUT and DELETE /api/saved/<word> — see docs/api.md.
import { fail, signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { removeWord, saveWord } from '#lib/server/users.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// Only dictionary words are kept, so the account cannot be used to store other text.
	const { db } = await getDatabases();
	const known = params.word.length <= MAX_WORD_LENGTH && (await wordSummaries(db, [params.word])).length;
	if (!known) return fail(404, 'not_found');
	if (!(await saveWord(who.users, who.user.id, params.word))) return fail(409, 'full');
	return Response.json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	await removeWord(who.users, who.user.id, params.word);
	return Response.json({ ok: true });
};
