<!-- The current report form, unchanged, inside the draft's frame. -->
<script lang="ts">
	import Report from '../../report/+page.svelte';
	import type { PageProps } from '../../report/$types';

	let props: PageProps = $props();
</script>

<div class="d-legacy"><Report {...props} /></div>
