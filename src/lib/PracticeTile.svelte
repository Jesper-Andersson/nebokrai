<!-- A rule on the map of grammar practice (/practice): what is followed by
     the case (без), the case, what the rule says, and how well it is held.
     The whole tile is the button that starts a round of the rule alone, and
     it takes more of the flag's yellow the better the rule is held. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import type { Point } from '#lib/practice/points.ts';
	import type { PointState } from '#lib/practice/round.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		point,
		held,
		disabled = false,
		onselect
	}: {
		point: Point;
		/** How well the rule is held (stateOf in round.ts). */
		held: PointState;
		disabled?: boolean;
		onselect: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
</script>

<button type="button" class="rule" data-state={held} title={m.practice.only} {disabled} onclick={onselect}>
	<b lang="uk">{point.cue}</b>
	<!-- + locative; a number's case with its number: + nominative plural -->
	<span class="takes">
		+ {m.grammar.terms[point.case].name.toLocaleLowerCase(settings.lang)}
		{#if point.number}{m.practice.ofNumber[point.number]}{/if}
	</span>
	<span class="meaning">{m.practice.meaning[point.id]}</span>
	<span class="state">
		<!-- Three steps, filled as the rule is held: none new, one shaky, two learning, three known -->
		<span class="meter" aria-hidden="true"><i></i><i></i><i></i></span>
		{m.practice.state[held]}
	</span>
</button>

<style>
	.rule {
		--held: 0%;
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		align-content: start;
		gap: 0.15rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--flag) var(--held), var(--surface));
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.rule[data-state='new'] {
		border-style: dashed;
	}

	.rule[data-state='learning'] {
		--held: 10%;
	}

	.rule[data-state='known'] {
		--held: 24%;
	}

	.rule:disabled {
		cursor: default;
	}

	@media (hover: hover) {
		.rule:hover:not(:disabled) {
			border-color: var(--border-strong);
			background: color-mix(in srgb, var(--flag) var(--held), var(--surface-2));
		}
	}

	b {
		font-family: var(--font-headword);
		font-size: var(--text-lg);
		font-weight: 800;
	}

	.takes {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.meaning {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	/* How well a rule is held: three steps that fill as it is learnt, with the word beside them */
	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.25rem;
		color: var(--ink-2);
		font-size: var(--text-xs);
		white-space: nowrap;
	}

	.meter {
		display: inline-flex;
		gap: 2px;
	}

	.meter i {
		width: 0.7rem;
		height: 0.4rem;
		border: 1px solid var(--border-strong);
		border-radius: 2px;
	}

	.rule:is([data-state='weak'], [data-state='learning'], [data-state='known']) .meter i:first-child,
	.rule:is([data-state='learning'], [data-state='known']) .meter i:nth-child(2),
	.rule[data-state='known'] .meter i:nth-child(3) {
		border-color: var(--flag-line);
		background: var(--flag);
	}
</style>
