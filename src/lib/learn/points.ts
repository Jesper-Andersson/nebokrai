// Which grammar points /learn lists, and how many it leaves to the points
// page (user's pick in Figma, "B4a", 2026-11-18): the first few of the two
// groups a learner meets first, the prepositions and then the verbs with
// their cases, each from the easiest level up, as /grammar/points orders
// them; the rest is one link away.
import { INTROS, TOPICS, introOf, type Intro, type TopicId } from '../practice/intros.ts';

/** Prepositions first: у and на come before any verb's pattern. */
export const SHOWN: readonly (readonly [TopicId, number])[] = [
	['prepositions', 4],
	['verb-cases', 3]
];

export interface PointGroup {
	id: TopicId;
	/** How many points the group has in all. */
	total: number;
	points: readonly Intro[];
}

/** The groups shown, each cut to its number, and how many points are left out of all of them. */
export function shownPoints(shown: readonly (readonly [TopicId, number])[] = SHOWN): {
	groups: PointGroup[];
	hidden: number;
} {
	const groups = shown.flatMap(([id, limit]) => {
		const topic = TOPICS.find((t) => t.id === id);
		if (!topic) return [];
		const points = topic.points.map(introOf).filter((intro): intro is Intro => intro !== undefined);
		return [{ id, total: points.length, points: points.slice(0, limit) }];
	});
	const listed = groups.reduce((n, group) => n + group.points.length, 0);
	return { groups, hidden: INTROS.length - listed };
}
