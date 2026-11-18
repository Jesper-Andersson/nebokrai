// /grammar/<lesson>: a grammar point's page (practice/intros.ts). The text is
// fixed; the examples are real sentences of the lesson's practice, drawn with
// a seed of the lesson's id so the page shows the same ones each time.
import { error } from '@sveltejs/kit';
import { MAX_GAPS, drawGaps } from '#lib/practice/gaps.ts';
import { examplesOf, introOf, seededRandom, PER_RULE, type Example } from '#lib/practice/intros.ts';
import { LESSONS } from '#lib/practice/lessons.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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
	return { id: intro.id, examples };
};
