<!-- The declension or conjugation tables of one entry. A verb has four
     (present, future, past, imperative): they share one place on the page and
     Melt Tabs chooses which is shown, so each table can be wide enough to read
     on a phone. A single table is shown as it is.

     The names of the rows and columns can be pressed for a note (Term.svelte),
     and each has Ukrainian beside it that says the same thing: a case has the
     question it answers (Genitive: кого? чого?), a gender its pronoun, and a
     verb form the pronoun it goes with (я чита́ю). -->
<script lang="ts">
	import { Tabs } from 'melt/builders';
	import type { FormTable } from '#lib/forms.ts';
	import { HINTS, termOfLabel } from '#lib/grammar.ts';
	import { formLabel, messagesFor, tagLabel } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import { stressMoved } from './stress.ts';
	import Stressed from './Stressed.svelte';
	import Term from './Term.svelte';

	// `headword` is what each form's stress is compared with; leave it out and
	// no form is marked as moving the stress.
	let { tables, headword = '' }: { tables: FormTable[]; headword?: string } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// One instance per entry: the word page makes a new one for each entry.
	// svelte-ignore state_referenced_locally
	const tabs = new Tabs<string>({ value: tables[0].title });
	let tabbed = $derived(tables.length > 1);

	const GENDERS = ['Masculine', 'Feminine', 'Neuter'];
</script>

<!-- A row's or column's name, and under it the Ukrainian hint when asked for -->
{#snippet name(label: string, hinted: boolean)}
	{@const term = termOfLabel(label)}
	{#if term}<Term id={term}>{formLabel(m, label)}</Term>{:else}{formLabel(m, label)}{/if}
	{#if hinted && term && HINTS[term]}<span class="hint" lang="uk">{HINTS[term]}</span>{/if}
{/snippet}

{#if tabbed}
	<div {...tabs.triggerList} class="tabs">
		{#each tables as table (table.title)}
			<button {...tabs.getTrigger(table.title)} type="button">{formLabel(m, table.title)}</button>
		{/each}
	</div>
{/if}

{#each tables as table (table.title)}
	<!-- The pronouns of an adjective's columns (він, воно, вона, вони). A noun's
	     Singular and Plural get none: "вони" over one column alone explains nothing. -->
	{@const gendered = table.columns.some((col) => GENDERS.includes(col))}
	<div {...tabbed ? tabs.getContent(table.title) : {}} class="table-wrap">
		<table>
			<!-- Read out, not shown, when the tab above already names the table -->
			<caption class:ui-sr-only={tabbed}>
				{#if tabbed}{formLabel(m, table.title)}{:else}{@render name(table.title, false)}{/if}
			</caption>
			{#if table.columns.some(Boolean)}
				<thead>
					<tr>
						<td></td>
						{#each table.columns as col}<th scope="col">{@render name(col, gendered)}</th>{/each}
					</tr>
				</thead>
			{/if}
			<tbody>
				{#each table.rows as row (row.label)}
					<tr>
						<!-- A verb's rows have their pronouns in the cells -->
						<th scope="row">{@render name(row.label, !row.leads)}</th>
						{#each row.cells as cell, c}
							<td lang="uk">
								{#if cell.length && row.leads?.[c]}<span class="lead">{row.leads[c]}</span>{' '}{/if}
								{#each cell as item, i}
									<!-- {' '}: Svelte drops a space at the start of a block, and the note ran into the form -->
									{#if i}<br />{/if}<Stressed text={item.form} moved={stressMoved(headword, item.form)} />{#if item.note}{' '}<small lang={settings.lang}
											>{tagLabel(m, settings.lang, item.note)}</small
										>{/if}
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

	/* A table as a book prints one: a rule under its name and hairlines between
	   the rows, with no frame and no filled header. The entry around it is
	   already a card. */
	.table-wrap {
		max-width: 100%;
		overflow-x: auto;
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

	/* Under tabs the name is only read out, and the tabs' own rule stands here */
	caption {
		padding: 0 0 0.4rem;
		border-bottom: 1px solid var(--border-strong);
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

	/* The first column starts at the entry's left edge, under MEANINGS and FORMS */
	tr > :first-child {
		padding-left: 0;
	}

	tbody tr:last-child > * {
		border-bottom: 0;
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

	td small,
	.lead {
		color: var(--muted);
		font-weight: 400;
	}

	/* Under the name it explains, and lighter: кого? чого? */
	.hint {
		display: block;
		font-size: var(--text-xs);
		font-weight: 400;
	}

	.none {
		color: var(--muted);
		font-weight: 400;
	}
</style>
