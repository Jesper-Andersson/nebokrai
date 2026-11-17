<!-- The corrections readers have suggested, for the site's owner: a list for
     each status, and for each suggestion what the dictionary says now beside
     what was proposed, with Accept and Reject. An accepted one waits for
     `npm run suggestions` to turn it into a line of the data, and is then
     marked as applied here. -->
<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import PageMeta from '#lib/PageMeta.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { Suggestion, SuggestionStatus } from '#lib/server/suggestions.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let r = $derived(m.suggestReview);

	const STATUSES: SuggestionStatus[] = ['new', 'accepted', 'rejected', 'applied'];
	const when = $derived(new Intl.DateTimeFormat(settings.lang, { dateStyle: 'medium', timeStyle: 'short' }));

	// "Meaning 2", "Form: genitive, plural": the part's name, as the form on the word page had it
	function part(s: Suggestion): string {
		if (s.target === 'meaning') return m.suggest.part.meaning(s.sense_n ?? 0);
		if (s.target === 'form') return m.suggest.part.form((s.form_tags ?? '').replaceAll(' ', ', '));
		if (s.target === 'quote') return m.suggest.part.quote;
		if (s.target === 'example') return m.suggest.part.example;
		return m.suggest.part.headword;
	}

	// What can be done with a suggestion in each list
	const NEXT: Record<SuggestionStatus, SuggestionStatus[]> = {
		new: ['accepted', 'rejected'],
		accepted: ['applied', 'new'],
		rejected: ['new'],
		applied: ['accepted']
	};
	const act = (to: SuggestionStatus) =>
		to === 'accepted' ? r.accept : to === 'rejected' ? r.reject : to === 'applied' ? r.markApplied : r.reopen;

	let busy = $state<number | null>(null);
	let failed = $state<number | null>(null);

	async function move(s: Suggestion, to: SuggestionStatus) {
		busy = s.id;
		failed = null;
		let ok = false;
		try {
			const response = await fetch(`/api/suggest/${s.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status: to })
			});
			ok = response.ok;
		} catch {
			// No answer: said below
		}
		if (ok) await invalidateAll();
		else failed = s.id;
		busy = null;
	}
</script>

<PageMeta title="{m.pageTitle.suggestions} · Nebokrai" description={m.meta.suggestions} />

<div class="ui-page">
	<h1 class="ui-title">{m.pageTitle.suggestions}</h1>

	<div class="statuses" role="group" aria-label={m.pageTitle.suggestions}>
		{#each STATUSES as status (status)}
			<button
				type="button"
				class="ui-chip"
				aria-pressed={data.status === status}
				onclick={() => goto(`?status=${status}`)}
			>
				{r.tabs[status]} · {data.counts[status]}
			</button>
		{/each}
	</div>

	{#if !data.suggestions.length}
		<p class="none">{r.none}</p>
	{/if}

	<ul>
		{#each data.suggestions as s (s.id)}
			<li class="ui-card">
				<p class="about">
					<a href={wordPath(s.word)} lang="uk"><b><Stressed text={s.headword} /></b></a>
					<span>{posLabel(m, s.pos)} · {part(s)}</span>
					{#if s.tatoeba_id}
						<a class="quiet" href="https://tatoeba.org/sentences/show/{s.tatoeba_id}">Tatoeba #{s.tatoeba_id}</a>
					{/if}
				</p>
				<div class="versions">
					<div>
						<h2>{r.now}</h2>
						<p>{s.current}</p>
						{#if s.current_en}<p class="en">{s.current_en}</p>{/if}
					</div>
					<div>
						<h2>{r.suggested}</h2>
						<p class="new">{s.proposed}</p>
						{#if s.proposed_en}<p class="en">{s.proposed_en}</p>{/if}
					</div>
				</div>
				{#if s.note}<p class="why"><b>{r.why}:</b> {s.note}</p>{/if}
				<p class="who">
					#{s.id} · {when.format(new Date(s.created_at))}
					{#if s.native} · {r.native}{/if}
					· {s.user_id ? r.signedIn : r.anonymous}
					{#if s.name} · {s.name}{/if}
				</p>
				<div class="actions">
					{#each NEXT[s.status] as to, i (to)}
						<button
							type="button"
							class={['ui-btn', i === 0 && s.status !== 'applied' && 'ui-btn-primary']}
							disabled={busy === s.id}
							onclick={() => move(s, to)}
						>
							{act(to)}
						</button>
					{/each}
					{#if failed === s.id}<span class="failed" role="alert">{r.failed}</span>{/if}
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	p {
		margin: 0;
	}

	.statuses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 1rem 0;
	}

	.none {
		color: var(--on-page);
	}

	ul {
		display: grid;
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: 0.7rem;
		padding: 1.1rem 1.25rem;
	}

	.about {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.75rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.about b {
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
	}

	.quiet {
		color: var(--muted);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* What the page says now beside what was proposed; one under the other on a phone */
	.versions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem 1.5rem;
	}

	@media (max-width: 600px) {
		.versions {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	h2 {
		margin: 0 0 0.2rem;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.versions p {
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}

	.versions p.new {
		color: var(--ink);
		font-weight: 600;
	}

	.versions p.en {
		font-size: var(--text-sm);
	}

	.why {
		color: var(--ink-2);
		font-size: var(--text-sm);
		white-space: pre-line;
	}

	.who {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.failed {
		color: var(--stress);
		font-size: var(--text-sm);
	}
</style>
