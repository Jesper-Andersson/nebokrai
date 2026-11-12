import { getDatabases } from '#lib/server/db.ts';
import { today, wordOfDay, type WordOfDay } from '#lib/word-of-day.ts';
import type { PageServerLoad } from './$types';

// The day's word is the same for every visitor, so a running server asks the
// database for it once a day, not once a page.
let kept: { day: number; entry: WordOfDay | null } | undefined;

export const load: PageServerLoad = async () => {
	const day = today();
	if (kept?.day !== day) {
		try {
			const { db } = await getDatabases();
			kept = { day, entry: await wordOfDay(db, day) };
		} catch {
			// The search page must open even when the database does not answer:
			// no word this time, and the next visit asks again.
			return { wordOfDay: null };
		}
	}
	return { wordOfDay: kept.entry };
};
