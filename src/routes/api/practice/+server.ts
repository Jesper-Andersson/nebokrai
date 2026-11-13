// GET /api/practice?points=bez-gen,do-gen,… — see docs/api.md. One sentence
// with a noun left out for each grammar point named, drawn at random. Never
// cached: the same request must give other sentences the next time. It reads
// few rows (the sentences asked for and their nouns' forms), so it need not be.
import { getDatabases } from '#lib/server/db.ts';
import { MAX_GAPS, drawGaps } from '#lib/practice/gaps.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const points = (url.searchParams.get('points') ?? '').split(',').filter(Boolean);
	if (!points.length || points.length > MAX_GAPS) {
		return Response.json({ error: 'bad_points', max: MAX_GAPS }, { status: 400 });
	}
	const { db } = await getDatabases();
	return Response.json(
		{ gaps: await drawGaps(db, points, Math.random) },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
