// POST /api/review/sync — see docs/api.md. The one call that keeps a signed-in
// browser's flashcard reviews and the account's in step: the browser sends the
// cards it answered, and is sent back what changed elsewhere.
import { fail, signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import { getReviewSettings, listReviewCards, saveReviewCards, saveReviewSettings } from '#lib/server/users.ts';
import { SYNC_MAX, parseCards } from '#lib/review/cards.ts';
import { parseSettings } from '#lib/review/decks.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// 500 cards with the longest dictionary words come to about 190 KB.
	const body = await readJson(request, 256 * 1024);
	if (body instanceof Response) return body;
	const { cards: sentCards, settings: sentSettings, since } = (body ?? {}) as Record<string, unknown>;
	if (sentCards !== undefined && (!Array.isArray(sentCards) || sentCards.length > SYNC_MAX)) {
		return fail(400, 'invalid_cards');
	}

	const now = Date.now();
	const sent = parseCards(sentCards ?? [], now, SYNC_MAX);
	if (sent.length) {
		// Only dictionary words are kept, as in POST /api/saved/merge.
		const { db } = await getDatabases();
		const known = new Set((await wordSummaries(db, sent.map((card) => card.word))).map((s) => s.word));
		await saveReviewCards(who.users, who.user.id, sent.filter((card) => known.has(card.word)), now);
	}
	const settings = parseSettings(sentSettings, now);
	if (settings?.updated_at) await saveReviewSettings(who.users, who.user.id, settings);

	// Without `since` the browser is still sending and wants nothing back yet.
	const from = typeof since === 'number' && since >= 0 ? since : null;
	return Response.json({
		cards: from === null ? [] : await listReviewCards(who.users, who.user.id, from),
		settings: await getReviewSettings(who.users, who.user.id),
		now
	});
};
