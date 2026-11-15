<!-- The button on /about that opens the ways to help with the costs. The ways,
     and why none of them may buy anything, are in src/lib/donate.ts. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import { WAYS } from '#lib/donate.ts';
	import Icon from './Icon.svelte';

	let { lang }: { lang: 'en' | 'uk' } = $props();

	let uk = $derived(lang === 'uk');
	// A way whose account does not exist yet is shown only in development. Vite
	// puts `false` in the place of import.meta.env.DEV in a build, so those
	// entries never reach visitors.
	const ways = WAYS.filter((way) => way.ready || import.meta.env.DEV);
</script>

<Popover.Root>
	<Popover.Trigger class="ui-btn">
		{uk ? 'Допомогти з витратами' : 'Help with the costs'}
		<Icon name="chevron-down" size={16} />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="ui-popover ui-donate" align="start" sideOffset={6} collisionPadding={8}>
			<ul>
				{#each ways as way (way.name)}
					<li>
						<a href={way.url} rel="noopener">
							<!-- The name stands beside it, so the icon says nothing more to a screen reader -->
							{#if way.mono}
								<span class="icon mono" style:--src="url(/donate/{way.icon})" aria-hidden="true"
								></span>
							{:else}
								<img class="icon" src="/donate/{way.icon}" alt="" width="32" height="32" />
							{/if}
							<span class="text">
								<b>{way.name}</b>
								<span class="line">{uk ? way.uk : way.en}</span>
								{#if !way.ready}<span class="line todo">Not set up yet (shown in dev only)</span>{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	/* The menu is portalled to the end of <body>, past this component's scoped
	   styles, so its rules are :global under its own class */
	:global(.ui-popover.ui-donate) {
		width: min(20rem, calc(100vw - 16px));
		padding: 0.35rem;
	}

	:global(.ui-donate ul) {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	:global(.ui-donate a) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.7rem;
		border-radius: var(--radius-md);
		color: var(--ink);
		text-decoration: none;
	}

	:global(.ui-donate a:hover),
	:global(.ui-donate a:focus-visible) {
		background: var(--surface-2);
	}

	:global(.ui-donate .icon) {
		flex: none;
		width: 1.6rem;
		height: 1.6rem;
	}

	/* A one-colour mark takes the text colour, so it shows in every theme */
	:global(.ui-donate .icon.mono) {
		background: var(--ink);
		mask: var(--src) center / contain no-repeat;
	}

	:global(.ui-donate .text) {
		display: flex;
		flex-direction: column;
	}

	:global(.ui-donate .line) {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	:global(.ui-donate .todo) {
		color: var(--stress);
	}
</style>
