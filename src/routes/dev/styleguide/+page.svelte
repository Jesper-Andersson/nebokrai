<!-- /dev/styleguide: every token, shared class and main component on one
     page, in `npm run dev` only. The page itself is src/lib/dev/StyleGuide.svelte,
     asked for the way the layout asks for the text editor: Vite writes `false`
     in the place of import.meta.env.DEV when it builds the site and then
     leaves the file out. +page.server.ts answers 404 there. -->
<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let StyleGuide = $state.raw<Component<PageProps['data']> | null>(null);
	if (import.meta.env.DEV) {
		onMount(() => void import('#lib/dev/StyleGuide.svelte').then((module) => (StyleGuide = module.default)));
	}
</script>

{#if StyleGuide}<StyleGuide {...data} />{/if}
