<!-- The visitor's saved words. The list comes from the browser (saved.svelte.ts),
     which keeps it in step with the account when signed in; the stressed
     headwords and meanings are then asked from /api/words/summary. The Export
     menu (Bits UI DropdownMenu) downloads all of the list, the ticked words or
     the words not exported before, as a file built in src/lib/export.ts from
     /api/words/cards. The same menu sends them straight into Anki through
     AnkiConnect (src/lib/anki-connect.ts). With lists (src/lib/lists.ts), a
     row of chips above the words shows one list at a time, and the export
     then takes its words from the list in view. -->
<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { listPath } from '#lib/lists.ts';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import AnkiSettingsDialog from '#lib/AnkiSettings.svelte';
	import {
		ANKI_CONNECT_PAGE, AnkiError, DEFAULT_SETTINGS, browserInvoke, readSettings, sendToAnki, type AnkiSettings,
		type SendResult
	} from '#lib/anki-connect.ts';
	import { exportFile, type ExportFormat } from '#lib/export.ts';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import Grammar from '#lib/Grammar.svelte';
	import Headword from '#lib/Headword.svelte';
	import ListPicker from '#lib/ListPicker.svelte';
	import SaveButton from '#lib/SaveButton.svelte';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { MAX_LIST_NAME, SUMMARY_MAX } from '#lib/saved.ts';
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

	// The list in view, by its id; null shows every saved word. It is the
	// page's address (/saved?list=…), so the "Saved to Їжа" message can link
	// to a list and Back returns to the one before. Looked up each time, so a
	// list deleted in another tab falls back to all the words.
	let filter = $derived(page.url.searchParams.get('list'));
	let current = $derived(saved.lists.find((list) => list.id === filter) ?? null);
	// The words on the page: everything below (ticks, the export) works on these.
	let shown = $derived.by(() => {
		if (!current) return saved.items;
		const inList = new Set(current.words);
		return saved.items.filter((item) => inList.has(item.word));
	});

	// Which words an export takes: all of them, the ticked ones, or the ones
	// this browser has not exported before (saved.svelte.ts remembers those).
	type Scope = 'all' | 'selected' | 'fresh';
	const scopes: Scope[] = ['all', 'selected', 'fresh'];
	let scope = $state<Scope>('all');
	const ticked = new SvelteSet<string>();
	// From the words shown, so a word removed while ticked is not counted
	let selected = $derived(shown.filter((item) => ticked.has(item.word)));
	let fresh = $derived(shown.filter((item) => saved.exportedAt(item.word) === undefined));
	const inScope = (s: Scope) => (s === 'selected' ? selected : s === 'fresh' ? fresh : shown);

	// The likeliest wish each time the menu opens: the ticked words if there
	// are any, else what is new since the last export, else everything.
	function onMenuOpen(open: boolean) {
		if (!open) return;
		scope = selected.length ? 'selected' : fresh.length && fresh.length < shown.length ? 'fresh' : 'all';
	}

	function tickAll(all: boolean) {
		if (all) for (const item of shown) ticked.add(item.word);
		else ticked.clear();
	}

	let renaming = $state(false);
	let newName = $state('');
	let nameTaken = $state(false);

	function view(id: string | null) {
		void goto(id === null ? '/saved' : listPath(id), { reset: false });
	}

	// Whichever way the list in view changes (a chip, a link, Back): a tick on
	// a word that is no longer on the page would be exported unseen.
	$effect(() => {
		void filter;
		untrack(() => {
			ticked.clear();
			renaming = false;
		});
	});

	function startRenaming() {
		newName = current?.name ?? '';
		nameTaken = false;
		renaming = true;
	}

	function rename(event: SubmitEvent) {
		event.preventDefault();
		if (!current) return;
		const result = saved.renameList(current.id, newName);
		nameTaken = result === 'taken';
		if (result === 'ok') renaming = false;
	}

	// At once, with Undo in the message, as removing a word is: the words stay saved either way.
	function deleteCurrent() {
		const gone = current && saved.deleteList(current.id);
		if (!gone) return;
		view(null);
		toaster.addToast({ data: { title: m.lists.deleted(gone.name), undo: () => void saved.restoreList(gone) } });
	}

	// The rename box opens ready to be typed over
	function focusAll(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	const dateFormat = $derived(
		new Intl.DateTimeFormat(uk ? 'uk' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
	);
	let exporting = $state(false);
	// What to say under the buttons after an Anki export: the file needs one
	// more step from the visitor, and a send has a result or a reason it failed.
	type AnkiNote =
		| { kind: 'file' }
		| { kind: 'sent'; result: SendResult; deck: string }
		| { kind: 'error'; error: AnkiError };
	let ankiNote = $state.raw<AnkiNote | null>(null);
	// The box that says it: a heading, then a line of text or steps to follow
	type Notice = {
		tone: 'ok' | 'info' | 'error';
		title: string;
		body?: string;
		steps?: string[];
		/** Offer the add-on's page, or the settings, as the way out */
		addon?: boolean;
		settings?: boolean;
	};
	let notice = $derived.by((): Notice | null => {
		if (!ankiNote) return null;
		if (ankiNote.kind === 'file') return { tone: 'info', title: m.export.ankiFile, body: m.export.ankiHint };
		if (ankiNote.kind === 'sent') {
			const { added, updated, unchanged } = ankiNote.result;
			return { tone: 'ok', title: m.export.ankiSent.title(ankiNote.deck), body: m.export.ankiSent.body(added, updated, unchanged) };
		}
		const { reason, message } = ankiNote.error;
		// Nothing answered: most likely the add-on is not there yet, so offer it
		if (reason === 'unreachable') return { tone: 'error', ...m.export.ankiError.unreachable, addon: true };
		if (reason === 'failed') return { tone: 'error', title: m.export.ankiError.failed.title, body: message };
		return { tone: 'error', ...m.export.ankiError[reason], settings: reason === 'setup' };
	});

	// Everything a card holds, for the words in scope. A list that could not
	// be fetched whole throws: half a deck would look like a finished one.
	async function cardsInScope() {
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
		return rows;
	}

	function afterExport(words: string[]) {
		void saved.markExported(words);
		if (scope === 'selected') ticked.clear();
	}

	// Where a send puts the words (the deck, the note type, tags). Kept in this
	// browser only: Anki is on this computer, so the choices belong here too.
	const ANKI_SETTINGS_KEY = 'anki-settings';
	let ankiSettings = $state.raw<AnkiSettings>(DEFAULT_SETTINGS);
	let settingsOpen = $state(false);
	$effect(() => {
		try {
			ankiSettings = readSettings(JSON.parse(localStorage.getItem(ANKI_SETTINGS_KEY) ?? 'null'));
		} catch {
			// No storage, or something else's text under the key: the defaults stand
		}
	});

	function saveAnkiSettings(settings: AnkiSettings) {
		ankiSettings = settings;
		// The trouble the box was about may be gone now
		if (ankiNote?.kind === 'error') ankiNote = null;
		try {
			localStorage.setItem(ANKI_SETTINGS_KEY, JSON.stringify(settings));
		} catch {
			// Private window: the choice lasts until the page is left
		}
	}

	// Straight into Anki on this computer. What went wrong is said under the
	// buttons, not in a toast: the visitor has something to do about it.
	async function sendToAnkiApp() {
		if (exporting) return;
		exporting = true;
		ankiNote = null;
		try {
			const rows = await cardsInScope();
			const result = await sendToAnki(rows, (pos) => posLabel(m, pos), browserInvoke, ankiSettings);
			ankiNote = { kind: 'sent', result, deck: ankiSettings.deck };
			afterExport(rows.map((row) => row.word));
		} catch (error) {
			if (error instanceof AnkiError) ankiNote = { kind: 'error', error };
			else toaster.addToast({ data: { title: m.export.failed } });
		} finally {
			exporting = false;
		}
	}

	// Build the file here and hand it to the browser as a download.
	async function exportAs(format: ExportFormat) {
		if (exporting) return;
		exporting = true;
		try {
			const rows = await cardsInScope();
			const file = exportFile(format, rows, (pos) => posLabel(m, pos), new Date());
			const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
			const link = document.createElement('a');
			link.href = url;
			link.download = file.name;
			link.click();
			// Not at once: the browser may not have started reading the file yet.
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
			ankiNote = format === 'anki' ? { kind: 'file' } : null;
			afterExport(rows.map((row) => row.word));
		} catch {
			toaster.addToast({ data: { title: m.export.failed } });
		} finally {
			exporting = false;
		}
	}
</script>

<PageMeta title="{m.pageTitle.saved} · Nebokrai" description={m.meta.saved} />

<div class="ui-page page">
	<header>
		<h1 class="ui-title">{m.pageTitle.saved}</h1>
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
					? 'Поки нічого не збережено. Натисніть закладку біля слова, щоб зберегти його.'
					: 'Nothing is saved yet. Press the bookmark on a word to save it.'}
			</p>
			<a class="ui-btn" href="/">{m.nav.dictionary}</a>
		</div>
	{:else if saved.ready}
		{#if saved.lists.length}
			<div class="lists" role="group" aria-label={m.lists.heading}>
				<button type="button" class="ui-chip" aria-pressed={!current} onclick={() => view(null)}>
					{m.lists.all} <span class="count">{saved.items.length}</span>
				</button>
				{#each saved.lists as list (list.id)}
					<button type="button" class="ui-chip" aria-pressed={current?.id === list.id} onclick={() => view(list.id)}>
						{list.name} <span class="count">{list.words.length}</span>
					</button>
				{/each}
			</div>
		{/if}
		{#if current && renaming}
			<form class="list-tools" onsubmit={rename}>
				<input
					class="ui-field"
					type="text"
					maxlength={MAX_LIST_NAME}
					autocomplete="off"
					aria-label={m.lists.name}
					bind:value={newName}
					oninput={() => (nameTaken = false)}
					use:focusAll
				/>
				<button type="submit" class="ui-btn ui-btn-primary" disabled={!newName.trim()}>{m.lists.save}</button>
				<button type="button" class="ui-btn" onclick={() => (renaming = false)}>{m.lists.cancel}</button>
				{#if nameTaken}<p class="problem" role="alert">{m.lists.taken}</p>{/if}
			</form>
		{:else if current}
			<div class="list-tools">
				<button type="button" class="ui-btn" onclick={startRenaming}>{m.lists.rename}</button>
				<button type="button" class="ui-btn" onclick={deleteCurrent}>{m.lists.delete}</button>
			</div>
		{/if}

		{#if !shown.length}
			<p class="no-words">{m.lists.empty}</p>
		{:else}
			<div class="toolbar">
				<label class="select-all">
					<input
						type="checkbox"
						checked={selected.length === shown.length}
						indeterminate={selected.length > 0 && selected.length < shown.length}
						onchange={(event) => tickAll(event.currentTarget.checked)}
					/>
					{m.export.selectAll}
					{#if selected.length}<span>· {m.export.selectedCount(selected.length)}</span>{/if}
				</label>
				{#if selected.length}<ListPicker variant="button" words={selected.map((item) => item.word)} />{/if}
			</div>
			<ul class="ui-card list">
				{#each shown as item (item.word)}
					{@const summary = summaries.get(item.word)}
					{@const exportedAt = saved.exportedAt(item.word)}
					<li>
						<input
							type="checkbox"
							aria-label={m.export.select(item.word)}
							checked={ticked.has(item.word)}
							onchange={(event) => (event.currentTarget.checked ? ticked.add(item.word) : ticked.delete(item.word))}
						/>
						<Headword text={summary?.headword ?? item.word} size="sm" href={wordPath(item.word)} />
						<!-- As a dictionary runs an entry on: the word, what it is, what it means -->
						<span class="glosses">
							{#if summary}<Grammar pos={summary.pos} inline /> {summary.glosses.join('; ')}{/if}
							<!-- Its lists, other than the one in view -->
							{#each saved.listsOf(item.word) as list (list.id)}
								{#if list.id !== current?.id}<span class="ui-badge">{list.name}</span>{/if}
							{/each}
						</span>
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
		{/if}

		<div class="actions">
			<DropdownMenu.Root onOpenChange={onMenuOpen}>
				<DropdownMenu.Trigger class="ui-btn" disabled={exporting || !shown.length}>
					<Icon name="download" size={16} />
					{exporting ? m.export.working : m.export.button}
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content class="ui-popover ui-menu" align="start" sideOffset={6} collisionPadding={8}>
						<DropdownMenu.RadioGroup value={scope} onValueChange={(value) => (scope = value as Scope)}>
							<DropdownMenu.GroupHeading class="ui-menu-heading">
								{current ? m.lists.whichIn(current.name) : m.export.which}
							</DropdownMenu.GroupHeading>
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
						<DropdownMenu.Separator class="ui-menu-separator" />
						<DropdownMenu.Group>
							<DropdownMenu.GroupHeading class="ui-menu-heading">{m.export.send}</DropdownMenu.GroupHeading>
							<DropdownMenu.Item class="ui-menu-item" onSelect={sendToAnkiApp}>
								{m.export.ankiSend}
								<span class="ui-menu-note">{m.export.ankiNeeds}</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item class="ui-menu-item" onSelect={() => (settingsOpen = true)}>
								{m.export.ankiSettings.open}
								<span class="ui-menu-note">{m.export.ankiSettings.deck}: {ankiSettings.deck}</span>
							</DropdownMenu.Item>
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
			<!-- Not built yet: shown so that the way it will go is visible -->
			<button type="button" class="ui-btn ui-btn-planned" disabled>
				{m.review.planned.list} <span class="planned">{m.review.planned.note}</span>
			</button>
			<!-- From a list, the review is of that list alone -->
			<a class="ui-btn" href={current ? `/review?list=${current.id}` : '/review'}>{m.review.practise}</a>
		</div>
		{#if notice}
			<div class="anki-note" data-tone={notice.tone} role="status">
				<span class="mark"><Icon name={notice.tone === 'error' ? 'x' : 'check'} size={14} /></span>
				<div>
					<p class="title">{notice.title}</p>
					{#if notice.body}<p>{notice.body}</p>{/if}
					{#if notice.steps}
						<ol>
							{#each notice.steps as step (step)}<li>{step}</li>{/each}
						</ol>
					{/if}
					{#if notice.tone === 'error'}
						<div class="note-actions">
							{#if notice.addon}
								<a class="ui-btn primary" href={ANKI_CONNECT_PAGE} target="_blank" rel="noopener noreferrer">
									{m.export.ankiGet} <span aria-hidden="true">↗</span>
								</a>
							{/if}
							{#if notice.settings}
								<button type="button" class="ui-btn primary" onclick={() => (settingsOpen = true)}>
									{m.export.ankiSettings.title}
								</button>
							{/if}
							<button type="button" class="ui-btn" disabled={exporting} onclick={sendToAnkiApp}>
								{m.export.ankiRetry}
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}

	<AnkiSettingsDialog bind:open={settingsOpen} settings={ankiSettings} onsave={saveAnkiSettings} />

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
		padding-top: 1.75rem;
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1rem;
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
		border-radius: var(--radius-lg);
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

	/* One chip for every word and one per list; the one in view is filled */
	.lists {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}

	.lists .ui-chip {
		gap: 0.4rem;
		max-width: 100%;
		overflow-wrap: anywhere;
		text-align: start;
	}

	/* How many words: quieter than the name, in whichever colour the chip has */
	.count {
		font-weight: 500;
		opacity: 0.75;
	}

	/* What can be done to the list in view, or the box that renames it */
	.list-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	.list-tools .ui-field {
		width: min(18rem, 100%);
		padding-block: 0.4rem;
	}

	.problem {
		flex-basis: 100%;
		color: var(--stress);
		font-size: var(--text-sm);
	}

	.no-words {
		max-width: 30rem;
		color: var(--on-page);
	}

	/* "Select all" and, once a word is ticked, the button that sorts the
	   ticked words into lists. As tall as that button from the start, so the
	   words do not jump when it appears. */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem 1rem;
		min-height: 2.3rem;
		margin-bottom: 0.5rem;
	}

	.glosses .ui-badge {
		margin-left: 0.3rem;
		vertical-align: 0.1em;
	}

	/* Lined up with the boxes of the list under it */
	.select-all {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: fit-content;
		margin: 0 0 0 calc(1.1rem + 1px);
		color: var(--on-page);
		font-size: var(--text-sm);
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

	.glosses {
		color: var(--ink-2);
	}

	.planned {
		font-weight: 400;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	/* What came of an Anki export: a card with a coloured edge and a round mark */
	.anki-note {
		display: flex;
		gap: 0.75rem;
		max-width: 38rem;
		margin-top: 0.9rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.anki-note[data-tone='error'] {
		border-left-color: var(--stress);
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-ink);
	}

	.anki-note[data-tone='error'] .mark {
		background: var(--stress);
		color: var(--surface);
	}

	.anki-note .title {
		margin-bottom: 0.2rem;
		color: var(--ink);
		font-size: 1rem;
		font-weight: 700;
	}

	.anki-note ol {
		display: grid;
		gap: 0.25rem;
		margin: 0.3rem 0 0;
		padding-left: 1.2rem;
	}

	.note-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}

	/* The way out of the problem: the one filled button in the box */
	.note-actions .primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
		text-decoration: none;
	}

	.notice {
		margin-bottom: 1rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--stress);
		border-radius: var(--radius-md);
	}

	.account {
		display: grid;
		gap: 0.5rem;
		margin-top: 1.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	/* Phones: the meanings go under the word */
	@media (max-width: 600px) {
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
