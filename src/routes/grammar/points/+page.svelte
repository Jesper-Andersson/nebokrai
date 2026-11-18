<!-- /grammar/points: every grammar point, for someone who reads them as a
     reference and not along the path, as the user picked it in Figma on
     2026-11-18 ("A", after AllSet's list of A1 grammar points): a table to
     a group, each point by its name, its pattern in a line and an example.

       Grammar points
       Jump to: Verbs · Verbs and their cases · Prepositions · …
       Verbs
       ┌ Point ─────────────── Pattern ──────────── Example ────┐
       │ The present tense     stem + -ю, -єш / -иш  я читаю    │
       └────────────────────────────────────────────────────────┘

     The groups are TOPICS in practice/intros.ts. A pattern is English, as
     the points' pages are; on a phone it goes under the point's name. -->
<script lang="ts">
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { LEVELS, LEVEL_SOURCE, TOPICS, introOf, introPath, parts, prepositionIndex, type Intro, type Level } from '#lib/practice/intros.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const topics = TOPICS.map((topic) => ({
		id: topic.id,
		points: topic.points.map(introOf).filter((intro): intro is Intro => intro !== undefined)
	}));

	/** The level shown, or every level; a group with no point at it is left out. */
	let only = $state<Level | null>(null);
	let shown = $derived(
		topics
			.map((topic) => ({ ...topic, points: topic.points.filter((point) => !only || point.level === only) }))
			.filter((topic) => topic.points.length));

	/** The prepositions, each leading to the point that teaches it, or a choice of two (user's pick, 2026-11-18). */
	const words = prepositionIndex();
</script>

<TextPage title={m.intro.points} description={m.meta.grammarPoints}>
	<p class="lead">{m.intro.pointsAbout}</p>
	<p class="jump">
		{m.intro.jumpTo}
		{#each shown as topic (topic.id)}<a href="#{topic.id}">{m.intro.topics[topic.id]}</a>{/each}
	</p>
	<!-- By word: learners come with у or до, not with a case's name -->
	<div class="words">
		<span class="label">{m.intro.byWord}</span>
		{#each words as entry (entry.word)}
			{#if entry.lessons.length === 1}
				<a class="word" href={introPath(entry.lessons[0])} lang="uk" title={introOf(entry.lessons[0])?.title}>{entry.word}</a>
			{:else}
				<details class="word-choice">
					<summary class="word" lang="uk">{entry.word}</summary>
					<span class="menu">
						{#each entry.lessons as lesson (lesson)}<a href={introPath(lesson)} lang="en">{introOf(lesson)?.title}</a>{/each}
					</span>
				</details>
			{/if}
		{/each}
	</div>
	<div class="chips" role="group" aria-label={m.intro.showLevel}>
		<button type="button" class="chip" aria-pressed={only === null} onclick={() => (only = null)}>{m.intro.allLevels}</button>
		{#each LEVELS as level (level)}
			<button type="button" class="chip" aria-pressed={only === level} onclick={() => (only = level)}>
				{level} <span class="name">{m.intro.levels[level]}</span>
			</button>
		{/each}
		<a class="from" href={LEVEL_SOURCE.url} target="_blank" rel="noopener">{m.intro.levelFrom}</a>
	</div>

	{#each shown as topic (topic.id)}
		<h2 id={topic.id}>{m.intro.topics[topic.id]}</h2>
		{#if m.intro.topicAbout[topic.id]}<p class="about">{m.intro.topicAbout[topic.id]}</p>{/if}
		<div class="wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">{m.intro.point}</th>
						<th scope="col" class="lv">{m.intro.level}</th>
						<th scope="col" class="pattern">{m.intro.pattern}</th>
						<th scope="col">{m.intro.example}</th>
					</tr>
				</thead>
				<tbody>
					{#each topic.points as point (point.id)}
						<tr>
							<th scope="row">
								<a href={introPath(point.id)} lang="en">{point.title}</a>
								<span class="under" lang="en">{point.pattern}</span>
							</th>
							<td><span class="ui-level" data-level={point.level} title={m.intro.levels[point.level]}>{point.level}</span></td>
							<td class="pattern" lang="en">{point.pattern}</td>
							<td class="example">{#each parts(point.example) as part, i (i)}{#if part.mark}<b lang="uk">{part.text}</b>{:else if part.uk}<span lang="uk">{part.text}</span>{:else}{part.text}{/if}{/each}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
</TextPage>

<style>
	.jump {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.9rem;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	.about {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* The table on a frame of its own, as picked: it is the page's content,
	   not a table among text */
	.wrap {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	/* Fixed columns, so the five tables line up under each other */
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-family: var(--font-text);
	}

	thead th:first-child {
		width: 31%;
	}

	thead th.lv {
		width: 3.25rem;
	}

	thead th.pattern {
		width: 27%;
	}

	/* The words, as small chips in the reading face, before the level chips */
	.words {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.75rem;
		font-family: var(--font-text);
	}

	.words .label {
		margin-right: 0.2rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.word {
		padding: 0.05rem 0.65rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--accent);
		font-family: var(--font-reading);
		text-decoration: none;
		cursor: pointer;
	}

	.word-choice {
		position: relative;
	}

	.word-choice summary {
		list-style: none;
	}

	.word-choice summary::-webkit-details-marker {
		display: none;
	}

	.word-choice[open] summary {
		border-color: var(--accent);
	}

	/* A word taught in two points: its two pages, under it */
	.menu {
		position: absolute;
		z-index: 5;
		top: calc(100% + 0.3rem);
		left: 0;
		display: grid;
		gap: 0.2rem;
		width: max-content;
		max-width: 18rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: var(--shadow);
		font-size: var(--text-sm);
	}

	.menu a {
		color: var(--accent);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.75rem;
		font-family: var(--font-text);
	}

	.chip {
		padding: 0.15rem 0.7rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}

	.chip .name {
		color: var(--muted);
		font-weight: 400;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--bg);
	}

	.chip[aria-pressed='true'] .name {
		color: inherit;
	}

	.chips .from {
		margin-left: auto;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	thead th {
		padding: 0.5rem 0.75rem;
		background: var(--surface-2);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		text-align: left;
	}

	tbody th,
	td {
		padding: 0.55rem 0.75rem;
		border-top: 1px solid var(--border);
		text-align: left;
		vertical-align: baseline;
	}

	tbody th {
		font-weight: 600;
	}

	tbody th a {
		color: var(--accent);
		text-decoration: none;
	}

	@media (hover: hover) {
		tbody th a:hover {
			text-decoration: underline;
		}
	}

	td.pattern {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.example {
		font-family: var(--font-reading);
	}

	.example b {
		color: var(--accent);
	}

	/* The pattern under the name, shown only where its column is not */
	.under {
		display: none;
	}

	@media (max-width: 600px) {
		.pattern {
			display: none;
		}

		.under {
			display: block;
			margin-top: 0.15rem;
			color: var(--muted);
			font-size: var(--text-sm);
			font-weight: 400;
		}

		thead th:first-child {
			width: 55%;
		}

		.chip .name {
			display: none;
		}
	}
</style>
