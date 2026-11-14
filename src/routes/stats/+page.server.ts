// /stats: how many people use the site, for its owner only. Anyone whose
// account id is not in the secret STATS_USER_IDS gets the same 404 as an
// address that does not exist, so the page does not say it is there.
//
// ?days=7, 30 (the default) or 90 picks the period for everything but the
// calendar, which is always the last 13 weeks.
import { error } from '@sveltejs/kit';
import { STATS_USER_IDS } from '$app/env/private';
import { statsReport } from '#lib/server/stats.ts';
import { getStatsDb } from '#lib/server/stats-db.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { accountStats } from '#lib/server/users.ts';
import type { PageServerLoad } from './$types';

const RANGES = [7, 30, 90];

export const load: PageServerLoad = async ({ locals, url, setHeaders, depends }) => {
	// The page asks for the counts again every minute while it is open (+page.svelte)
	depends('stats:counts');
	const allowed = (STATS_USER_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean);
	if (!locals.user || !allowed.includes(locals.user.id)) error(404);
	setHeaders({ 'cache-control': 'private, no-store' });

	const asked = Number(url.searchParams.get('days'));
	const days = RANGES.includes(asked) ? asked : 30;
	const now = Date.now();
	const [stats, users] = await Promise.all([getStatsDb(), getUserDb()]);
	return {
		days,
		ranges: RANGES,
		report: stats ? await statsReport(stats, now, days) : null,
		accounts: users ? await accountStats(users, now) : null
	};
};
