<!-- How common a word is: four bars, one more lit for each step from rare to
     very common, and the word's rank (#227). A search card has room for no
     more; the word's own page asks for the step in words as well (`showTier`). -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { commonality, type Commonality } from '#lib/labels.ts';
	import { useSettings } from '#lib/settings.ts';

	let { rank, showTier = false }: { rank: number | null; showTier?: boolean } = $props();

	const LIT: Record<Commonality, number> = { 'very-common': 4, common: 3, uncommon: 2, rare: 1 };
	// Each bar is 3 wide and 3 taller than the one before it, on a 16 x 14 grid.
	const BARS = [0, 1, 2, 3].map((i) => ({ x: i * 4.33, height: 5 + i * 3 }));

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let tier = $derived(commonality(rank));
	let shown = $derived(rank?.toLocaleString(settings.lang === 'uk' ? 'uk' : 'en'));
	// The bars are a picture; this says what they say, to a pointer and a screen reader.
	let label = $derived(`${m.tiers[tier]}. ${shown ? m.word.rankTitle(shown) : m.word.unranked}`);
</script>

<!-- The rank first and the bars last: at the right edge of a card the bars of
     a list of results then stand in one column, with the ranks ending at it. -->
<span class="freq {tier}" role="img" aria-label={label} title={label}>
	{#if showTier}<span class="tier">{m.tiers[tier]}</span>{/if}
	{#if shown}<span>#{shown}</span>{/if}
	<svg viewBox="0 0 16 14" width="16" height="14" aria-hidden="true">
		{#each BARS as bar, i (i)}
			<rect class:lit={i < LIT[tier]} x={bar.x} y={14 - bar.height} width="3" height={bar.height} rx="1" />
		{/each}
	</svg>
</span>

<style>
	.freq {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		white-space: nowrap;
	}

	.tier {
		color: var(--ink-2);
	}

	svg {
		flex: none;
	}

	rect {
		fill: var(--border-strong);
	}

	rect.lit {
		fill: var(--tier);
	}

	.very-common {
		--tier: var(--pill-1-line);
	}

	.common {
		--tier: var(--pill-2-line);
	}

	.uncommon {
		--tier: var(--pill-3-line);
	}

	.rare {
		--tier: var(--pill-4-line);
	}
</style>
