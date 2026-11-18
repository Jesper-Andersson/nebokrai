<!-- A grammar point's page, as the user picked it in Figma on 2026-11-18
     ("A3"): a short lead, the pattern and its endings on one soft panel,
     examples with the part that changes marked, the notes on what trips
     learners up, and a button into the lesson's practice.

       The present tense                          ← h1
       Grammar · Verbs   Before the verb lessons
       A Ukrainian verb changes its ending…       ← lead
       ┌ stem + ending ─────────────────────┐
       │ я   читаю   говорю                 │
       └────────────────────────────────────┘
       Examples · notes · See also
       [Next: Verbs + на що? →]  Skip to practice

     The explanations are English in either interface language (user,
     2026-11-18); the interface around them follows the language setting.
     The text is in practice/intros.ts, the sentences come from the
     practice's own (+page.server.ts). -->
<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/Icon.svelte';
	import PointList from '#lib/PointList.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import TextPage from '#lib/TextPage.svelte';
	import type { TermId } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import {
		FIRST_SET, LEVEL_SOURCE, PERSONS, POINTS_PATH, PRESENT_EXAMPLES, PRESENT_HOW, PRESENT_TENSE, SECOND_SET, TOPICS,
		endingStart, introOf, introPath, lessonName, markedParts, parts, withTerms, type Example, type Part
	} from '#lib/practice/intros.ts';
	import { LESSONS } from '#lib/practice/lessons.ts';
	import { meaningOfPoint, pointOf, ruleOf, type Point } from '#lib/practice/points.ts';
	import { endingsOf, type EndingRow } from '#lib/practice/rules.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let intro = $derived(introOf(data.id)!);
	let present = $derived(data.id === PRESENT_TENSE);
	let lesson = $derived(LESSONS.find((each) => each.id === data.id));
	let group = $derived(present ? 'government' : lesson?.group);
	/** The index's group the point is listed in: Prepositions, Sentences… */
	let topic = $derived(TOPICS.find((each) => each.points.includes(data.id))?.id);
	let points = $derived((lesson?.points ?? []).map(pointOf).filter((point): point is Point => point !== undefined));

	const verbLessons = LESSONS.filter((each) => each.group === 'government');
	/** The present tense leads on to the verb lesson it was opened for (?next=), or the first. */
	let next = $derived(
		verbLessons.find((each) => each.id === page.url.searchParams.get('next')) ?? verbLessons[0]);

	const caseName = (point: Point) =>
		m.grammar.terms[point.case].name + (point.number ? ` ${m.practice.ofNumber[point.number]}` : '');

	/** A table of endings for each case the lesson's rules ask for, once each (a number's has its own). */
	let tables = $derived.by(() => {
		const out = new Map<string, { label: string; rows: readonly EndingRow[] }>();
		for (const point of points) {
			const key = point.kind === 'number' ? point.id : point.kind === 'roles' ? 'roles' : point.case;
			const rows = endingsOf(point);
			if (!out.has(key) && rows.length) out.set(key, { label: point.kind === 'number' ? point.cue : caseName(point), rows });
		}
		return [...out.values()];
	});

	/** Which case's endings are shown, where the lesson asks for more than one. */
	// Back to the first on another point's page: the page is kept between them
	let shownTable = $derived.by(() => (data.id ? 0 : 0));

	let before = $derived(intro.notes.slice(0, intro.notesFirst ?? 0));
	let after = $derived(intro.notes.slice(intro.notesFirst ?? 0));


	/** Where to read on: the cases' words in the glossary, the next lesson, and for verbs the present tense. */
	let seeAlso = $derived.by(() => {
		if (present) {
			return [
				{ href: introPath(next.id), text: introOf(next.id)!.title },
				{ href: '/grammar#conjugation', text: m.intro.glossary(m.grammar.terms.conjugation.name) },
				{ href: wordPath('читати'), text: m.intro.allForms('читати') }
			];
		}
		const links = [...new Set(points.map((point) => point.case))].map((kase) =>
			({ href: `/grammar#${kase}`, text: m.intro.glossary(m.grammar.terms[kase].name) }));
		if (group === 'government') links.push({ href: introPath(PRESENT_TENSE), text: introOf(PRESENT_TENSE)!.title });
		const following = lesson ? LESSONS[LESSONS.indexOf(lesson) + 1] : undefined;
		if (following && following.group === group) {
			links.push({ href: introPath(following.id), text: introOf(following.id)!.title });
		}
		return links;
	});

	// Only the ending is marked, as everywhere else on the page: біля дом|ому
	const sentence = (example: Example): Part[] => {
		const end = example.start + example.length;
		const cut = example.start + endingStart(example.uk.slice(example.start, end), example.word);
		return [
			{ text: example.uk.slice(0, cut), uk: true },
			{ text: example.uk.slice(cut, end), uk: true, mark: true },
			{ text: example.uk.slice(end), uk: true }
		].filter((part) => part.text);
	};

	/** The points before and after this one in its group of the index, for reading on in order. */
	let neighbours = $derived.by(() => {
		const ids = TOPICS.find((each) => each.points.includes(data.id))?.points ?? [];
		const at = ids.indexOf(data.id);
		return { previous: at > 0 ? introOf(ids[at - 1]) : undefined, next: at >= 0 ? introOf(ids[at + 1]) : undefined };
	});
