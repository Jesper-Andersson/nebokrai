<!-- The visitor's saved words. The list comes from the browser (saved.svelte.ts),
     which keeps it in step with the account when signed in; the stressed
     headwords and meanings are then asked from /api/words/summary. -->
<script lang="ts">
	import { page } from '$app/state';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { SUMMARY_MAX } from '#lib/saved.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordSummary } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	const saved = useSaved();
	let m = $derived(messagesFor(settings.lang));
	let uk = $derived(settings.lang === 'uk');
	// The sign-in callback sends the visitor here with ?login=failed.
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

<!-- A word with its stressed vowel (letter + U+0301) in red -->
{#snippet stressed(text: string)}{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span class="stress">{part}</span>{:else}{part}{/if}{/each}{/snippet}

<TextPage title={m.pageTitle.saved}>
	{#if loginFailed}
		<p class="notice" role="alert">
			{uk
				? 'Не вдалося увійти. Спробуйте ще раз.'
				: 'Signing in didn’t work. Please try again.'}
		</p>
	{/if}

	{#if saved.ready && !saved.items.length}
		<div class="empty">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
				<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
			</svg>
			<p>
				{uk
					? 'Тут поки порожньо. Натисніть закладку на картці слова, щоб зберегти його тут.'
					: 'Nothing saved yet. Press the bookmark on a word card to keep it here.'}
			</p>
		</div>
	{:else if saved.ready}
		<ul class="saved">
			{#each saved.items as item (item.word)}
				{@const summary = summaries.get(item.word)}
				<li>
					<a class="headword" lang="uk" href={wordPath(item.word)}>
						{@render stressed(summary?.headword ?? item.word)}
					</a>
					<span>{summary?.glosses.join('; ') ?? ''}</span>
					<button type="button" class="remove" aria-label={m.card.unsave} onclick={() => saved.toggle(item.word)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</li>
			{/each}
		</ul>

		<div class="actions">
			<button type="button" disabled>{uk ? 'Тренувати ці слова' : 'Practise these words'}</button>
			<button type="button" disabled>{uk ? 'Експортувати' : 'Export'}</button>
			<span class="muted">{uk ? 'Незабаром' : 'Coming soon'}</span>
		</div>
	{/if}

	<div class="account">
		{#if !saved.signedIn}
			<p class="muted">
				{uk
					? 'Збережені слова зберігаються лише в цьому браузері.'
					: 'Your saved words are kept in this browser only.'}
			</p>
		{/if}
		<AccountPanel />
	</div>
</TextPage>

<style>
	.empty {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 1rem 1.1rem;
		border: 1.5px dashed var(--line);
		border-radius: 6px;
		color: var(--muted);
	}

	.empty svg {
		flex: none;
		width: 1.8rem;
		height: 1.8rem;
	}

	.empty p {
		margin: 0;
	}

	.saved {
		display: grid;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}

	.saved li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--line);
	}

	.saved .headword {
		min-width: 8rem;
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: 1.4rem;
		font-weight: 800;
		text-decoration: none;
	}

	.saved span {
		color: var(--muted);
	}

	.stress {
		color: var(--stress);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
	}

	.actions button {
		padding: 0.45rem 1rem;
		border: 1.5px solid var(--field-line);
		border-radius: 999px;
		background: var(--field);
		color: var(--ink);
		font-weight: 600;
	}

	.actions button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.notice {
		margin: 0 0 1rem;
		padding: 0.6rem 0.9rem;
		border: 1.5px solid var(--stress);
		border-radius: 6px;
	}

	.account {
		display: grid;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.account p {
		margin: 0;
	}

	.remove {
		display: inline-flex;
		margin-left: auto;
		padding: 0.2rem;
		border: 0;
		background: none;
		color: var(--faint);
		cursor: pointer;
	}

	.remove:hover {
		color: var(--ink);
	}

	.remove svg {
		width: 1.1rem;
		height: 1.1rem;
	}
</style>
