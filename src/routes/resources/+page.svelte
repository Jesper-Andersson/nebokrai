<!-- Other places to learn Ukrainian, as one list to narrow by kind or by a
     word. The list itself is in src/lib/resources.ts. The server renders all
     of it, so it reads whole without JavaScript; only the two controls need it. -->
<script lang="ts">
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import {
		LEVELS, RESOURCES, filterResources, kindsIn, lastChecked, levelSpan, type Kind
	} from '#lib/resources.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let r = $derived(m.resources);
	let uk = $derived(settings.lang === 'uk');

	const kinds = kindsIn(RESOURCES);

	let kind = $state<Kind | null>(null);
	let text = $state('');
	let shown = $derived(filterResources(RESOURCES, kind, text));

	// UTC, so the server and the browser print the same day
	let reviewed = $derived(
		new Intl.DateTimeFormat(uk ? 'uk' : 'en-GB', {
			day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
		}).format(new Date(lastChecked(RESOURCES)))
	);
</script>

<TextPage title={m.pageTitle.resources} description={m.meta.resources}>
	<p class="muted">{r.intro}</p>

	<div class="controls">
		<input
			class="ui-field"
			type="search"
			bind:value={text}
			placeholder={r.filterPlaceholder}
			aria-label={r.filterLabel}
			autocomplete="off"
			spellcheck="false"
		/>
		<div class="kinds" role="group" aria-label={r.kindLegend}>
			<button type="button" class="ui-chip" aria-pressed={kind === null} onclick={() => (kind = null)}>
				{r.all}
			</button>
			{#each kinds as k (k)}
				<button type="button" class="ui-chip" aria-pressed={kind === k} onclick={() => (kind = k)}>
					{r.kinds[k]}
				</button>
			{/each}
		</div>
	</div>

	<ul class="directory">
		{#each shown as item (item.url)}
			<li>
				<div class="name">
					<a href={item.url} rel="noopener">{item.name}</a>
					<span class="tags">
						<span class="ui-badge">{r.cost[item.cost]}</span>
						{#if item.explainedIn === 'uk'}
							<span class="ui-badge" title={r.ukOnlyHint}>
								<span aria-hidden="true">{r.ukOnly}</span>
								<span class="ui-sr-only">{r.ukOnlyHint}</span>
							</span>
						{/if}
					</span>
				</div>
				<p>{uk ? item.uk : item.en}</p>
				<p class="facts">
					<span class="dots" aria-hidden="true">
						{#each LEVELS as level (level)}
							<i class:on={item.levels.includes(level)}></i>
						{/each}
					</span>
					{r.levels[levelSpan(item.levels)]} · {r.kind[item.kind]}
				</p>
			</li>
		{/each}
	</ul>

	{#if !shown.length}
		<p class="none">{r.none} <a href="/report?kind=resource">{r.suggest}</a></p>
	{/if}

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
		display: grid;
		gap: 0.6rem;
		margin-top: 1rem;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.directory {
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
		border-bottom: 1px solid var(--border);
	}

	.directory li {
		padding: 0.7rem 0;
		border-top: 1px solid var(--border);
	}

	.directory p {
		margin: 0.1rem 0 0;
	}

	/* The name on the left and its tags on the right; in a narrow window the
	   tags drop under the name instead of squeezing it */
	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.2rem 0.75rem;
	}

	.name a {
		font-weight: 700;
	}

	.tags {
		display: inline-flex;
		gap: 0.3rem;
	}

	.facts {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* Three dots for beginner, intermediate and advanced, filled where the
	   resource suits that level. The words beside them say the same. Set in
	   the line of text, so a line that wraps continues under the dots. */
	.dots {
		display: inline-flex;
		gap: 3px;
		margin-right: 0.35rem;
		vertical-align: 0.05em;
	}

	.dots i {
		box-sizing: border-box;
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid currentColor;
		border-radius: 50%;
	}

	.dots i.on {
		background: currentColor;
	}

	.none {
		margin: 0.9rem 0;
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.2rem 1rem;
		font-size: var(--text-sm);
	}
</style>
