// POST /api/review/sync — see docs/api.md. The one call that keeps a signed-in
// browser's flashcard reviews and the account's in step: the browser sends the
// cards it answered, and is sent back what changed elsewhere.
import { fail, signedIn } from '#lib/server/account.ts';
import { getDatabases } from '#lib/server/db.ts';
import { readJson } from '#lib/server/request.ts';
import {
	DEVICE, getReviewSettings, listReviewCards, listReviewDays, saveReviewCards, saveReviewDays, saveReviewSettings
} from '#lib/server/users.ts';
import { SYNC_MAX, parseCards } from '#lib/review/cards.ts';
import { isPointKey } from '#lib/practice/points.ts';
import { DAYS_MAX, parseDays } from '#lib/review/days.ts';
import { parseSettings } from '#lib/review/decks.ts';
import { wordSummaries } from '#lib/search/word.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const who = await signedIn(locals);
	if (who instanceof Response) return who;
	// 500 cards with the longest dictionary words come to about 190 KB.
	const body = await readJson(request, 256 * 1024);
	if (body instanceof Response) return body;
	const { cards: sentCards, settings: sentSettings, since, device: sentDevice, days: sentDays } =
		(body ?? {}) as Record<string, unknown>;
	if (sentCards !== undefined && (!Array.isArray(sentCards) || sentCards.length > SYNC_MAX)) {
		return fail(400, 'invalid_cards');
	}

	const now = Date.now();
	const sent = parseCards(sentCards ?? [], now, SYNC_MAX);
	if (sent.length) {
		// Only dictionary words are kept, as in POST /api/saved/merge, and the
		// grammar points of /practice, whose schedules travel as cards too.
		const { db } = await getDatabases();
		const words = sent.map((card) => card.word).filter((word) => !isPointKey(word));
		const known = new Set(words.length ? (await wordSummaries(db, words)).map((s) => s.word) : []);
		await saveReviewCards(
			who.users, who.user.id, sent.filter((card) => known.has(card.word) || isPointKey(card.word)), now);
	}
	const settings = parseSettings(sentSettings, now);
	if (settings?.updated_at) await saveReviewSettings(who.users, who.user.id, settings);
	// Day counts are kept under the name the browser gives itself; without one there is nowhere to put them.
	const device = typeof sentDevice === 'string' && DEVICE.test(sentDevice) ? sentDevice : null;
	if (device) await saveReviewDays(who.users, who.user.id, device, parseDays(sentDays, DAYS_MAX));

	// Without `since` the browser is still sending and wants nothing back yet.
	const from = typeof since === 'number' && since >= 0 ? since : null;
	return Response.json({
		cards: from === null ? [] : await listReviewCards(who.users, who.user.id, from),
		settings: await getReviewSettings(who.users, who.user.id),
		days: from === null ? {} : await listReviewDays(who.users, who.user.id, device ?? ''),
		now
	});
};
