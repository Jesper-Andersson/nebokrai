<!-- The current About page, unchanged, inside the draft's frame. -->
<script lang="ts">
	import About from '../../about/+page.svelte';
	import type { PageProps } from '../../about/$types';

	let props: PageProps = $props();
</script>

<div class="d-legacy"><About {...props} /></div>
