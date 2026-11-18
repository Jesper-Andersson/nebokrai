// /grammar/<lesson>: a grammar point's page (practice/intros.ts). The text is
// fixed; the examples are real sentences of the lesson's practice, drawn with
// a seed of the lesson's id so the page shows the same ones each time.
//
// The comments at the foot come from the accounts database (users.ts), the
// hidden ones too for the site's keeper. `turnstile` is the site key of the
// comment form's bot check, or null when the server has no secret to check a
// token with, as on the word page.
import { error } from '@sveltejs/kit';
import { STATS_USER_IDS, TURNSTILE_SECRET, TURNSTILE_SITE_KEY as OTHER_SITE_KEY } from '$app/env/private';
import type { Comment } from '#lib/comments.ts';
import { TURNSTILE_SITE_KEY } from '#lib/report.ts';
import { MAX_GAPS, drawGaps } from '#lib/practice/gaps.ts';
import { examplesOf, introOf, seededRandom, PER_RULE, type Example } from '#lib/practice/intros.ts';
import { LESSONS } from '#lib/practice/lessons.ts';
import { getDatabases } from '#lib/server/db.ts';
import { ownerIds } from '#lib/server/stats.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { listComments } from '#lib/server/users.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const intro = introOf(params.lesson);
	if (!intro) error(404, 'No such grammar point.');
	const lesson = LESSONS.find((each) => each.id === intro.id);
	let examples: Example[] = [];
	if (lesson) {
		// A few more than are shown, as some repeat
		const asked = lesson.points.flatMap((point) => Array<string>(PER_RULE + 1).fill(point)).slice(0, MAX_GAPS);
		const { db } = await getDatabases();
		examples = examplesOf(await drawGaps(db, asked, seededRandom(intro.id)));
	}
	const keeper = Boolean(locals.user && ownerIds(STATS_USER_IDS).includes(locals.user.id));
	const users = await getUserDb();
	// null: no accounts database here, so no comments either
	const comments: Comment[] | null = users ? await listComments(users, intro.id, keeper) : null;
	const turnstile = TURNSTILE_SECRET ? (OTHER_SITE_KEY ?? TURNSTILE_SITE_KEY) : null;
	return { id: intro.id, examples, comments, keeper, turnstile };
};
