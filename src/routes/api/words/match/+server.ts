// POST /api/words/match — see docs/api.md. Which dictionary word each word of
// an imported list is. A POST because the list is longer than a URL allows.
import { fail } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { MATCH_MAX, SUGGEST_MAX, matchWords } from '#lib/search/match.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	// 500 words of an import come to well under 64 KB.
	const body = await readJson(request, 128 * 1024);
	if (body instanceof Response) return body;
	const { words: asked, suggest } = (body ?? {}) as { words?: unknown; suggest?: unknown };
	const max = suggest === true ? SUGGEST_MAX : MATCH_MAX;
	if (!Array.isArray(asked) || asked.length > max) return fail(400, 'invalid_words');
	const words = asked.filter((w): w is string => typeof w === 'string' && !!w && w.length <= MAX_WORD_LENGTH);
	const { db } = await getDatabases();
	return Response.json({ matches: await matchWords(db, words, { suggest: suggest === true }) });
};
