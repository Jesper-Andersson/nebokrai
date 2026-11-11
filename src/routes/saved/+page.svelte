<!-- The visitor's saved words. The list comes from the browser (saved.svelte.ts),
     which keeps it in step with the account when signed in; the stressed
     headwords and meanings are then asked from /api/words/summary. The Export
     menu (Bits UI DropdownMenu) downloads all of the list, the ticked words or
     the words not exported before, as a file built in src/lib/export.ts from
     /api/words/cards. -->
<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import { exportFile, type ExportFormat } from '#lib/export.ts';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import SaveButton from '#lib/SaveButton.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { SUMMARY_MAX } from '#lib/saved.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import type { WordCard, WordSummary } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';
	import { useToasts } from '#lib/toasts.ts';

	const settings = useSettings();
	const saved = useSaved();
	const toaster = useToasts();
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

	const formats: ExportFormat[] = ['anki', 'csv', 'json'];

	// Which words an export takes: all of them, the ticked ones, or the ones
	// this browser has not exported before (saved.svelte.ts remembers those).
	type Scope = 'all' | 'selected' | 'fresh';
	const scopes: Scope[] = ['all', 'selected', 'fresh'];
	let scope = $state<Scope>('all');
	const ticked = new SvelteSet<string>();
	// From the list, so a word removed while ticked is not counted
	let selected = $derived(saved.items.filter((item) => ticked.has(item.word)));
	let fresh = $derived(saved.items.filter((item) => saved.exportedAt(item.word) === undefined));
	const inScope = (s: Scope) => (s === 'selected' ? selected : s === 'fresh' ? fresh : saved.items);

	// The likeliest wish each time the menu opens: the ticked words if there
	// are any, else what is new since the last export, else everything.
	function onMenuOpen(open: boolean) {
		if (!open) return;
		scope = selected.length ? 'selected' : fresh.length && fresh.length < saved.items.length ? 'fresh' : 'all';
	}

	function tickAll(all: boolean) {
		if (all) for (const item of saved.items) ticked.add(item.word);
		else ticked.clear();
	}

	const dateFormat = $derived(
		new Intl.DateTimeFormat(uk ? 'uk' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
	);
	let exporting = $state(false);
	// The Anki file needs one more step from the visitor; say which, once they have it.
	let ankiExported = $state(false);

	// Ask for everything a card holds, build the file here and hand it to the
	// browser as a download. A list that could not be fetched whole gives no
	// file: half a deck would look like a finished one.
	async function exportAs(format: ExportFormat) {
		if (exporting) return;
		exporting = true;
		try {
			const items = inScope(scope);
			const cards = new Map<string, WordCard>();
			for (let i = 0; i < items.length; i += SUMMARY_MAX) {
				const res = await fetch('/api/words/cards', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ words: items.slice(i, i + SUMMARY_MAX).map((item) => item.word) })
				});
				if (!res.ok) throw new Error(String(res.status));
				for (const card of (await res.json()).words as WordCard[]) cards.set(card.word, card);
			}
			// Saved order, newest first. A word with no entry any more is left out.
			const rows = items.flatMap((item) => {
				const card = cards.get(item.word);
				return card ? [{ ...card, saved_at: item.saved_at }] : [];
			});
			if (!rows.length) throw new Error('nothing to export');
			const file = exportFile(format, rows, (pos) => posLabel(m, pos), new Date());
			const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
			const link = document.createElement('a');
			link.href = url;
			link.download = file.name;
			link.click();
			// Not at once: the browser may not have started reading the file yet.
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
			ankiExported = format === 'anki';
			void saved.markExported(rows.map((row) => row.word));
			if (scope === 'selected') ticked.clear();
		} catch {
			toaster.addToast({ data: { title: m.export.failed } });
		} finally {
			exporting = false;
		}
	}
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
		<label class="select-all">
			<input
				type="checkbox"
				checked={selected.length === saved.items.length}
				indeterminate={selected.length > 0 && selected.length < saved.items.length}
				onchange={(event) => tickAll(event.currentTarget.checked)}
			/>
			{m.export.selectAll}
			{#if selected.length}<span>· {m.export.selectedCount(selected.length)}</span>{/if}
		</label>
		<ul class="list">
			{#each saved.items as item (item.word)}
				{@const summary = summaries.get(item.word)}
				{@const exportedAt = saved.exportedAt(item.word)}
				<li>
					<input
						type="checkbox"
						aria-label={m.export.select(item.word)}
						checked={ticked.has(item.word)}
						onchange={(event) => (event.currentTarget.checked ? ticked.add(item.word) : ticked.delete(item.word))}
					/>
					<a class="headword" lang="uk" href={wordPath(item.word)}>
						<Stressed text={summary?.headword ?? item.word} />
					</a>
					<span class="glosses">{summary?.glosses.join('; ') ?? ''}</span>
					<span class="end">
						{#if exportedAt !== undefined}
							<span class="exported" title={m.export.exportedOn(dateFormat.format(exportedAt))}>
								<Icon name="check" size={16} />
								<span class="ui-sr-only">{m.export.exported}</span>
							</span>
						{/if}
						<SaveButton word={item.word} headword={summary?.headword ?? item.word} />
					</span>
				</li>
			{/each}
		</ul>

		<div class="actions">
			<DropdownMenu.Root onOpenChange={onMenuOpen}>
				<DropdownMenu.Trigger class="ui-btn" disabled={exporting}>
					<Icon name="download" size={16} />
					{exporting ? m.export.working : m.export.button}
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content class="ui-popover ui-menu" align="start" sideOffset={6} collisionPadding={8}>
						<DropdownMenu.RadioGroup value={scope} onValueChange={(value) => (scope = value as Scope)}>
							<DropdownMenu.GroupHeading class="ui-menu-heading">{m.export.which}</DropdownMenu.GroupHeading>
							{#each scopes as s (s)}
								<!-- Stays open: the choice of file comes next -->
								<DropdownMenu.RadioItem
									class="ui-menu-item"
									value={s}
									disabled={!inScope(s).length}
									closeOnSelect={false}
								>
									{m.export.scope[s]}
									<span class="ui-menu-count">{inScope(s).length}</span>
								</DropdownMenu.RadioItem>
							{/each}
						</DropdownMenu.RadioGroup>
						<DropdownMenu.Separator class="ui-menu-separator" />
						<DropdownMenu.Group>
							<DropdownMenu.GroupHeading class="ui-menu-heading">{m.export.as}</DropdownMenu.GroupHeading>
							{#each formats as format (format)}
								<DropdownMenu.Item class="ui-menu-item" onSelect={() => exportAs(format)}>
									{m.export[format]}
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
			<button type="button" class="ui-btn" disabled>{uk ? 'Тренувати ці слова' : 'Practise these words'}</button>
			<span>{uk ? 'Незабаром' : 'Coming soon'}</span>
		</div>
		{#if ankiExported}
			<p class="hint" role="status">{m.export.ankiHint}</p>
		{/if}
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
		grid-template-columns: auto minmax(7rem, 13rem) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.1rem 1rem;
		padding: 0.45rem 0.5rem 0.45rem 1.1rem;
	}

	input[type='checkbox'] {
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}

	/* Lined up with the boxes of the list under it */
	.select-all {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: fit-content;
		margin: 0 0 0.5rem calc(1.1rem + 1px);
		color: var(--on-page);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.select-all span {
		margin-left: -0.6rem;
	}

	.end {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* A tick on a word that has been exported from this browser */
	.exported {
		display: inline-flex;
		color: var(--muted);
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

	.hint {
		margin-top: 0.6rem;
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
			grid-template-columns: auto minmax(0, 1fr) auto;
			column-gap: 0.75rem;
			padding-left: 0.9rem;
		}

		.select-all {
			gap: 0.75rem;
			margin-left: calc(0.9rem + 1px);
		}

		.select-all span {
			margin-left: -0.35rem;
		}

		.glosses {
			grid-row: 2;
			grid-column: 2 / -1;
			padding-bottom: 0.3rem;
		}
	}
</style>
