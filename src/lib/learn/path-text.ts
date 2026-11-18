// How a step of the levelled path (src/lib/path.ts) is put into words, for the
// path card on /learn and its stage list: "300 of the commonest 500 words",
// "Lesson 4: For & About", and the card's button, "Next: lesson 4 · For & About".
import type { Messages } from '../i18n.ts';
import type { Criterion, PathLesson } from '../path.ts';

/** The first lesson a lessons step still waits on, with its number and short name. */
function lessonOf(m: Messages, criterion: Criterion, lessons: readonly PathLesson[]) {
	const lesson = criterion.lesson ? lessons.find((l) => l.id === criterion.lesson) : undefined;
	if (!lesson) return null;
	return { n: lesson.n, name: m.learn.short[lesson.id] ?? lesson.id, verb: lesson.group === 'government' };
}

/** What a step asks for, as the stage list says it. */
export const stepText = (m: Messages, criterion: Criterion): string =>
	m.path.step(criterion.kind, criterion.key, criterion.need);

/** A step not yet done, as a link: the next lesson by name, or else what the step asks for. */
export function openText(m: Messages, criterion: Criterion, lessons: readonly PathLesson[]): string {
	const lesson = criterion.kind === 'lessons' ? lessonOf(m, criterion, lessons) : null;
	if (!lesson) return stepText(m, criterion);
	return lesson.verb ? m.path.verbLesson(lesson.n, lesson.name) : m.path.lesson(lesson.n, lesson.name);
}

/** The path card's button: "Next: lesson 4 · For & About". */
export function goText(m: Messages, criterion: Criterion, lessons: readonly PathLesson[]): string {
	const lesson = criterion.kind === 'lessons' ? lessonOf(m, criterion, lessons) : null;
	if (lesson) return m.path.go(lesson.verb ? m.path.goVerbLesson(lesson.n, lesson.name) : m.path.goLesson(lesson.n, lesson.name));
	return m.path.go(m.path.goWhat(criterion.kind, criterion.key));
}
