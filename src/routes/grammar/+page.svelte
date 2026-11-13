<!-- The grammar words the dictionary uses, each in a sentence or two. The
     notes are the ones Term.svelte shows when a word is pressed (i18n.ts,
     `grammar.terms`), so the two cannot come to disagree, and each note's
     "more" link lands on its word here: the address is /grammar#genitive.

     It is a reference to look one word up in, not a text to read through, so
     it is cut into sheets: the first lists the eight groups as tiles, and each
     group then has a sheet of its own, with the word on the left and what it
     means on the right, as a glossary is set. -->
<script lang="ts">
	import PageMeta from '#lib/PageMeta.svelte';
	import { CASES, EXAMPLES, GROUPS, HINTS, type Group } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const groups = Object.keys(GROUPS) as Group[];

	// "noun, verb, adjective…": what a tile says is in its group
	let preview = $derived((group: Group) =>
		GROUPS[group].map((id) => m.grammar.terms[id].name.toLocaleLowerCase(settings.lang)).join(', '));
</script>

<PageMeta title="{m.pageTitle.grammar} · Nebokrai" description={m.meta.grammar} />

<div class="ui-page guide">
	<header id="sections" class="ui-card sheet">
		<h1 class="ui-title">{m.pageTitle.grammar}</h1>

		<nav aria-label={m.grammar.sections}>
			{#each groups as group, i (group)}
				<a href="#{group}">
					<span class="n" aria-hidden="true">{i + 1}</span>
					<b>{m.grammar.groups[group]}</b>
					<span class="words">{preview(group)}</span>
					<span class="count">{m.grammar.count(GROUPS[group].length)}</span>
				</a>
			{/each}
		</nav>
	</header>

	{#each groups as group, i (group)}
		<section id={group} class="ui-card sheet">
			<header>
				<span class="n" aria-hidden="true">{i + 1}</span>
				<h2>{m.grammar.groups[group]}</h2>
				<a class="back" href="#sections">{m.grammar.toSections}</a>
			</header>
			{#if m.grammar.intros[group]}<p class="about">{m.grammar.intros[group]}</p>{/if}

			<!-- The seven at a glance, before each is told in full -->
			{#if group === 'cases'}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th scope="col">{m.grammar.caseTable.name}</th>
								<th scope="col">{m.grammar.caseTable.question}</th>
								<th scope="col">{m.grammar.caseTable.example}</th>
							</tr>
						</thead>
						<tbody>
							{#each CASES as id (id)}
								<tr>
									<th scope="row"><a href="#{id}">{m.grammar.terms[id].name}</a></th>
									<td lang="uk">{HINTS[id] ?? '—'}</td>
									<td>
										<b lang="uk">{EXAMPLES[id]?.uk}</b>
										<span class="muted">{EXAMPLES[id]?.en}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<dl>
				{#each GROUPS[group] as id (id)}
					{@const term = m.grammar.terms[id]}
					{@const example = EXAMPLES[id]}
					<div {id}>
						<dt>
							{term.name}
							{#if HINTS[id]}<span class="ui-badge" lang="uk">{HINTS[id]}</span>{/if}
						</dt>
						<dd>
							<p>{term.text}</p>
							{#if example}
								<p class="example"><b lang="uk">{example.uk}</b><span class="muted">{example.en}</span></p>
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}
</div>

<style>
	.guide {
		display: grid;
		/* minmax(0, …): a sheet is as wide as the column, not as its widest line */
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		margin-block: 1.5rem 2rem;
	}

	.sheet {
		padding: 1.5rem 1.75rem;
		line-height: 1.55;
		/* A link to a group stops below the sticky header, which is one line tall
		   on a wide window, two under 1000px and three on a phone */
		scroll-margin-top: 4.5rem;
	}

	p {
		margin: 0;
	}

	.muted,
	.about {
		color: var(--muted);
	}

	/* A group's number: in the tiles and at the head of its sheet, so the eye
	   can find "5" again after following the link */
	.n {
		font-family: var(--font-heading);
		font-weight: 700;
		line-height: 1;
	}

	/* The eight groups as tiles: four in a row, two on a phone */
	nav {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10.25rem, 1fr));
		gap: 0.6rem;
		margin-top: 1.25rem;
	}

	nav a {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-areas:
			'n name'
			'words words'
			'count count';
		align-items: baseline;
		gap: 0.3rem 0.5rem;
		padding: 0.75rem 0.85rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		transition: border-color var(--duration);
	}

	nav .n {
		grid-area: n;
		color: var(--muted);
		font-size: 1.25rem;
	}

	nav b {
		grid-area: name;
		line-height: 1.25;
	}

	/* What is inside, cut off after two lines */
	.words {
		grid-area: words;
		display: -webkit-box;
		overflow: hidden;
		color: var(--muted);
		font-size: var(--text-sm);
		line-height: 1.35;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.count {
		grid-area: count;
		align-self: end;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* The gold line of the header's current page, on the tile under the pointer */
	nav a::before {
		content: '';
		position: absolute;
		inset: -1px 0.85rem auto;
		height: 2px;
		border-radius: 2px;
		background: var(--gold);
		opacity: 0;
		transition: opacity var(--duration);
	}

	@media (hover: hover) {
		nav a:hover {
			border-color: var(--border-strong);
		}

		nav a:hover::before {
			opacity: 1;
		}
	}

	nav a:focus-visible::before {
		opacity: 1;
	}

	/* The head of a group's sheet: its number in a ring, its name, the way back */
	section header {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	section .n {
		display: grid;
		flex: none;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		font-size: 1rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.45rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.back {
		margin-left: auto;
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	.back:hover {
		color: var(--ink);
	}

	.about {
		margin-top: 0.5rem;
	}

	/* The words of a group: the word on the left, what it means on the right,
	   ruled apart like the lines of a glossary */
	dl {
		margin: 1rem 0 0;
	}

	dl div {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 0.3rem 1.5rem;
		margin-inline: -0.75rem;
		padding: 0.8rem 0.75rem;
		border-top: 1px solid var(--border);
		scroll-margin-top: 4.5rem;
	}

	/* The word a link led to */
	dl div:target {
		background: var(--accent-soft);
		box-shadow: inset 3px 0 0 var(--accent);
	}

	dt {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		align-content: start;
		gap: 0.3rem 0.5rem;
		font-weight: 700;
	}

	/* Lowercase Ukrainian: a badge's bold capitals would shout it */
	dt .ui-badge {
		font-weight: 600;
	}

	dd {
		margin: 0;
	}

	/* The Ukrainian and what it means, set off from the explanation */
	.example {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.75rem;
		margin-top: 0.5rem;
		padding: 0.4rem 0.7rem;
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}

	.table-wrap {
		max-width: 100%;
		margin-top: 1rem;
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	table {
		width: 100%;
		border-collapse: collapse;
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

	thead th {
		background: var(--surface-2);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	/* A case's name leads to its row below. It is set as the name it is, in
	   the text's own colour: seven blue underlined links down one column made
	   the table look like a list of links. The gold line of the footer's links
	   shows under the one the pointer is on. */
	tbody th {
		font-weight: 700;
		white-space: nowrap;
	}

	tbody a {
		border-radius: var(--radius-sm);
	}

	@media (hover: hover) {
		tbody a:hover {
			text-decoration: underline;
			text-decoration-thickness: 2px;
			text-decoration-color: var(--gold);
			text-underline-offset: 4px;
		}
	}

	/* на кому? на чому? stays on one line */
	td[lang] {
		white-space: nowrap;
	}

	td .muted {
		display: block;
	}

	@media (max-width: 1000px) {
		.sheet,
		dl div {
			scroll-margin-top: 6.5rem;
		}
	}

	@media (max-width: 740px) {
		.sheet,
		dl div {
			scroll-margin-top: 8.75rem;
		}
	}

	/* Phones: two tiles in a row, and the meaning under its word */
	@media (max-width: 600px) {
		.guide {
			margin-top: 1rem;
		}

		.sheet {
			padding: 1.1rem 1.1rem 1.2rem;
		}

		nav {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		dl div {
			grid-template-columns: minmax(0, 1fr);
			margin-inline: -0.6rem;
			padding-inline: 0.6rem;
		}

		/* The table keeps the case and its question: three columns left the
		   examples a word wide, and each case has its example just below */
		tr > :last-child {
			display: none;
		}
	}
</style>
