<!-- The declension or conjugation tables of one entry. A verb has four
     (present, future, past, imperative): they share one place on the page and
     Melt Tabs chooses which is shown, so each table can be wide enough to read
     on a phone. A single table is shown as it is. -->
<script lang="ts">
	import { Tabs } from 'melt/builders';
	import type { FormTable } from '#lib/forms.ts';
	import { formLabel, messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import { stressMoved } from './stress.ts';
	import Stressed from './Stressed.svelte';

	// `headword` is what each form's stress is compared with; leave it out and
	// no form is marked as moving the stress.
	let { tables, headword = '' }: { tables: FormTable[]; headword?: string } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// One instance per entry: the word page makes a new one for each entry.
	// svelte-ignore state_referenced_locally
	const tabs = new Tabs<string>({ value: tables[0].title });
	let tabbed = $derived(tables.length > 1);
</script>

{#if tabbed}
	<div {...tabs.triggerList} class="tabs">
		{#each tables as table (table.title)}
			<button {...tabs.getTrigger(table.title)} type="button">{formLabel(m, table.title)}</button>
		{/each}
	</div>
{/if}

{#each tables as table (table.title)}
	<div {...tabbed ? tabs.getContent(table.title) : {}} class="table-wrap">
		<table>
			<caption class:ui-sr-only={tabbed}>{formLabel(m, table.title)}</caption>
			{#if table.columns.some(Boolean)}
				<thead>
					<tr>
						<td></td>
						{#each table.columns as col}<th scope="col">{formLabel(m, col)}</th>{/each}
					</tr>
				</thead>
			{/if}
			<tbody>
				{#each table.rows as row (row.label)}
					<tr>
						<th scope="row">{formLabel(m, row.label)}</th>
						{#each row.cells as cell}
							<td lang="uk">
								{#each cell as item, i}
									{#if i}<br />{/if}<Stressed text={item.form} moved={stressMoved(headword, item.form)} />{#if item.note}
										<small>{item.note}</small>{/if}
								{:else}<span class="none">—</span>{/each}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}

<style>
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.6rem;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
		scrollbar-width: none;
	}

	.tabs button {
		position: relative;
		padding: 0.5rem 0.75rem;
		border: 0;
		background: none;
		color: var(--muted);
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	.tabs button[data-active] {
		color: var(--ink);
	}

	.tabs button[data-active]::after {
		content: '';
		position: absolute;
		inset: auto 0.75rem 0;
		height: 2px;
		border-radius: 2px;
		background: var(--gold);
	}

	.tabs button:focus-visible {
		outline-offset: -2px;
		border-radius: var(--radius-md);
	}

	@media (pointer: coarse) {
		.tabs button {
			padding-block: 0.75rem;
		}
	}

	.table-wrap {
		max-width: 100%;
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	/* The `hidden` attribute of a tab that is not chosen must win over the rule above */
	.table-wrap[hidden] {
		display: none;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 1rem;
	}

	caption {
		padding: 0.5rem 0.9rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		font-weight: 700;
		text-align: left;
	}

	th,
	td {
		padding: 0.45rem 0.9rem;
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}

	tbody tr:last-child > * {
		border-bottom: 0;
	}

	thead th,
	thead td {
		background: var(--surface-2);
	}

	th {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	/* The row labels keep to their own width, so the forms start close to them */
	tbody th {
		width: 1%;
		padding-right: 2rem;
	}

	td {
		font-weight: 600;
	}

	td small {
		color: var(--muted);
		font-weight: 400;
	}

	.none {
		color: var(--muted);
		font-weight: 400;
	}
</style>
