<!-- The levelled path as six parts in a row (src/lib/path.ts): the stages
     reached filled in the accent, the one being worked towards outlined in
     it, the rest plain. The path card on /learn and the placement test's
     result draw the same bar, as the user picked in Figma ("Card A result B",
     2026-11-17). -->
<script lang="ts">
	let {
		reached,
		stages,
		label
	}: {
		/** How many stages are reached, from the first. */
		reached: number;
		/** How many there are. */
		stages: number;
		/** What the bar says, for those who cannot see it. */
		label: string;
	} = $props();
</script>

<span class="bar" role="img" aria-label={label}>
	{#each { length: stages }, i (i)}
		<i class={{ done: i < reached, now: i === reached }}></i>
	{/each}
</span>

<style>
	.bar {
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		gap: var(--gap-tight);
	}

	i {
		display: block;
		height: 0.4rem;
		border-radius: var(--radius-pill);
		background: var(--border);
	}

	.done {
		background: var(--accent);
	}

	.now {
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
</style>
