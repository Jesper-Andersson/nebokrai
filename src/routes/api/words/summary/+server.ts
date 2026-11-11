// POST /api/words/summary — see docs/api.md. A POST because the list of words
// can be longer than a URL allows.
import { fail } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import { MAX_WORD_LENGTH, SUMMARY_MAX } from '#lib/saved.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	// 500 of the longest dictionary words come to about 62 KB.
	const body = await readJson(request, 128 * 1024);
	if (body instanceof Response) return body;
	const asked = (body as { words?: unknown } | null)?.words;
	if (!Array.isArray(asked) || asked.length > SUMMARY_MAX) return fail(400, 'invalid_words');
	const words = asked.filter((w): w is string => typeof w === 'string' && w.length <= MAX_WORD_LENGTH);
	const { db } = await getDatabases(platform);
	return Response.json({ words: await wordSummaries(db, words) });
};