</script>

{#snippet rich(list: Part[])}{#each list as part, i (i)}{#if part.mark}<b class="e" lang="uk">{part.text}</b>{:else if part.uk}<span class="uk" lang="uk">{part.text}</span>{:else if part.term}<Term id={part.term as TermId}>{part.text}</Term>{:else}{part.text}{/if}{/each}{/snippet}

{#snippet notes(list: typeof intro.notes)}
	{#each list as item, i (i)}
		{#if item.title}<h2 lang="en">{item.title}</h2>{/if}
		<p lang="en">{@render rich(parts(item.body))}</p>
	{/each}
{/snippet}

{#snippet aside()}
	<PointList current={data.id} variant="side" />
	<PointList current={data.id} variant="panel" />
{/snippet}

<TextPage title={intro.title} description={m.meta.grammarPoint(intro.title)} {aside}>
	<!-- One line under the title (user's pick, 2026-11-18): where the point is
	     listed, its level (linked to where the level comes from) and a later
	     part's own level -->
	<p class="meta">
		<a href={POINTS_PATH}>{m.intro.points}</a> · {topic ? m.intro.topics[topic] : ''} ·
		<a
			class="level-link"
			href={LEVEL_SOURCE.url}
			target="_blank"
			rel="noopener"
			title={intro.levelEstimated ? m.intro.levelEstimated : m.intro.levelFrom}
			aria-label="{intro.level} {m.intro.levels[intro.level]}: {intro.levelEstimated ? m.intro.levelEstimated : m.intro.levelFrom}"
			><span class="ui-level" data-level={intro.level}>{intro.level}</span></a
		>
		{#if intro.levelNote}<span class="later" lang="en">{@render rich(parts(intro.levelNote))}</span>{/if}
	</p>
	{#if m.intro.englishOnly}<p class="muted note">{m.intro.englishOnly}</p>{/if}

	<!-- The case names in the lead open their glossary note where they are read -->
	<p class="lead" lang="en">{@render rich(withTerms(parts(intro.lead)))}</p>

	<div class="rule">
		{#if present}
			<p class="pattern">{m.intro.stem} + <b class="e">{m.intro.ending}</b></p>
			<p class="how" lang="en">{@render rich(parts(PRESENT_HOW))}</p>
			<table>
				<thead>
					<tr><td></td><th scope="col">{m.intro.firstSet}</th><th scope="col">{m.intro.secondSet}</th></tr>
				</thead>
				<tbody>
					{#each PERSONS as person, i (person)}
						<tr>
							<th scope="row" lang="uk">{person}</th>
							{#each [FIRST_SET, SECOND_SET] as set (set.infinitive)}
								<td class="uk" lang="uk">{set.stem}<b class="e">{set.endings[i]}</b></td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<!-- One row a rule, with its own short example (user's pick, 2026-11-18) -->
			<table class="rules">
				<tbody>
					{#each points as point (point.id)}
						<tr>
							<th scope="row" lang="uk">{ruleOf(point)}</th>
							<td class="case">{caseName(point).toLocaleLowerCase(settings.lang)}</td>
							<td class="means">{meaningOfPoint(m.practice.meaning, point, settings.lang)}</td>
							<td class="uk" lang="uk">{point.example}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<!-- The endings of one case at a time: the first, or the one chosen -->
			{#if tables.length > 1}
				<div class="tabs" role="group" aria-label={m.intro.endingsOf}>
					{#each tables as table, i (table.label)}
						<button type="button" class="tab" aria-pressed={i === shownTable} onclick={() => (shownTable = i)}>{m.intro.endings(table.label)}</button>
					{/each}
				</div>
			{/if}
			{#each tables.filter((_, i) => i === Math.min(shownTable, tables.length - 1)) as table (table.label)}
				<table>
					<caption class:ui-sr-only={tables.length > 1}>{m.intro.endings(table.label)}</caption>
					<tbody>
						{#each table.rows as row, i (i)}
							<tr>
								<th scope="row">
									{#if row.ending}<span class="e" lang="uk">{row.ending}</span>{:else}<span class="muted">{m.practice.rule.same}</span>{/if}
								</th>
								<td class="uk" lang="uk"><Stressed text={row.words} /></td>
								<td class="kind">{row.kinds.map((kind) => m.grammar.terms[kind].name).join(' · ')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/each}
		{/if}
	</div>

	{@render notes(before)}

	{#if present || data.examples.length}
		<h2>{m.intro.examples}</h2>
		<ul class="examples">
			{#if present}
				{#each PRESENT_EXAMPLES as example (example.uk)}
					<li><span class="sentence">{@render rich(markedParts(example.uk))}</span><span class="en" lang="en">{example.en}</span></li>
				{/each}
			{:else}
				{#each data.examples as example (example.uk)}
					<li>
						<span class="sentence">{@render rich(sentence(example))}</span>
						<span class="en" lang="en">
							{example.en}
							{#if example.tatoeba_id}
								<a class="credit" href="https://tatoeba.org/sentences/show/{example.tatoeba_id}">Tatoeba #{example.tatoeba_id}{#if example.adapted}, {m.word.adapted}{/if}</a>
							{/if}
						</span>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}

	{@render notes(after)}

	<div class="go">
		{#if present}
			<a class="ui-btn ui-btn-primary" href={introPath(next.id)}>
				{m.intro.next(lessonName(next.id))} <Icon name="arrow-right" size={16} />
			</a>
			<a class="skip" href="/practice?lesson={next.id}">{m.intro.skip}</a>
		{:else}
			<a class="ui-btn ui-btn-primary" href="/practice?lesson={data.id}">
				{m.intro.start} <Icon name="arrow-right" size={16} />
			</a>
		{/if}
	</div>

	<h2>{m.intro.seeAlso}</h2>
	<ul class="see">
		{#each seeAlso as link (link.href)}<li><a href={link.href}>{link.text}</a></li>{/each}
	</ul>

	<!-- Reading on in order: the points before and after this one in its group -->
	{#if topic && (neighbours.previous || neighbours.next)}
		<nav class="neighbours" aria-label={m.intro.topics[topic]}>
			{#if neighbours.previous}
				<a class="prev" href={introPath(neighbours.previous.id)}>
					<small>{m.intro.previousIn(m.intro.topics[topic])}</small><span lang="en">{neighbours.previous.title}</span>
				</a>
			{/if}
			{#if neighbours.next}
				<a class="next" href={introPath(neighbours.next.id)}>
					<small>{m.intro.nextIn(m.intro.topics[topic])}</small><span lang="en">{neighbours.next.title}</span>
				</a>
			{/if}
		</nav>
	{/if}

	<!-- What the rule can be checked against: a line at the foot, not a part to read -->
	<p class="sources">
		{m.intro.sources}
		{#each intro.sources as source, i (source.url)}{#if i}{' · '}{/if}<a href={source.url} target="_blank" rel="noopener" lang="en">{source.title}</a>{/each}
	</p>
</TextPage>

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.6rem;
		margin-top: -0.25rem;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	.note {
		margin-top: -0.25rem;
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	/* The level, a chip that links to where it comes from: no underline */
	.meta .level-link {
		display: inline-flex;
		text-decoration: none;
	}

	/* The points before and after, at the foot: previous on the left, next on the right */
	.neighbours {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1.25rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	.neighbours a {
		display: grid;
		text-decoration: none;
	}

	.neighbours .next {
		grid-column: 2;
		text-align: right;
	}

	.neighbours small {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	/* A later part's level, after the chip: до + genitive: A2 */
	.later {
		font-size: var(--text-xs);
	}

	/* The Ukrainian in a line of English, and the part of it that changes */
	.uk {
		font-family: var(--font-reading);
	}

	.e {
		color: var(--accent);
		font-family: var(--font-reading);
		font-weight: 700;
	}

	/* The pattern and its endings on one soft panel (the user's note on
	   "A": tables have no frame elsewhere, this one has a ground) */
	.rule {
		display: grid;
		gap: 0.6rem;
		margin: 1.25rem 0 0.5rem;
		padding: 1.1rem 1.25rem 0.9rem;
		border-radius: var(--radius-lg);
		background: var(--surface-2);
	}

	.rule p {
		margin: 0;
	}

	.pattern {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.5rem;
		font-family: var(--font-text);
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.means {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	/* The rules, a row each: у / в · locative · in, at · у місті */
	.rules th {
		font-family: var(--font-reading);
		font-size: var(--text-lg);
		font-weight: 700;
		white-space: nowrap;
	}

	.rules .case {
		white-space: nowrap;
	}

	.rules td.uk {
		white-space: nowrap;
	}

	/* One case's endings at a time, chosen like the level chips */
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}

	.tab {
		padding: 0.15rem 0.7rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink-2);
		font: inherit;
		font-family: var(--font-text);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.tab[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--bg);
	}

	.how {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-text);
	}

	caption {
		padding-bottom: 0.3rem;
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		text-align: left;
	}

	th,
	td {
		padding: 0.35rem 0.75rem 0.35rem 0;
		border-bottom: 1px solid var(--border-strong);
		text-align: left;
		vertical-align: baseline;
	}

	tr:last-child > * {
		border-bottom: 0;
	}

	thead th {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	tbody th {
		font-weight: 400;
		white-space: nowrap;
	}

	/* A lesson's tables of endings, one under the other, keep their columns in line */
	caption + tbody th {
		width: 7.5rem;
	}

	.kind {
		width: 40%;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.examples,
	.see {
		display: grid;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.see {
		gap: 0.3rem;
	}

	.examples li {
		display: grid;
	}

	.sentence {
		font-size: var(--text-lg);
	}

	.en {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	/* Each Tatoeba sentence names its source, as its licence asks: quietly */
	.en .credit {
		margin-left: 0.4rem;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.go {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		margin-top: 2rem;
	}

	/* Not the sheet's underlined accent link: the quiet way past the page */
	.go .skip {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	.go .ui-btn {
		color: var(--accent-ink);
		text-decoration: none;
	}

	.sources {
		margin-top: 1.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	@media (max-width: 600px) {
		.rule {
			padding-inline: 0.9rem;
		}

		/* The rules keep their word, case and example on a phone; the lead says what each means */
		.rules .means {
			display: none;
		}

		/* The words get the room on a phone */
		caption + tbody th {
			width: 4.75rem;
		}

		.kind {
			width: 28%;
		}

		.go {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}

		.go .ui-btn {
			justify-content: center;
		}
	}
</style>
