<!-- The levelled path at the top of /learn (src/lib/path.ts), as the user
     picked it in Figma on 2026-11-17 ("Card A"): the stage being worked
     towards in the heading serif, how many of its steps are done, one button
     for the next step, and the six stages as a bar. "All stages" opens the
     list under it: each stage with what it asks for, the current one on a
     soft panel, a ✓ for a step done and a link for one still open. At the
     foot, the placement test, to take or take again.

     While the letters are the step, a learner who reads Cyrillic already can
     say so under the button, as on the newcomer's first card: a learner who
     has reviewed a word no longer sees that card, and was held at stage 1.

     A stage once reached stays reached. That is kept in this browser, and
     only once the coverage table is here: before it, a stage that asks for
     coverage would look met for a moment and be kept as reached. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import StageBar from '#lib/learn/StageBar.svelte';
	import { goText, openText, stepText } from '#lib/learn/path-text.ts';
	import { STAGE_IDS, learnerInput, pathOf, reachedStages, workingStage, type PathInput } from '#lib/path.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		now,
		ready,
		offered,
		letters,
		onskipletters,
		onhide
	}: {
		now: number;
		ready: boolean;
		/** The grammar rules that have sentences. */
		offered: readonly string[];
		letters: PathInput['letters'];
		/** The learner reads the letters already (Alphabet.skip). */
		onskipletters?: () => void;
		/** Puts the path away: on /learn it is shown only to a learner who asked for it (2026-11-18). */
		onhide?: () => void;
	} = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	const REACHED_KEY = 'path-reached';

	function readReached(): string[] {
		try {
			const value: unknown = JSON.parse(localStorage.getItem(REACHED_KEY) ?? '[]');
			return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
		} catch {
			return []; // storage blocked, or not JSON
		}
	}

	/** The stages this browser has kept as reached. */
	let kept = $state<string[]>([]);
	let open = $state(false);

	onMount(() => {
		kept = readReached();
		// The coverage criteria need the table, a word card or not
		review.fetchFrequency();
	});

	let input = $derived(learnerInput({
		cards: review.cards, common: review.common, frequency: review.frequency, letters, start: review.start,
		offered, placed: review.placedLessons, now
	}));
	let path = $derived(pathOf(input, kept));
	let working = $derived(workingStage(path));
	let reachedCount = $derived(path.stages.filter((stage) => stage.reached).length);
	let allReached = $derived(reachedCount === path.stages.length);
	let stepsDone = $derived(working.criteria.filter((c) => c.done).length);

	/** What to keep: the stages reached now, once every criterion can be judged. */
	let toKeep = $derived(ready && review.frequency ? reachedStages(path, kept) : kept);
	$effect(() => {
		if (toKeep.length === kept.length) return;
		try {
			localStorage.setItem(REACHED_KEY, JSON.stringify(toKeep));
		} catch {
			// Storage blocked: reached again from the cards next time
		}
	});

	let step = $derived(path.next?.criterion ?? null);
	let hasPlacement = $derived((review.progress.placement?.results.length ?? 0) > 0);
	let barLabel = $derived(
		allReached ? m.path.allReached(STAGE_IDS.length) : m.path.progress(working.n, STAGE_IDS.length, stepsDone, working.criteria.length));
</script>

