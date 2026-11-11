<!-- The wordmark: the site's name in handwriting, Небокрай in the Ukrainian
     interface and Nebokrai in the English one. The letters are outlines
     (logo-paths.ts), so no font is loaded for them. -->
<script lang="ts">
	import { LOGO_BOX, WORDMARK } from '#lib/logo-paths.ts';

	let { script }: { script: 'uk' | 'en' } = $props();

	let mark = $derived(WORDMARK[script]);
</script>

<svg
	viewBox="0 {LOGO_BOX.top} {mark.width} {LOGO_BOX.height}"
	role="img"
	aria-label={mark.name}
	stroke-width={LOGO_BOX.stroke}
>
	<path d={mark.d} />
</svg>

<style>
	/* Each letter is outlined in its own colour, which thickens it */
	svg {
		display: block;
		width: auto;
		height: 2.3rem;
		fill: var(--logo-ink);
		stroke: var(--logo-ink);
		stroke-linejoin: round;
	}
</style>
