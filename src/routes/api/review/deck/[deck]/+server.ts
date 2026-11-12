// GET /api/review/deck/<deck> — see docs/api.md. The words of a ready-made
// review deck, commonest first. The same for every visitor, so it is cached.
import { commonRange } from '#lib/browse.ts';
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { COMMON_DECKS } from '#lib/review/decks.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const deck = COMMON_DECKS.find((d) => d.id === params.deck);
	if (!deck) return Response.json({ error: 'not_found', deck: params.deck }, { status: 404 });
	return cached(`${url.origin}/api/review/deck/${deck.id}`, async () => {
		const { db } = await getDatabases();
		return Response.json({ deck: deck.id, words: await commonRange(db, deck.from, deck.to) });
	});
};
