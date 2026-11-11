<!-- The visitor's saved words. The list comes from the browser (saved.svelte.ts),
     which keeps it in step with the account when signed in; the stressed
     headwords and meanings are then asked from /api/words/summary. -->
<script lang="ts">
	import { page } from '$app/state';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import SaveButton from '#lib/SaveButton.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { SUMMARY_MAX } from '#lib/saved.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import type { WordSummary } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	const saved = useSaved();
	let m = $derived(messagesFor(settings.lang));
	let uk = $derived(settings.lang === 'uk');
	// The sign-in callback sends the visitor to /saved with ?login=failed.
	let loginFailed = $derived(page.url.searchParams.get('login') === 'failed');

	let summaries = $state.raw(new Map<string, WordSummary>());
	// Words already asked about, so a word with no entry is not asked for again.
	const asked = new Set<string>();

	$effect(() => {
		const missing = saved.items.map((i) => i.word).filter((w) => !asked.has(w));
		if (!missing.length) return;
		for (const w of missing) asked.add(w);
		void (async () => {
			for (let i = 0; i < missing.length; i += SUMMARY_MAX) {
				const res = await fetch('/api/words/summary', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ words: missing.slice(i, i + SUMMARY_MAX) })
				}).catch(() => null);
				// On failure the plain words are shown; they are asked again on the next visit.
				if (!res?.ok) return;
				const found: WordSummary[] = (await res.json()).words;
				summaries = new Map([...summaries, ...found.map((s) => [s.word, s] as const)]);
			}
		})();
	});
</script>

<PageMeta title="{m.pageTitle.saved} · Nebokrai" description={m.meta.saved} />

<div class="page">
	<header>
		<h1>{m.pageTitle.saved}</h1>
		{#if saved.ready && saved.items.length}<span class="ui-badge">{saved.items.length}</span>{/if}
	</header>

	{#if loginFailed}
		<p class="notice" role="alert">
			{uk ? 'Не вдалося увійти. Спробуйте ще раз.' : 'Signing in didn’t work. Please try again.'}
		</p>
	{/if}

	{#if saved.ready && !saved.items.length}
		<div class="empty">
			<Icon name="bookmark" size={28} />
			<p>
				{uk
					? 'Тут поки порожньо. Натисніть закладку на картці слова, щоб зберегти його тут.'
					: 'Nothing saved yet. Press the bookmark on a word card to keep it here.'}
			</p>
			<a class="ui-btn" href="/">{m.nav.dictionary}</a>
		</div>
	{:else if saved.ready}
		<ul class="list">
			{#each saved.items as item (item.word)}
				{@const summary = summaries.get(item.word)}
				<li>
					<a class="headword" lang="uk" href={wordPath(item.word)}>
						<Stressed text={summary?.headword ?? item.word} />
					</a>
					<span class="glosses">{summary?.glosses.join('; ') ?? ''}</span>
					<SaveButton word={item.word} headword={summary?.headword ?? item.word} />
				</li>
			{/each}
		</ul>

		<div class="actions">
			<button type="button" class="ui-btn" disabled>{uk ? 'Тренувати ці слова' : 'Practise these words'}</button>
			<button type="button" class="ui-btn" disabled>{uk ? 'Експортувати' : 'Export'}</button>
			<span>{uk ? 'Незабаром' : 'Coming soon'}</span>
		</div>
	{/if}

	<section class="account">
		{#if !saved.signedIn}
			<p>
				{uk
					? 'Збережені слова зберігаються лише в цьому браузері.'
					: 'Your saved words are kept in this browser only.'}
			</p>
		{/if}
		<AccountPanel />
	</section>
</div>

<style>
	.page {
		box-sizing: border-box;
		max-width: 46rem;
		margin: 0 auto;
		padding: 1.75rem 1rem 0;
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: clamp(1.6rem, 4vw, 2rem);
		font-weight: 800;
		line-height: 1.2;
	}

	p {
		margin: 0;
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 0.9rem;
		padding: 2.5rem 1.25rem;
		border: 1px dashed var(--border-strong);
		border-radius: 16px;
		/* Half see-through, so the box still shows over a background photo */
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		color: var(--on-page);
		text-align: center;
	}

	.empty p {
		max-width: 26rem;
	}

	.list {
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		box-shadow: var(--shadow);
		list-style: none;
	}

	.list li {
		display: grid;
		grid-template-columns: minmax(7rem, 13rem) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.1rem 1rem;
		padding: 0.45rem 0.5rem 0.45rem 1.1rem;
	}

	.list li + li {
		border-top: 1px solid var(--border);
	}

	.headword {
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: 1.3rem;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.headword:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-decoration-color: var(--gold);
		text-underline-offset: 4px;
	}

	.glosses {
		color: var(--ink-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		color: var(--on-page);
		font-size: 0.9rem;
	}

	.notice {
		margin-bottom: 1rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--stress);
		border-radius: 10px;
	}

	.account {
		display: grid;
		gap: 0.5rem;
		margin-top: 1.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
		color: var(--on-page);
		font-size: 0.92rem;
	}

	/* Phones: the meanings go under the word */
	@media (max-width: 600px) {
		.page {
			padding-inline: 0.75rem;
		}

		.list li {
			grid-template-columns: minmax(0, 1fr) auto;
			padding-left: 0.9rem;
		}

		.glosses {
			grid-row: 2;
			grid-column: 1 / -1;
			padding-bottom: 0.3rem;
		}
	}
</style>