<section class="part" aria-labelledby="learn-path">
	<div class="head">
		<h2 id="learn-path">{m.path.title}</h2>
		<span class="links">
			<button type="button" class="more" aria-expanded={open} aria-controls="learn-stages" onclick={() => (open = !open)}>
				{open ? m.path.hideStages : m.path.allStages}
				<Icon name={open ? 'x' : 'arrow-right'} size={16} />
			</button>
			{#if onhide}<button type="button" class="more" onclick={onhide}>{m.learn.plan.hide}</button>{/if}
		</span>
	</div>
	<div class="ui-card card" aria-busy={!ready}>
		<div class="name">
			<p class="stage">{m.path.stage[working.id]}</p>
			<p class="muted">{ready ? barLabel : '–'}</p>
		</div>
		<div class="go">
			{#if ready && step}
				<a class="ui-btn ui-btn-primary" href={step.href}>{goText(m, step, input.lessons)} <Icon name="arrow-right" size={16} /></a>
				{#if step.kind === 'letters' && onskipletters}
					<button type="button" class="skip" onclick={onskipletters}>{m.learn.first.letters.skip}</button>
				{/if}
			{:else if ready}
				<a class="ui-btn ui-btn-primary" href="/review">{m.path.keepGoing} <Icon name="arrow-right" size={16} /></a>
			{/if}
		</div>
		<div class="bar"><StageBar reached={ready ? reachedCount : 0} stages={STAGE_IDS.length} label={barLabel} /></div>
	</div>

	{#if open}
		<div class="ui-card list" id="learn-stages">
			<ol class="stages">
				{#each path.stages as stage (stage.id)}
					{@const current = !allReached && stage.id === working.id}
					{@const following = !allReached && stage.n === working.n + 1}
					<li class={['st', { cur: current }]}>
						<h3>
							{m.path.stage[stage.id]}
							<small>{stage.reached ? m.path.done : current ? m.path.now : following ? m.path.next : ''}</small>
						</h3>
						{#if current}
							<ul class="steps">
								{#each stage.criteria as criterion (criterion.kind + criterion.key)}
									<li>
										{#if criterion.done}
											<span class="tick" aria-hidden="true">✓</span>
											<span>{stepText(m, criterion)}<span class="ui-sr-only"> ({m.path.done})</span></span>
										{:else}
											<span class="open" aria-hidden="true">–</span>
											<a href={criterion.href}>{openText(m, criterion, input.lessons)}</a>
										{/if}
									</li>
								{/each}
							</ul>
						{:else if following}
							<ul class="steps muted">
								{#each stage.criteria as criterion (criterion.kind + criterion.key)}
									<li>{stepText(m, criterion)}</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
		<a class="retake" href="/placement">{hasPlacement ? m.path.retakeTest : m.path.takeTest}</a>
	{/if}
</section>

<style>
	.part {
		display: grid;
		gap: 0.6rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	/* As VocabularyCard's heading */
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
		justify-content: flex-end;
		gap: 0.4rem 1.1rem;
	}

	.more {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	/* The stage and its count, the button beside them, and the bar across */
	.card {
		display: grid;
		grid-template-areas: 'name go' 'bar bar';
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem 1.25rem;
		padding: 0.9rem 1rem;
	}

	.name {
		grid-area: name;
	}

	/* The button, and under it the letters' skip when they are the step */
	.go {
		display: grid;
		grid-area: go;
		justify-items: center;
		gap: 0.4rem;
	}

	/* As the skip on the newcomer's first card (routes/learn/+page.svelte) */
	.skip {
		padding: 0.1rem 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	@media (hover: hover) {
		.skip:hover {
			color: var(--ink);
		}
	}

	.bar {
		grid-area: bar;
	}

	.name p {
		margin: 0;
	}

	.stage {
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: var(--headword-md);
		line-height: 1.15;
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* The list of stages, under the card */
	.list {
		padding: 0.4rem 1rem;
	}

	.stages {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.st {
		display: grid;
		gap: var(--gap-inline);
		padding-block: 0.9rem;
		border-top: 1px solid var(--border);
	}

	.st:first-child {
		border-top: 0;
	}

	/* The stage being worked towards, on a soft panel reaching the card's edges */
	.st.cur {
		margin-inline: -0.6rem;
		padding-inline: 0.6rem;
		border-top-color: transparent;
		border-radius: var(--radius-md);
		background: var(--accent-soft);
	}

	.st.cur + .st {
		border-top-color: transparent;
	}

	h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin: 0;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: var(--text-xl);
		font-weight: 400;
	}

	h3 small {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	.steps {
		display: grid;
		gap: var(--gap-tight);
		margin: 0;
		padding: 0;
		font-size: var(--text-sm);
		list-style: none;
	}

	.steps li {
		display: flex;
		gap: var(--gap-inline);
	}

	.tick,
	.open {
		flex: none;
		width: 1rem;
	}

	.tick {
		color: var(--right);
		font-weight: 700;
	}

	.open {
		color: var(--muted);
	}

	.steps a,
	.retake {
		color: var(--accent);
	}

	.retake {
		justify-self: start;
		font-size: var(--text-sm);
	}

	/* On a phone the button goes under the bar, the width of the card */
	@media (max-width: 640px) {
		.card {
			grid-template-areas: 'name' 'bar' 'go';
			grid-template-columns: minmax(0, 1fr);
		}

		.go :global(.ui-btn) {
			box-sizing: border-box;
			justify-content: center;
			width: 100%;
		}
	}
</style>
