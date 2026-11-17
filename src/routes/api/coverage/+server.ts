// GET /api/coverage — see docs/api.md. How often each common word is used,
// for the coverage figure on /learn (src/lib/coverage.ts). The same for every
// visitor and changed only by a new dictionary, so it is cached for a day.
import { coverageTable } from '#lib/coverage.ts';
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

const DAY = 60 * 60 * 24;

export const GET: RequestHandler = async ({ url }) =>
	cached(`${url.origin}/api/coverage`, async () => {
		const { db } = await getDatabases();
		return Response.json(await coverageTable(db));
	}, `public, max-age=${DAY}, s-maxage=${DAY}`);
