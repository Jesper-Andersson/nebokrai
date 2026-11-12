// GET /api/word/<word> — see docs/api.md.
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { wordDetails } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const word = params.word;
	const notFound = () => Response.json({ error: 'not_found', word }, { status: 404 });
	// No dictionary word is this long (the longest has 60 letters): no need to ask the database.
	if (word.length > MAX_WORD_LENGTH) return notFound();

	return cached(`${url.origin}/api/word/${encodeURIComponent(word)}`, async () => {
		const { db } = await getDatabases();
		const entries = await wordDetails(db, word);
		return entries.length ? Response.json({ word, entries }) : notFound();
	});
};
