<!-- A word with its stressed vowel (letter + U+0301) in the stress colour: кни́га -->
<script lang="ts">
	// `moved` underlines the stressed letter as well: in this form the stress is
	// not where the dictionary form has it (рука́ → ру́ки). An underline, because
	// the colour marks every stress and would not reach everyone anyway.
	let { text, moved = false }: { text: string; moved?: boolean } = $props();
</script>

{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span class:moved>{part}</span>{:else}{part}{/if}{/each}

<style>
	span {
		color: var(--stress);
	}

	.moved {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
	}
</style>
