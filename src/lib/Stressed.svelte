<!-- A word with its stressed vowel (letter + U+0301) in the stress colour: кни́га -->
<script lang="ts">
	let { text }: { text: string } = $props();
</script>

{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span>{part}</span>{:else}{part}{/if}{/each}

<style>
	span {
		color: var(--stress);
	}
</style>
