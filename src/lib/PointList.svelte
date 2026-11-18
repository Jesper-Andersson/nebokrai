<!-- Every grammar point, beside a point's page, as the user picked it in
     Figma on 2026-11-18 ("L2, sorted by level"): the topics as on the index,
     each point with its CEFR level, the easiest first within a topic, and
     chips that show one level only. The page being read is marked.

       Grammar points
       [All] [A1] [A2] [B1]
       Verbs and their cases
         Verbs with на + accusative   A2
         …
       All grammar points →

     `side` sits beside the sheet on a wide window; `panel` folds under the
     page where there is no room beside it. The page draws both and its CSS
     shows one (routes/grammar/[lesson]/+page.svelte). -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { LEVELS, POINTS_PATH, TOPICS, introOf, introPath, type Intro, type Level } from '#lib/practice/intros.ts';
	import { useSettings } from '#lib/settings.ts';

	let { current, variant }: { current?: string; variant: 'side' | 'panel' } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	/** The level shown, or every level. */
	let only = $state<Level | null>(null);

	const topics = TOPICS.map((topic) => ({
		id: topic.id,
		points: topic.points.map(introOf).filter((intro): intro is Intro => intro !== undefined)
	}));
	let shown = $derived(
		topics
			.map((topic) => ({ ...topic, points: topic.points.filter((point) => !only || point.level === only) }))
			.filter((topic) => topic.points.length));
	const count = topics.reduce((sum, topic) => sum + topic.points.length, 0);
</script>

{#snippet list()}
	<div class="chips" role="group" aria-label={m.intro.showLevel}>
		<button type="button" class="chip" aria-pressed={only === null} onclick={() => (only = null)}>{m.intro.allLevels}</button>
		{#each LEVELS as level (level)}
			<button type="button" class="chip" aria-pressed={only === level} title={m.intro.levels[level]} onclick={() => (only = level)}>{level}</button>
		{/each}
	</div>
	{#each shown as topic (topic.id)}
		<p class="topic">{m.intro.topics[topic.id]}</p>
		<ul>
			{#each topic.points as point (point.id)}
				<li>
					<a href={introPath(point.id)} class={{ here: point.id === current }} aria-current={point.id === current ? 'page' : undefined} lang="en">
						<span>{point.title}</span>
						<span class="ui-level" data-level={point.level} title={m.intro.levels[point.level]}>{point.level}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/each}
	<a class="all" href={POINTS_PATH}>{m.intro.allPoints} <Icon name="arrow-right" size={14} /></a>
{/snippet}

{#if variant === 'side'}
	<nav class="ui-card side" aria-label={m.intro.allPoints}>
		<p class="title">{m.intro.points}</p>
		{@render list()}
	</nav>
{:else}
	<details class="ui-card panel">
		<summary>{m.intro.allPoints} <span class="count">{count}</span></summary>
		<nav aria-label={m.intro.allPoints}>{@render list()}</nav>
	</details>
{/if}

<style>
	.side,
	.panel {
		box-sizing: border-box;
		padding: 0.9rem;
		font-size: var(--text-sm);
	}

	.title,
	summary {
		margin: 0 0 0.5rem;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: var(--text-md);
		font-weight: 700;
	}

	summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin: 0;
		cursor: pointer;
	}

	.panel[open] summary {
		margin-bottom: 0.6rem;
	}

	.count {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.4rem;
	}

	.chip {
		padding: 0.1rem 0.6rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-xs);
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--bg);
	}

	.topic {
		margin: 0.8rem 0 0.2rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	ul {
		display: grid;
		gap: 1px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li a {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		color: var(--ink-2);
		line-height: 1.3;
		text-decoration: none;
	}

	@media (hover: hover) {
		li a:hover {
			background: var(--surface-2);
			color: var(--ink);
		}
	}

	li a.here {
		background: var(--accent-soft);
		color: var(--ink);
		font-weight: 700;
	}

	.all {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.8rem;
		color: var(--accent);
	}
</style>
