// GET and POST /api/placement — see docs/api.md. The placement test
// (src/lib/placement.ts): GET draws a new one, POST scores its words. Nothing
// is stored: the browser keeps the result, and an account gets it with the
// next POST /api/review/sync. Signed in or not alike.
import { WORD_ITEMS, type WordAnswer } from '#lib/placement.ts';
import { getDatabases } from '#lib/server/db.ts';
import { drawTest, scoreTest } from '#lib/server/placement.ts';
import { readJson } from '#lib/server/request.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

export const GET: RequestHandler = async () => {
	const { db, vesum } = await getDatabases();
	const test = await drawTest(db, vesum, Math.random);
	// A database built before the made-up words were: the test cannot tell a guess from a word known
	if (!test) return Response.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
	return Response.json(test, { headers: NO_STORE });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await readJson(request, 16 * 1024);
	if (body instanceof Response) return body;
	const { answers } = (body ?? {}) as Record<string, unknown>;
	if (!Array.isArray(answers) || !answers.length || answers.length > WORD_ITEMS) {
		return Response.json({ error: 'invalid_answers', max: WORD_ITEMS }, { status: 400 });
	}
	const read: WordAnswer[] = answers.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const { word, yes } = item as Record<string, unknown>;
		return typeof word === 'string' && word && word.length <= MAX_WORD_LENGTH && typeof yes === 'boolean'
			? [{ word, yes }]
			: [];
	});
	const { db } = await getDatabases();
	return Response.json(await scoreTest(db, read), { headers: NO_STORE });
};
