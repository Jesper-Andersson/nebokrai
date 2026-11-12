// POST /api/report: store a "Report an issue" report (see src/lib/server/reports.ts).
//
// Body (JSON): { kind, message, email?, entry?, query?, page?, website? }
// `website` is a honeypot: the form hides it, so only bots fill it in. They get
// a normal-looking success and nothing is stored.
//
// The word and part of speech are looked up from `entry` here rather than
// taken from the browser. IP addresses are used only for the rate limit below,
// in memory, and never stored.
import { getDatabases } from '#lib/server/db.ts';
import { saveReport } from '#lib/server/reports.ts';
import { rateKey, readJson } from '#lib/server/request.ts';
import { isReportKind, stripControls } from '#lib/report.ts';
import type { RequestHandler } from './$types';

const MAX_MESSAGE = 2000;
const MAX_EMAIL = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// At most 5 reports per 10 minutes from one address. Kept in memory, so on
// Cloudflare it counts per server instance: a brake, not a wall. Turnstile is
// the planned protection against real spam.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const recent = new Map<string, number[]>();

function tooMany(ip: string): boolean {
	const now = Date.now();
	const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	if (times.length >= LIMIT) {
		recent.set(ip, times);
		return true;
	}
	times.push(now);
	recent.set(ip, times);
	if (recent.size > 10_000) recent.clear(); // keep memory bounded
	return false;
}

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
