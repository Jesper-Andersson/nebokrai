// POST /api/comments/<id>/report: a reader reports a comment under a grammar
// point's page. The comment stays up and its count of reports goes up; the
// site's keeper decides whether to hide it (POST /api/comments/<id>).
//
// The first report of a comment is also stored as a "Report an issue" report
// (src/lib/server/reports.ts), which in production mails the keeper, or
// nobody would know to look. No body. IP addresses are used only for the
// rate limit, in memory.
import { introPath } from '#lib/practice/intros.ts';
import { fail } from '#lib/server/account.ts';
import { rateLimiter } from '#lib/server/bot-check.ts';
import { rateKey } from '#lib/server/request.ts';
import { saveReport } from '#lib/server/reports.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { reportComment } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

// At most 20 reports per 10 minutes from one address
const tooMany = rateLimiter(20, 10 * 60 * 1000);

export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) return fail(404, 'not_found');
	if (tooMany(rateKey(getClientAddress()))) return fail(429, 'too_many');

	const db = await getUserDb();
	if (!db) return fail(503, 'unavailable');
	const reported = await reportComment(db, id);
	if (!reported) return fail(404, 'not_found');

	if (reported.reports === 1) {
		try {
			await saveReport({
				kind: 'other',
				message: `Comment #${id} under ${introPath(reported.page)} was reported:\n\n${reported.body}`,
				email: null,
				entryId: null,
				word: null,
				pos: null,
				query: null,
				lang: locals.settings.lang,
				layout: locals.settings.layout,
				page: introPath(reported.page),
				userAgent: null
			});
		} catch (err) {
			// The count is kept all the same; the keeper sees it beside the comment
			console.error('Could not store the report of a comment:', err);
		}
	}
	return Response.json({ ok: true });
};
