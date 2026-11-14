<!-- Other places to learn Ukrainian, in one group per kind, each entry with its
     own icon, the levels it suits and a price pill. The list itself is in
     src/lib/resources.ts. The server renders all of it, so it reads whole
     without JavaScript; only the price filter and the sort need it. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import {
		LEVELS, ORDERS, PRICES, RESOURCES, byKind, byLevel, byPrice, lastChecked, levelSpan,
		type Order, type Price
	} from '#lib/resources.ts';
	import { useSettings } from '#lib/settings.ts';

	// Every icon, keyed by its path under src/lib/assets/ ('resources/anki.png'),
	// so Vite fingerprints them and they are served from this site.
	const icons = import.meta.glob<string>(['../../lib/assets/resources/*.png', '../../lib/assets/logo-icon.svg'], {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const icon = (logo: string) => icons[`../../lib/assets/${logo}`];

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let r = $derived(m.resources);
	let uk = $derived(settings.lang === 'uk');

	let price = $state<Price>('any');
	let order = $state<Order>('easiest');
	let shown = $derived(byLevel(byPrice(RESOURCES, price), order));
	let groups = $derived(byKind(shown));

	// UTC, so the server and the browser print the same day
	let reviewed = $derived(
		new Intl.DateTimeFormat(uk ? 'uk' : 'en-GB', {
			day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
		}).format(new Date(lastChecked(RESOURCES)))
	);
</script>

<TextPage title={m.pageTitle.resources} description={m.meta.resources} wide>
	<p class="muted">{r.intro}</p>

	<div class="controls">
		<div class="control">
			<span class="label" id="resources-price">{r.priceLabel}</span>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-labelledby="resources-price"
				value={price}
				onValueChange={(value) => (price = value as Price)}
			>
				{#each PRICES as p (p)}
					<RadioGroup.Item class="ui-segment" value={p}>{r.prices[p]}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
		</div>
		<div class="control">
			<span class="label" id="resources-order">{r.orderLabel}</span>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-labelledby="resources-order"
				value={order}
				onValueChange={(value) => (order = value as Order)}
			>
				{#each ORDERS as o (o)}
					<RadioGroup.Item class="ui-segment" value={o}>{r.orders[o]}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
		</div>
	</div>

	{#each groups as group (group.kind)}
		<section aria-labelledby="kind-{group.kind}">
			<h2 class="group" id="kind-{group.kind}">
				{r.kinds[group.kind]} <span class="n">{group.items.length}</span>
			</h2>
			<ul>
				{#each group.items as item (item.url)}
					<li>
						<img class="logo" src={icon(item.logo)} alt="" width="28" height="28" loading="lazy" />
						<div class="body">
							<div class="top">
								<a href={item.url} rel="noopener">{item.name}</a>
								<span class="tags">
									{#if item.explainedIn === 'uk'}
										<span class="ui-badge" title={r.ukOnlyHint}>
											<span aria-hidden="true">{r.ukOnly}</span>
											<span class="ui-sr-only">{r.ukOnlyHint}</span>
										</span>
									{/if}
									<!-- Green for what is free, gold for what is paid; free + paid shows both halves -->
									<span class="price">
										<span class="ui-sr-only">{r.cost[item.cost]}</span>
										{#if item.cost !== 'paid'}<span class="free" aria-hidden="true">{r.pill.free}</span>{/if}
										{#if item.cost === 'paid'}<span class="paid" aria-hidden="true">{r.pill.paid}</span>{/if}
										{#if item.cost === 'freemium'}<span class="paid" aria-hidden="true">{r.pill.plusPaid}</span>{/if}
									</span>
								</span>
							</div>
							<p>{uk ? item.uk : item.en}</p>
							<p class="level">
								<!-- One bar each for beginner, intermediate and advanced, filled where it suits -->
								<span class="bars" aria-hidden="true">
									{#each LEVELS as level (level)}
										<i class:on={item.levels.includes(level)}></i>
									{/each}
								</span>
								{r.levels[levelSpan(item.levels)]}
							</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	<p class="foot muted">
		<span aria-live="polite">{r.count(shown.length, RESOURCES.length)}</span>
		<span>{r.reviewed(reviewed)}</span>
	</p>

	<h2>{r.howTitle}</h2>
	<p>{r.how}</p>
	<p>{r.suggestLead} <a href="/report?kind=resource">{r.suggest}</a></p>
</TextPage>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.25rem;
		margin: 1rem 0 1.25rem;
	}

	.control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.label {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	/* The shared segmented control fills its row; here it is only as wide as its choices */
	.control :global(.ui-segmented) {
		display: inline-flex;
	}

	/* A group's heading: small and ruled, so the list reads as one page and not as six */
	h2.group {
		margin: 1.25rem 0 0.75rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--border-strong);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	.n {
		margin-left: 0.2rem;
		color: var(--muted);
		font-weight: 400;
	}

	ul {
		display: grid;
		gap: 1.1rem 1.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 40rem) {
		ul {
			grid-template-columns: 1fr 1fr;
		}
	}

	li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.logo {
		flex: none;
		box-sizing: border-box;
		width: 28px;
		height: 28px;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--logo-tile);
		object-fit: contain;
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.body p {
		margin: 0.15rem 0 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	/* The name on the left and its tags on the right; in a narrow column the
	   tags drop under the name instead of squeezing it */
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.2rem 0.6rem;
	}

	.top a {
		font-weight: 700;
	}

	.tags {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	/* Each half is rounded at its outer end, so a pill of one half is round at both */
	.price {
		display: inline-flex;
		font-size: var(--text-xs);
		font-weight: 700;
		line-height: 1.5;
		white-space: nowrap;
	}

	.price > span:not(.ui-sr-only) {
		padding: 0 0.55rem;
		border-radius: var(--radius-pill);
	}

	.free + .paid {
		padding-left: 0.35rem;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.free:has(+ .paid) {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.free {
		background: var(--free);
		color: var(--free-ink);
	}

	.paid {
		background: var(--paid);
		color: var(--paid-ink);
	}

	.body p.level {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.3rem;
		font-size: var(--text-xs);
	}

	.bars {
		display: inline-flex;
		gap: 3px;
	}

	.bars i {
		width: 1.4rem;
		height: 6px;
		border-radius: 2px;
		background: var(--border);
	}

	.bars i.on {
		background: var(--accent);
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.2rem 1rem;
		margin-top: 1.5rem;
		font-size: var(--text-sm);
	}
</style>
