<script lang="ts">
	import WordCard from '#lib/WordCard.svelte';
	import { entries } from '#lib';

	let query = $state('');

	// Ignore stress marks and case so "kalyna", "калина" and "Viburnum" all match
	const normalize = (text: string) => text.replace(/́/g, '').toLowerCase();

	let results = $derived.by(() => {
		const q = normalize(query.trim());
		if (!q) return entries;
		return entries.filter((entry) =>
			[entry.word, entry.latin, ...entry.translations].some((text) => normalize(text).includes(q))
		);
	});
</script>

<h1><span class="accent">Ukrainian</span> ↔ English Dictionary</h1>

<div class="search">
	<input bind:value={query} placeholder="Search a word…" aria-label="Search a word" />
	{#if query}
		<button class="clear" aria-label="Clear search" onclick={() => (query = '')}>×</button>
	{/if}
</div>

<ul class="results">
	{#each results as entry (entry.word)}
		<li><WordCard {entry} /></li>
	{:else}
		<li class="empty">No matches for “{query}”.</li>
	{/each}
</ul>

<style>
	h1 {
		margin: 0.6em 0 0.4em;
		color: white;
		font-family: 'Nunito', sans-serif;
		font-size: clamp(1.6rem, 4vw, 2.1rem);
		font-weight: 800;
		letter-spacing: 0.02em;
		filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
	}

	.accent {
		background: linear-gradient(#f5e2a8, #c9a54a);
		background-clip: text;
		color: transparent;
	}

	.search {
		position: relative;
		max-width: 32rem;
		margin: 0 auto 0.4rem;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.7rem 3rem 0.7rem 1rem;
		border: 1.5px solid #222;
		border-radius: 999px;
		outline: none;
		background: white;
		font-family: 'Nunito', sans-serif;
		font-size: 1.05rem;
	}

	input:focus-visible {
		box-shadow: 0 0 0 3px #5b8fd6;
	}

	.clear {
		position: absolute;
		top: 50%;
		right: 0.8rem;
		translate: 0 -50%;
		padding: 0 0.3rem;
		border: 0;
		background: none;
		font-size: 1.6rem;
		line-height: 1;
		cursor: pointer;
	}

	.results {
		display: grid;
		gap: 6px;
		max-width: 48rem;
		margin: 0 auto 2rem;
		padding: 0;
		list-style: none;
	}

	.empty {
		color: white;
		font-family: 'Nunito', sans-serif;
	}
</style>
