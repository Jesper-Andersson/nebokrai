// POST /api/report: store a "Report an issue" report (see src/lib/server/reports.ts).
//
// Body (JSON): { kind, message, email?, entry?, query?, page?, website?, turnstile? }
// `website` is a honeypot: the form hides it, so only bots fill it in. They get
// a normal-looking success and nothing is stored.
// `turnstile` is the token of the form's bot check (src/lib/Turnstile.svelte).
// When the server has TURNSTILE_SECRET, a report without a token Cloudflare
// accepts gets 403 `bot_check`, and 503 `bot_check_unavailable` when
// Cloudflare gives no verdict. The source of this site is public, so the
// honeypot stops only bots that have not read it; the token cannot be made up.
//
// The word and part of speech are looked up from `entry` here rather than
// taken from the browser. IP addresses are used only for the rate limit below,
// in memory, and never stored.
import { botCheck, rateLimiter } from '#lib/server/bot-check.ts';
import { getDatabases } from '#lib/server/db.ts';
import { saveReport } from '#lib/server/reports.ts';
import { rateKey, readJson } from '#lib/server/request.ts';
import { isReportKind, stripControls } from '#lib/report.ts';
import type { RequestHandler } from './$types';

const MAX_MESSAGE = 2000;
const MAX_EMAIL = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// At most 5 reports per 10 minutes from one address: a brake, not a wall
// (see rateLimiter). Turnstile (below) is the protection against real spam.
const tooMany = rateLimiter(5, 10 * 60 * 1000);

// Everything stored passes through here: a report is read in a terminal
// (`npm run reports`, wrangler), so it must not carry control characters.
const text = (value: unknown, max: number) =>
	(typeof value === 'string' && stripControls(value).trim().slice(0, max)) || null;

const fail = (status: number, error: string) => Response.json({ error }, { status });

// The longest report is 2,000 characters of message, about 6 KB as Ukrainian text in JSON.
const MAX_BODY = 16 * 1024;

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const parsed = await readJson(request, MAX_BODY);
	if (parsed instanceof Response) return parsed;
	if (!parsed || typeof parsed !== 'object') return fail(400, 'invalid_json');
	const body = parsed as Record<string, unknown>;

	if (text(body.website, 200)) return Response.json({ ok: true, id: null });

	const kind = typeof body.kind === 'string' && isReportKind(body.kind) ? body.kind : null;
	if (!kind) return fail(400, 'invalid_kind');

	const message = text(body.message, MAX_MESSAGE);
	if (!message) return fail(400, 'missing_message');

	const email = text(body.email, MAX_EMAIL);
	if (email && !EMAIL.test(email)) return fail(400, 'invalid_email');

	// Before anything is stored or mailed. A token is good for one check, so
	// this comes after the mistakes a person can fix and send again.
	const refused = await botCheck(body.turnstile, getClientAddress());
	if (refused) return refused;

	// Count only reports that would be stored, so fixing a typo doesn't use up the limit.
	// getClientAddress() is the visitor's address as Cloudflare saw it. A
	// header read here instead could be set by the sender wherever the site
	// runs without Cloudflare in front.
	if (tooMany(rateKey(getClientAddress()))) return fail(429, 'too_many');

	let entryId: number | null = null;
	let word: string | null = null;
	let pos: string | null = null;
	const asked = Number(body.entry);
	if (Number.isInteger(asked) && asked > 0) {
		const { db } = await getDatabases();
		const [row] = await db.all<{ id: number; word: string; pos: string }>(
			'SELECT id, word, pos FROM entries WHERE id = ?',
			[asked]
		);
		if (row) ({ id: entryId, word, pos } = row);
	}

	const id = await saveReport({
		kind,
		message,
		email,
		entryId,
		word,
		pos,
		query: text(body.query, 100),
		lang: locals.settings.lang,
		layout: locals.settings.layout,
		page: text(body.page, 300),
		userAgent: text(request.headers.get('user-agent'), 300)
	});
	return Response.json({ ok: true, id });
};
