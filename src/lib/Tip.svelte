<!-- A tooltip for an icon button (Bits UI Tooltip). The caller draws the button
     and spreads `props` on it:

       <Tip label="Play">
         {#snippet trigger(props)}<button {...props}>…</button>{/snippet}
       </Tip>

     To add handlers of your own, join them with mergeProps from bits-ui, or the
     tooltip's handlers are lost. -->
<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let { label, trigger }: { label: string; trigger: Snippet<[Record<string, unknown>]> } = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content class="ui-tooltip" sideOffset={6}>{label}</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
