<!-- The grammar on /learn (user's pick in Figma, "B4a merged", 2026-11-18):
     on top, the lesson to practise next with its one button; under it the
     grammar points themselves, the first few of the prepositions and of the
     verbs with their cases (learn/points.ts), each row one link to the
     point's page: its name, its pattern, an example with the ending marked,
     and its level. The rest are on /grammar/points and the lessons on
     /practice, one link each. The lesson shown is the one last opened here or
     on /practice, or else the first not yet known (openLesson in lessons.ts);
     a lesson not begun opens its page first (lessonHref in intros.ts). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { shownPoints } from '#lib/learn/points.ts';
	import { INTROS, POINTS_PATH, introOf, introPath, lessonHref, lessonName, parts } from '#lib/practice/intros.ts';
	import { LESSONS, lessonRows, openLesson, readOpenLesson } from '#lib/practice/lessons.ts';
	import { cardKey, type Point } from '#lib/practice/points.ts';
	import { stateOf, type PointState } from '#lib/practice/round.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		offered,
		now,
		ready
	}: {
		/** Ids of the rules that have sentences: a rule without is never asked. */
		offered: readonly string[];
		now: number;
		ready: boolean;
	} = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	const held = (point: Point): PointState => (ready ? stateOf(review.cards.get(cardKey(point.id)), now) : 'new');
	let lessons = $derived(lessonRows(offered, held, review.placedLessons));

	let chosen = $state<string | null>(null);
	onMount(() => {
		chosen = readOpenLesson();
	});
	let next = $derived(openLesson(lessons, chosen));
	let nextIntro = $derived(next ? introOf(next.id) : undefined);

	const { groups, hidden } = shownPoints();
</script>

<!-- An example as the points page writes it: Ukrainian, its changing ending in bold -->
{#snippet example(text: string)}
	{#each parts(text) as part, i (i)}{#if part.mark}<b lang="uk">{part.text}</b>{:else if part.uk}<span lang="uk">{part.text}</span>{:else}{part.text}{/if}{/each}
{/snippet}

<section class="part" aria-labelledby="learn-points">
	<div class="head">
		<h2 id="learn-points">{m.learn.points.title}</h2>
		<span class="links">
			<a href="/practice">{m.learn.points.allLessons(LESSONS.length)}</a>
			<a href={POINTS_PATH}>{m.learn.points.allPoints(INTROS.length)}</a>
		</span>
	</div>

	{#if next}
		<div class="ui-card next">
			<span class="mark" aria-hidden="true"><Icon name="book" size={24} /></span>
			<div class="next-text">
				<p class="label">{m.learn.points.next}</p>
				<h3><a href={introPath(next.id)}>{lessonName(next.id)}</a></h3>
				<p class="muted">
					{ready ? m.learn.rulesKnown(next.known, next.points.length) : ''}
					{#if ready && next.placed}· {m.path.knownFromTest}{/if}
					{#if nextIntro}· <span lang="en">{nextIntro.pattern}</span> · <span class="example">{@render example(nextIntro.example)}</span>{/if}
				</p>
			</div>
			<!-- A lesson not begun opens its page first (intros.ts, lessonHref) -->
			<a class="ui-btn ui-btn-primary" href={ready ? lessonHref(next, lessons) : `/practice?lesson=${next.id}`}>
				{m.learn.practise} <Icon name="arrow-right" size={16} />
			</a>
		</div>
	{/if}

	{#each groups as group (group.id)}
		<div class="group">
			<h3 class="topic" id="learn-topic-{group.id}">{m.intro.topics[group.id]} <span>· {group.total}</span></h3>
			<ul aria-labelledby="learn-topic-{group.id}">
				{#each group.points as point (point.id)}
					<li>
						<a class="point" href={introPath(point.id)}>
							<span class="name">
								<b lang="en">{lessonName(point.id)}</b>
								<span class="pattern" lang="en">{point.pattern}</span>
							</span>
							<span class="example">{@render example(point.example)}</span>
							<span class="ui-level" data-level={point.level} title={m.intro.levels[point.level]}>{point.level}</span>
							<Icon name="chevron-right" size={18} />
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
	{#if hidden}
		<a class="rest" href={POINTS_PATH}>{m.learn.points.more(hidden)} <Icon name="arrow-right" size={16} /></a>
	{/if}
</section>

<style>
	.part {
		display: grid;
		gap: 0.6rem;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem 1rem;
	}

	h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.15;
	}

	.links {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
	}

	.links a,
	.rest {
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.rest {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		justify-self: start;
		margin-top: 0.25rem;
	}

	/* The lesson to practise next, and its button */
	.next {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.4rem;
		padding: 1rem 1.25rem;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--pill-1-line) 14%, var(--surface));
		color: var(--pill-1-line);
	}

	.next-text p,
	.next h3 {
		margin: 0;
	}

	.label {
		color: var(--accent);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.next h3 {
		font-family: var(--font-heading);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.next h3 a {
		color: var(--ink);
		text-decoration: none;
	}

	@media (hover: hover) {
		.next h3 a:hover {
			color: var(--accent);
			text-decoration: underline;
		}
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.group {
		display: grid;
		gap: 0.1rem;
	}

	.topic {
		margin: 0.6rem 0 0;
		color: var(--on-page);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.topic span {
		font-weight: 400;
	}

	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A point: one link across the row, with its name, its pattern under it,
	   the example, the level and a chevron */
	.point {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 0.25rem 1rem;
		margin-inline: -0.75rem;
		padding: 0.7rem 0.75rem;
		border-bottom: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--ink);
		text-decoration: none;
	}

	.point > :global(svg) {
		color: var(--on-page);
	}

	@media (hover: hover) {
		.point:hover {
			background: var(--accent-soft);
		}

		.point:hover b {
			color: var(--accent);
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}

		.point:hover > :global(svg) {
			color: var(--accent);
		}
	}

	.point:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.name {
		display: grid;
		gap: 0.1rem;
	}

	/* The rows stand on the page, not on a card: full ink over a background photo */
	.pattern {
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	.example {
		font-family: var(--font-reading);
		font-size: var(--text-lg);
	}

	.example b {
		color: var(--accent);
	}

	.muted .example {
		font-size: inherit;
	}

	@media (max-width: 640px) {
		.next {
			grid-template-columns: auto minmax(0, 1fr);
			padding: 0.9rem 1rem;
		}

		.next .ui-btn {
			grid-column: 1 / -1;
			justify-content: center;
		}

		/* The example goes under the name, the level and chevron stay right */
		.point {
			grid-template-columns: minmax(0, 1fr) auto auto;
		}

		.point .example {
			grid-row: 2;
			grid-column: 1;
			font-size: var(--text-md);
		}
	}
</style>
