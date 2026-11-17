// POST /api/suggest: store a reader's suggested correction to one part of a
// word's page (see src/lib/suggest.ts and src/lib/server/suggestions.ts).
//
// Body (JSON): { target, word, pos, headword, sense_n?, tatoeba_id?, form_tags?,
//   current?, proposed, proposed_en?, note?, native?, name?, website?, turnstile? }
//
// The place is looked up in the dictionary here, and what the dictionary holds
// there is what gets stored as the "before": the browser's copy only helps to
// find it. A place that is not there (the page was loaded before a rebuild)
// gets 404 `not_found`.
//
// `website` is a honeypot and `turnstile` the bot check's token, as in
// /api/report. A signed-in visitor is not asked for a token: the account is
// the check. IP addresses are used only for the rate limit, in memory.
import { fail } from '#lib/server/account.ts';
import { botCheck, rateLimiter } from '#lib/server/bot-check.ts';
import { getDatabases } from '#lib/server/db.ts';
import { rateKey, readJson } from '#lib/server/request.ts';
import { getSuggestionDb } from '#lib/server/suggestion-db.ts';
import { addSuggestion } from '#lib/server/suggestions.ts';
import { stripControls } from '#lib/report.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { wordDetails } from '#lib/search/word.ts';
import {
	findCurrent,
	formTagsKey,
	isSuggestTarget,
	MAX_SUGGEST_NAME,
	MAX_SUGGEST_NOTE,
	MAX_SUGGEST_TEXT,
	unchanged,
	type SuggestPlace
} from '#lib/suggest.ts';
import type { RequestHandler } from './$types';

// At most 10 suggestions per 10 minutes from one address: someone reading a
// page carefully may send several, a script would send hundreds.
const tooMany = rateLimiter(10, 10 * 60 * 1000);

// Two texts of 500 characters and a note of 1,000, as Ukrainian text in JSON, with room to spare.
const MAX_BODY = 16 * 1024;

/** A trimmed string without control characters, or null when empty; `over` is set when it was too long. */
function text(value: unknown, max: number, over: { long: boolean }): string | null {
	if (typeof value !== 'string') return null;
	const clean = stripControls(value).trim();
	if (clean.length > max) over.long = true;
	return clean || null;
}

const positive = (value: unknown) => (Number.isInteger(value) && (value as number) > 0 ? (value as number) : null);

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const parsed = await readJson(request, MAX_BODY);
	if (parsed instanceof Response) return parsed;
	if (!parsed || typeof parsed !== 'object') return fail(400, 'invalid_json');
	const body = parsed as Record<string, unknown>;

	if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true, id: null });

	const over = { long: false };
	const word = text(body.word, MAX_WORD_LENGTH, over);
	const pos = text(body.pos, 40, over);
	const headword = text(body.headword, MAX_WORD_LENGTH * 2, over);
	if (!isSuggestTarget(body.target) || !word || !pos || !headword) return fail(400, 'invalid_target');

	const tags = Array.isArray(body.form_tags) && body.form_tags.length <= 20 &&
		body.form_tags.every((t) => typeof t === 'string' && t.length <= 40)
		? (body.form_tags as string[])
		: null;
	const place: SuggestPlace = {
		target: body.target,
		word,
		pos,
		headword,
		sense_n: positive(body.sense_n),
		tatoeba_id: positive(body.tatoeba_id),
		form_tags: tags,
		current: text(body.current, MAX_SUGGEST_TEXT * 4, over)
	};

	const proposed = text(body.proposed, MAX_SUGGEST_TEXT, over);
	const proposedEn = text(body.proposed_en, MAX_SUGGEST_TEXT, over);
	const note = text(body.note, MAX_SUGGEST_NOTE, over);
	const name = text(body.name, MAX_SUGGEST_NAME, over);
	if (over.long) return fail(413, 'too_large');
	if (!proposed) return fail(400, 'missing_proposed');

	const { db } = await getDatabases();
	const now = findCurrent(await wordDetails(db, word), place);
	if (!now) return fail(404, 'not_found');
	// Only a sentence has an English side; anything sent for another part is dropped
	const english = now.current_en === null ? null : proposedEn;
	if (unchanged(now, proposed, english)) return fail(400, 'unchanged');

	// After the mistakes a person can fix and send again: a token is good for one check
	if (!locals.user) {
		const refused = await botCheck(body.turnstile, getClientAddress());
		if (refused) return refused;
	}
	if (tooMany(rateKey(getClientAddress()))) return fail(429, 'too_many');

	const id = await addSuggestion(await getSuggestionDb(), {
		target: place.target,
		word,
		pos,
		headword,
		sense_n: place.target === 'meaning' || place.target === 'quote' ? (place.sense_n ?? null) : null,
		tatoeba_id: place.target === 'example' ? (place.tatoeba_id ?? null) : null,
		form_tags: place.target === 'form' ? formTagsKey(tags ?? []) : null,
		current: now.current,
		current_en: now.current_en,
		proposed,
		proposed_en: english,
		note,
		native: body.native === true,
		name,
		user_id: locals.user?.id ?? null,
		lang: locals.settings.lang
	});
	return Response.json({ ok: true, id });
};
