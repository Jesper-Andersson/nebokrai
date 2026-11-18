import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHOWN, shownPoints } from '../src/lib/learn/points.ts';
import { INTROS, TOPICS } from '../src/lib/practice/intros.ts';

test('the groups come in the order asked for, each cut to its number', () => {
	const { groups } = shownPoints();
	assert.deepEqual(groups.map((group) => group.id), SHOWN.map(([id]) => id));
	for (const [i, [, limit]] of SHOWN.entries()) assert.ok(groups[i].points.length <= limit);
	// The first preposition is the first a learner meets: у and на
	assert.equal(groups[0].points[0].id, 'where');
});

test('each group keeps the points page order, from the easiest level up', () => {
	for (const group of shownPoints().groups) {
		const topic = TOPICS.find((t) => t.id === group.id);
		assert.ok(topic);
		assert.deepEqual(group.points.map((point) => point.id), topic.points.slice(0, group.points.length));
		assert.equal(group.total, topic.points.length);
	}
});

test('the points shown and the points left out add up to every point', () => {
	const { groups, hidden } = shownPoints();
	const listed = groups.reduce((n, group) => n + group.points.length, 0);
	assert.equal(listed + hidden, INTROS.length);
	assert.ok(hidden > 0);
});

test('a topic that does not exist is left out, not shown empty', () => {
	// @ts-expect-error: not a topic
	const { groups, hidden } = shownPoints([['nouns', 3]]);
	assert.equal(groups.length, 0);
	assert.equal(hidden, INTROS.length);
});
