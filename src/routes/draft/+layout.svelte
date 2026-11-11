<!-- The frame of the draft redesign: every page under /draft is drawn inside
     it, and the root layout steps aside for these pages (see its `draft`).
     Settings and saved words still come from the root layout's context. -->
<script lang="ts">
	import '#lib/draft/draft.css';
	import { Tooltip } from 'bits-ui';
	import Header from '#lib/draft/Header.svelte';
	import { DRAFT } from '#lib/draft/paths.ts';
	import Toasts from '#lib/draft/Toasts.svelte';
	import { provideToasts } from '#lib/draft/toasts.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	provideToasts();
</script>

<Tooltip.Provider delayDuration={350}>
	<div class="draft-root">
		<Header />

		<main>
			{@render children()}
		</main>

		<footer>
			<div class="inner">
				<p>
					© 2026 Jesper Andersson · {m.footer.data} ·
					<a href="{DRAFT}/sources">{m.footer.sources}</a>
				</p>
				<a href="{DRAFT}/report">{m.footer.report}</a>
			</div>
		</footer>
	</div>

	<Toasts />
</Tooltip.Provider>

<style>
	.draft-root {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 100dvh;
	}

	main {
		flex: 1;
		padding-bottom: 3rem;
	}

	footer {
		border-top: 1px solid var(--d-border);
		color: var(--d-muted);
		font-size: 0.85rem;
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem 1.5rem;
		box-sizing: border-box;
		max-width: 72rem;
		margin: 0 auto;
		padding: 0.9rem 1rem;
	}

	p {
		margin: 0;
	}

	/* Padding for a taller tap area */
	a {
		padding-block: 0.4rem;
		color: var(--d-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--d-border-strong);
		text-underline-offset: 3px;
	}

	a:hover {
		color: var(--d-ink);
	}
</style>
