<!-- Import words (design B, picked 2026-11-15): an Anki deck with its
     progress, or a word list from a .txt, .tsv or .csv file. The file is read
     here in the browser (src/lib/import/) and never uploaded; the server is
     only asked which dictionary word each written word is
     (POST /api/words/match). The preview puts the settings beside a table of
     every card: each row can be left out, and a card that matched nothing can
     be given its word by hand, from the guesses or a search. On Import the
     words are saved into a list (saved.svelte.ts), the cards keep their
     progress (review.svelte.ts), and the words that matched nothing are sent
     to POST /api/words/missing so the dictionary can grow. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Headword from '#lib/Headword.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import type { AnkiCollection } from '#lib/import/anki.ts';
	import { ankiDays, ankiItems, mainDeck, ukrainianFields, type ImportItem } from '#lib/import/deck.ts';
	import { MISSING_MAX } from '#lib/import/missing.ts';
	import { planImport, wordsToMatch, type Matches } from '#lib/import/plan.ts';
	import { readText } from '#lib/import/text.ts';
	import { listPath } from '#lib/lists.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { LEARNING, RELEARNING, REVIEW, dayNumber } from '#lib/review/fsrs.ts';
	import { MAX_LIST_NAME, MAX_SAVED, SUMMARY_MAX } from '#lib/saved.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { MATCH_MAX, SUGGEST_MAX } from '#lib/search/match.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordSummary } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	const saved = useSaved();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));
	let t = $derived(m.import);

	/** Rows shown at first, and added by each "Show more". */
	const PAGE = 50;

	type Stage = 'choose' | 'reading' | 'preview' | 'importing' | 'done';
	let stage = $state<Stage>('choose');
	let error = $state<string | null>(null);
	let fileName = $state('');
	let col = $state.raw<AnkiCollection | null>(null);
	let fieldOf = $state.raw(new Map<number, number>());
	let textItems = $state.raw<ImportItem[]>([]);
	let matches = $state.raw<Matches>({});
	let summaries = $state.raw(new Map<string, WordSummary>());
	let listName = $state('');
	let withSuspended = $state(false);
	/** A word chosen by hand, by the card's text. */
	const picks = new SvelteMap<string, string>();
	const skipWords = new SvelteSet<string>();
	const skipItems = new SvelteSet<string>();
	let tab = $state<'all' | 'none' | 'several' | 'suspended'>('all');
	let shown = $state(PAGE);
	let now = $state(Date.now());
	let result = $state<{ saved: number; cards: number; list: string; listId: string | null } | null>(null);

	let items = $derived(col ? ankiItems(col, now, fieldOf) : textItems);
	let plan = $derived(planImport(items, matches, { withSuspended, picks, skipWords, skipItems }));
	let suspendedCount = $derived(items.filter((i) => i.suspended).length);

	/** The note type most cards use, whose Ukrainian field the select changes. */
	let mainType = $derived.by(() => {
		if (!col) return null;
		const counts = new Map<number, number>();
		for (const note of col.notes) counts.set(note.type, (counts.get(note.type) ?? 0) + 1);
		const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
		return col.noteTypes.find((type) => type.id === top) ?? null;
	});

	// How far along the words to import are: the bar and its legend
	let tally = $derived.by(() => {
		let known = 0;
		let learning = 0;
		for (const card of plan.cards) {
			if (card.state === REVIEW) known++;
			else if (card.state === LEARNING || card.state === RELEARNING) learning++;
		}
		return { known, learning, fresh: plan.words.length - known - learning };
	});
	let room = $derived(MAX_SAVED - saved.items.length);
	let overflow = $derived(Math.max(0, plan.words.filter((w) => !saved.has(w)).length - room));

	interface Row {
		item: ImportItem;
		/** The first row of its card: the card's text is written only there. */
		first: boolean;
		word: string | null;
		/** The word was chosen by hand. */
		picked: boolean;
		status: 'in' | 'out' | 'none' | 'suspended';
	}

	function foundWords(item: ImportItem): string[] {
		const picked = picks.get(item.source);
		if (picked) return [picked];
		return [...new Set(item.words.map((w) => matches[w]?.word).filter((w): w is string => !!w))];
	}

	/** Matched by the dictionary itself, before any hand-picked word. */
	const autoFound = (item: ImportItem) => item.words.some((w) => matches[w]?.word);

	let rows = $derived.by(() => {
		const all: Row[] = [];
		for (const item of items) {
			const several = item.words.filter((w) => matches[w]?.word).length > 1;
			if (tab === 'none' && autoFound(item)) continue;
			if (tab === 'several' && !several) continue;
			if (tab === 'suspended' && !item.suspended) continue;
			const words = foundWords(item);
			const picked = picks.has(item.source);
			const out = skipItems.has(item.source);
			const parked = item.suspended && !withSuspended;
			if (!words.length) {
				all.push({ item, first: true, word: null, picked, status: out ? 'out' : parked ? 'suspended' : 'none' });
				continue;
			}
			words.forEach((word, i) => {
				const status = out || skipWords.has(word) ? 'out' : parked ? 'suspended' : 'in';
				all.push({ item, first: i === 0, word, picked, status });
			});
		}
		return all;
	});
	let counts = $derived({
		all: items.length,
		none: items.filter((i) => !autoFound(i)).length,
		several: items.filter((i) => i.words.filter((w) => matches[w]?.word).length > 1).length,
		suspended: suspendedCount
	});

	/** Suggestions for a card that matched nothing: those of each of its words, three at most. */
	// An ending (-ий) is an entry too, and never the word a card meant
	const guesses = (item: ImportItem) =>
		[...new Set(item.words.flatMap((w) => matches[w]?.suggestions ?? []))].filter((w) => !w.startsWith('-')).slice(0, 3);

	async function post<T>(url: string, body: unknown): Promise<T> {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(String(res.status));
		return res.json();
	}

	/** Ask the server about every written word not asked about yet, then for guesses and headwords. */
	async function matchAll(): Promise<void> {
		const ask = wordsToMatch(items).filter((w) => !(w in matches));
		let found: Matches = { ...matches };
		for (let i = 0; i < ask.length; i += MATCH_MAX) {
			const answer = await post<{ matches: Matches }>('/api/words/match', { words: ask.slice(i, i + MATCH_MAX) });
			found = { ...found, ...answer.matches };
		}
		matches = found;
		// Guesses cost the server several queries a word, so they go 20 at a time
		const missing = ask.filter((w) => !found[w]?.word);
		for (let i = 0; i < missing.length; i += SUGGEST_MAX) {
			const answer = await post<{ matches: Matches }>('/api/words/match', {
				words: missing.slice(i, i + SUGGEST_MAX),
				suggest: true
			});
			matches = { ...matches, ...answer.matches };
		}
		await summarise(Object.values(matches).flatMap((match) => (match.word ? [match.word] : [])));
	}

	/** The stressed headword and first meaning of each word, for the table. */
	async function summarise(words: string[]): Promise<void> {
		const ask = [...new Set(words)].filter((w) => !summaries.has(w));
		const next = new Map(summaries);
		for (let i = 0; i < ask.length; i += SUMMARY_MAX) {
			const answer = await post<{ words: WordSummary[] }>('/api/words/summary', { words: ask.slice(i, i + SUMMARY_MAX) });
			for (const summary of answer.words) next.set(summary.word, summary);
		}
		summaries = next;
	}

	const baseName = (name: string) => name.replace(/\.[^.]+$/, '').trim();
	const cut = (name: string) => [...name].slice(0, MAX_LIST_NAME).join('').trim();

	async function read(file: File): Promise<void> {
		stage = 'reading';
		error = null;
		fileName = file.name;
		col = null;
		textItems = [];
		matches = {};
		picks.clear();
		skipWords.clear();
		skipItems.clear();
		withSuspended = false;
		tab = 'all';
		shown = PAGE;
		now = Date.now();
		try {
			const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
			// "PK": a zip, which is what an Anki deck is, whatever its name
			if (head[0] === 0x50 && head[1] === 0x4b) {
				const [{ default: initSqlJs }, { default: wasm }, { decompress }, { fromSqlJs, readAnki }] = await Promise.all([
					import('sql.js'),
					import('sql.js/dist/sql-wasm-browser.wasm?url'),
					import('fzstd'),
					import('#lib/import/anki.ts')
				]);
				const SQL = await initSqlJs({ locateFile: () => wasm });
				const read = await readAnki(file, fromSqlJs(SQL), decompress);
				fieldOf = ukrainianFields(read);
				col = read;
				listName = cut(mainDeck(read) || baseName(file.name));
			} else {
				textItems = readText(await file.text()).items;
				listName = cut(baseName(file.name));
			}
		} catch {
			error = t.errors.unreadable;
			stage = 'choose';
			return;
		}
		if (!items.some((i) => i.words.length)) {
			error = t.errors.empty;
			stage = 'choose';
			return;
		}
		try {
			await matchAll();
			stage = 'preview';
		} catch {
			error = t.errors.network;
			stage = 'choose';
		}
	}

	function chose(event: Event & { currentTarget: HTMLInputElement }): void {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) read(file);
	}

	async function changeField(index: number): Promise<void> {
		if (!mainType) return;
		fieldOf = new Map(fieldOf).set(mainType.id, index);
		picks.clear();
		skipItems.clear();
		try {
			await matchAll();
		} catch {
			error = t.errors.network;
		}
	}

	function toggle(row: Row, on: boolean): void {
		if (row.word && !on) skipWords.add(row.word);
		else if (row.word) {
			skipWords.delete(row.word);
			skipItems.delete(row.item.source);
		} else if (on) skipItems.delete(row.item.source);
		else skipItems.add(row.item.source);
	}

	// One search open at a time, under the card it is for
	let finding = $state<string | null>(null);
	let query = $state('');
	let found = $state.raw<{ word: string; headword: string; gloss: string }[] | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function openFind(item: ImportItem): void {
		finding = item.source;
		query = item.words[0] ?? item.source;
		found = null;
		search();
	}

	function search(): void {
		clearTimeout(timer);
		const asked = query.trim();
		if (!asked) {
			found = null;
			return;
		}
		timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?${new URLSearchParams({ q: asked, limit: '6' })}`);
				if (!res.ok || asked !== query.trim()) return;
				const answer: { results: { word: string; headword: string; glosses: string[]; vesum_only?: boolean }[] } =
					await res.json();
				// A VESUM-only word has no entry, so it cannot be saved
				found = answer.results
					.filter((r) => !r.vesum_only)
					.map((r) => ({ word: r.word, headword: r.headword, gloss: r.glosses[0] ?? '' }));
			} catch {
				found = [];
			}
		}, 250);
	}

	async function pick(item: ImportItem, word: string, hit?: { headword: string; gloss: string }): Promise<void> {
		picks.set(item.source, word);
		skipItems.delete(item.source);
		finding = null;
		// A search result already says what the table shows; a guess is only the word
		if (hit) summaries = new Map(summaries).set(word, { word, headword: hit.headword, pos: '', glosses: [hit.gloss] });
		else {
			try {
				await summarise([word]);
			} catch {
				// The plain spelling stands in for the headword
			}
		}
	}

	function unpick(item: ImportItem): void {
		picks.delete(item.source);
	}

	/** What was not imported, one card to a line, for the visitor to keep. */
	let notImported = $derived([...plan.unmatched, ...plan.suspended, ...plan.leftOut].map((i) => i.source));
	function download(): void {
		const url = URL.createObjectURL(new Blob([notImported.join('\n') + '\n'], { type: 'text/plain' }));
		const link = Object.assign(document.createElement('a'), {
			href: url,
			download: `${baseName(fileName)} – not imported.txt`
		});
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	/** Tell the site which words it lacks. Nothing waits on it, and a failure is let go. */
	function sendMissing(): void {
		const words = [...new Set(plan.unmatched.flatMap((i) => i.words))];
		for (let i = 0; i < words.length; i += MISSING_MAX) {
			fetch('/api/words/missing', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ words: words.slice(i, i + MISSING_MAX) }),
				keepalive: true
			}).catch(() => {});
		}
	}

	async function runImport(): Promise<void> {
		stage = 'importing';
		error = null;
		const name = cut(listName) || cut(baseName(fileName));
		sendMissing();
		const count = await saved.importWords(plan.words, name);
		if (count === null) {
			error = t.errors.save;
			stage = 'preview';
			return;
		}
		await review.importCards(plan.cards, col ? ankiDays(col) : {}).catch(() => {});
		const list = saved.lists.find((l) => l.name === name);
		result = { saved: plan.words.length, cards: plan.cards.length, list: name, listId: list?.id ?? null };
		stage = 'done';
	}

	function again(): void {
		stage = 'choose';
		result = null;
		col = null;
		textItems = [];
	}

	let when = $derived(new Intl.RelativeTimeFormat(settings.lang, { numeric: 'auto' }));
	function nextReview(due: number): string {
		const days = dayNumber(due) - dayNumber(Date.now());
		if (days < 1) return when.format(0, 'day');
		if (days < 45) return when.format(days, 'day');
		if (days < 365 * 2) return when.format(Math.round(days / 30.4), 'month');
		return when.format(Math.round(days / 365), 'year');
	}

	let cardsByWord = $derived(new Map(plan.cards.map((c) => [c.word, c])));
	// A row left out or parked shows the progress its card would bring
	const progressOf = (row: Row) => (row.word && (cardsByWord.get(row.word) ?? row.item.progress)) || null;

	let back = $derived(page.url.searchParams.get('to') === 'list' ? 'list' : 'review');
	const fmt = (n: number) => n.toLocaleString(settings.lang === 'uk' ? 'uk' : 'en');
</script>

<PageMeta title="{m.pageTitle.import} · Nebokrai" description={m.meta.import} />

<div class="ui-page import" class:wide={stage === 'preview' || stage === 'importing'}>
	<header>
		<h1 class="ui-title">{t.title}</h1>
		{#if stage === 'preview' || stage === 'importing'}
			<p class="from">
				<span>
					<b>{fileName}</b> · {col ? t.anki : t.text} · {col ? t.cards(items.length) : t.lines(items.length)}
				</span>
				<label class="another">
					{t.another}
					<input class="ui-sr-only" type="file" accept=".apkg,.colpkg,.txt,.tsv,.csv,text/plain,text/csv" onchange={chose} />
				</label>
			</p>
		{/if}
	</header>

	{#if stage === 'choose' || stage === 'reading'}
		<section class="start">
			<p>{t.intro}</p>
			<label class="ui-btn ui-btn-primary pick" aria-disabled={stage === 'reading'}>
				{stage === 'reading' ? t.reading : t.choose}
				<input
					class="ui-sr-only"
					type="file"
					accept=".apkg,.colpkg,.txt,.tsv,.csv,text/plain,text/csv"
					disabled={stage === 'reading'}
					onchange={chose}
				/>
			</label>
			<p class="note">{t.kinds}</p>
			<p class="note">{t.private}</p>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</section>
	{:else if stage === 'done' && result}
		<section class="ui-card done" role="status">
			<h2>{t.done.title}</h2>
			<p>{t.done.saved(result.saved, result.list)}</p>
			{#if result.cards}<p>{t.done.cards(result.cards)}</p>{/if}
			<div class="go">
				{#if back === 'list' && result.listId}
					<a class="ui-btn ui-btn-primary" href={listPath(result.listId)}>{t.done.list}</a>
					<a class="ui-btn" href="/review">{t.done.review}</a>
				{:else}
					<a class="ui-btn ui-btn-primary" href="/review">{t.done.review}</a>
					{#if result.listId}<a class="ui-btn" href={listPath(result.listId)}>{t.done.list}</a>{/if}
				{/if}
				<button class="ui-btn" type="button" onclick={again}>{t.done.again}</button>
			</div>
		</section>
	{:else}
		<aside class="ui-card side">
			<p class="lead"><b>{fmt(plan.words.length)}</b> {t.ready(plan.words.length, !!col)}</p>
			{#if col && plan.words.length}
				<div>
					<div class="bar" aria-hidden="true">
						<i class="known" style:width="{(tally.known / plan.words.length) * 100}%"></i>
						<i class="learning" style:width="{(tally.learning / plan.words.length) * 100}%"></i>
					</div>
					<p class="legend">
						<span><i class="key known"></i>{t.known(tally.known)}</span>
						<span><i class="key learning"></i>{t.learning(tally.learning)}</span>
						<span><i class="key fresh"></i>{t.fresh(tally.fresh)}</span>
					</p>
				</div>
			{/if}
			{#if mainType && mainType.fields.length > 1}
				<label class="field">
					<span>{t.field}</span>
					<select
						class="ui-field"
						value={fieldOf.get(mainType.id) ?? 0}
						disabled={stage === 'importing'}
						onchange={(e) => changeField(Number(e.currentTarget.value))}
					>
						{#each mainType.fields as name, i (i)}
							<option value={i}>{name}</option>
						{/each}
					</select>
				</label>
			{/if}
			<label class="field">
				<span>{t.list}</span>
				<input class="ui-field" maxlength={MAX_LIST_NAME} bind:value={listName} disabled={stage === 'importing'} />
			</label>
			{#if suspendedCount}
				<label class="check">
					<input type="checkbox" bind:checked={withSuspended} disabled={stage === 'importing'} />
					<span>{t.suspended(suspendedCount)}</span>
				</label>
			{/if}
			{#if overflow}<p class="warn">{t.full(overflow)}</p>{/if}
			<button
				class="ui-btn ui-btn-primary go-btn"
				type="button"
				disabled={stage === 'importing' || !plan.words.length}
				onclick={runImport}
			>
				{stage === 'importing' ? t.going : t.go(plan.words.length)}
			</button>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<p class="note">{t.private}</p>
			{#if plan.unmatched.length}<p class="note">{t.missing}</p>{/if}
			{#if notImported.length}
				<button class="link note-link" type="button" onclick={download}>{t.download(notImported.length)}</button>
			{/if}
		</aside>

		<section class="cards">
			<RadioGroup.Root
				class="ui-segmented tabs"
				orientation="horizontal"
				aria-label={t.tabs.label}
				value={tab}
				onValueChange={(value) => {
					tab = value as typeof tab;
					shown = PAGE;
				}}
			>
				<RadioGroup.Item class="ui-segment" value="all">{t.tabs.all} {fmt(counts.all)}</RadioGroup.Item>
				<RadioGroup.Item class="ui-segment" value="none">{t.tabs.none} {fmt(counts.none)}</RadioGroup.Item>
				{#if counts.several}
					<RadioGroup.Item class="ui-segment" value="several">{t.tabs.several} {fmt(counts.several)}</RadioGroup.Item>
				{/if}
				{#if counts.suspended}
					<RadioGroup.Item class="ui-segment" value="suspended">
						{t.tabs.suspended} {fmt(counts.suspended)}
					</RadioGroup.Item>
				{/if}
			</RadioGroup.Root>

			{#if rows.length}
				<table>
					<thead>
						<tr>
							<th class="inc"><span class="ui-sr-only">{t.columns.include}</span></th>
							<th>{col ? t.columns.card : t.columns.line}</th>
							<th>{t.columns.word}</th>
							<th>{t.columns.progress}</th>
							{#if col}<th class="hide-narrow">{t.columns.next}</th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each rows.slice(0, shown) as row (row.item.source + ' ' + (row.word ?? ''))}
							{@const card = progressOf(row)}
							{@const summary = row.word ? summaries.get(row.word) : undefined}
							<tr class:out={row.status === 'out' || row.status === 'suspended'} class:next={!row.first}>
								<td class="inc">
									<input
										type="checkbox"
										checked={row.status !== 'out'}
										disabled={stage === 'importing' || row.status === 'suspended'}
										aria-label={t.include(row.word ?? row.item.source)}
										onchange={(e) => toggle(row, e.currentTarget.checked)}
									/>
								</td>
								<td class="source">{row.first ? row.item.source : ''}</td>
								<td class="word">
									{#if row.word}
										<Headword text={summary?.headword || row.word} size="sm" href={wordPath(row.word)} />
										{#if summary?.glosses[0]}<span class="gloss">{summary.glosses[0]}</span>{/if}
										{#if row.picked}
											<span class="gloss">
												{t.picked} ·
												<button class="link" type="button" onclick={() => unpick(row.item)}>{t.undo}</button>
											</span>
										{/if}
									{:else}
										<span class="none">{t.noMatch}</span>
										{#if row.status !== 'out'}
											<span class="chips">
												{#each guesses(row.item) as guess (guess)}
													<button class="ui-chip" type="button" lang="uk" onclick={() => pick(row.item, guess)}>
														{guess}
													</button>
												{/each}
												{#if finding !== row.item.source}
													<button
														class="ui-chip"
														type="button"
														aria-label={t.findLabel(row.item.source)}
														onclick={() => openFind(row.item)}>{t.find}</button
													>
												{/if}
											</span>
											{#if finding === row.item.source}
												<div class="find">
													<!-- svelte-ignore a11y_autofocus -->
													<input
														class="ui-field"
														type="search"
														autofocus
														aria-label={t.findLabel(row.item.source)}
														placeholder={t.findHint}
														bind:value={query}
														oninput={search}
														onfocus={(e) => e.currentTarget.select()}
														onkeydown={(e) => {
															if (e.key === 'Escape') finding = null;
														}}
													/>
													{#if found}
														{#if found.length}
															<ul>
																{#each found as hit (hit.word)}
																	<li>
																		<button type="button" onclick={() => pick(row.item, hit.word, hit)}>
																			<Headword text={hit.headword} size="sm" />
																			<span class="gloss">{hit.gloss}</span>
																		</button>
																	</li>
																{/each}
															</ul>
														{:else}
															<p class="gloss">{t.nothing}</p>
														{/if}
													{/if}
												</div>
											{/if}
										{/if}
									{/if}
								</td>
								<td>
									{#if row.status === 'out'}
										<span class="ui-badge tag-none">{t.state.out}</span>
									{:else if row.status === 'suspended'}
										<span class="ui-badge tag-none">{t.state.suspended}</span>
									{:else if row.status === 'none'}
										<span class="ui-badge tag-none">{t.state.none}</span>
									{:else if card?.state === REVIEW}
										<span class="ui-badge tag-known">{t.state.known}</span>
									{:else if card}
										<span class="ui-badge">{t.state.learning}</span>
									{:else}
										<span class="ui-badge">{t.state.fresh}</span>
									{/if}
								</td>
								{#if col}
									<td class="when hide-narrow">
										{#if card && row.status === 'in'}{nextReview(card.due)}{/if}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
				{#if rows.length > shown}
					<button class="link more" type="button" onclick={() => (shown += PAGE)}>
						{t.more(Math.min(PAGE, rows.length - shown))}
					</button>
				{/if}
			{:else}
				<p class="note">{t.empty}</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.import {
		display: grid;
		gap: 2rem;
		align-content: start;
		max-width: var(--prose);
		padding-block: 2rem 4rem;
	}

	.import.wide {
		grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
		align-items: start;
		max-width: var(--page-wide);
	}

	.import.wide > header {
		grid-column: 1 / -1;
	}

	.from {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		align-items: baseline;
		margin: 0.4rem 0 0;
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	.from b {
		color: var(--ink);
		font-weight: 600;
	}

	.another {
		color: var(--accent);
		cursor: pointer;
	}

	.another:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.start {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
	}

	.start p {
		margin: 0;
	}

	.pick {
		cursor: pointer;
	}

	.pick:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.pick[aria-disabled='true'] {
		cursor: progress;
		opacity: 0.7;
	}

	.side {
		position: sticky;
		top: 1rem;
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}

	.lead {
		margin: 0;
	}

	.lead b {
		font-weight: 700;
	}

	.bar {
		display: flex;
		height: 0.4rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.known {
		background: var(--accent);
	}

	.learning {
		background: color-mix(in srgb, var(--accent) 45%, var(--surface));
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		margin: 0.5rem 0 0;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.key {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		margin-right: 0.35rem;
		border-radius: var(--radius-pill);
	}

	.key.fresh {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.field {
		display: grid;
		gap: 0.35rem;
		font-size: var(--text-sm);
	}

	.field span {
		color: var(--muted);
	}

	.check {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		font-size: var(--text-sm);
	}

	.check input,
	td.inc input {
		accent-color: var(--accent);
	}

	.check input {
		margin-top: 0.2rem;
	}

	.go-btn {
		justify-content: center;
	}

	.note,
	.warn,
	.error {
		margin: 0;
		font-size: var(--text-xs);
	}

	.note {
		color: var(--muted);
	}

	.start .note {
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	.warn,
	.error {
		color: var(--stress);
	}

	.start .error {
		font-size: var(--text-sm);
	}



	.cards {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
	}

	.cards :global(.tabs) {
		overflow-x: auto;
		max-width: 100%;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--border-strong);
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
		text-align: left;
	}

	td {
		padding: 0.5rem;
		border-bottom: 1px solid var(--border);
		vertical-align: baseline;
	}

	tr.next td {
		border-top: 0;
	}

	th.inc,
	td.inc {
		width: 1.5rem;
		padding-right: 0;
	}

	tr.out .source,
	tr.out .word {
		color: var(--muted);
	}

	tr.out .word :global(.headword) {
		opacity: 0.55;
	}

	.gloss {
		display: block;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.find .gloss {
		display: inline;
	}

	.none {
		color: var(--muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.35rem;
	}

	.find {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.5rem;
		max-width: 22rem;
	}

	.find ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.find li button {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.6rem;
		align-items: baseline;
		width: 100%;
		padding: 0.35rem 0.4rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.find li button:hover,
	.find li button:focus-visible {
		background: var(--surface-2);
	}

	.when {
		color: var(--muted);
		white-space: nowrap;
	}

	.tag-known {
		background: color-mix(in srgb, var(--accent) 18%, var(--surface));
		color: var(--ink);
	}

	.tag-none {
		border: 1px dashed var(--border-strong);
		background: none;
		color: var(--muted);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
	}

	/* after .link, whose font it narrows */
	.note-link {
		justify-self: start;
		font-size: var(--text-xs);
		text-align: left;
	}

	.more {
		justify-self: start;
		font-size: var(--text-sm);
	}

	.done {
		display: grid;
		gap: 0.75rem;
		padding: 1.5rem;
	}

	.done h2,
	.done p {
		margin: 0;
	}

	.done h2 {
		font-family: var(--font-heading);
	}

	.go {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	@media (max-width: 800px) {
		.import.wide {
			grid-template-columns: minmax(0, 1fr);
		}

		.side {
			position: static;
		}

		.hide-narrow {
			display: none;
		}

		td,
		th {
			padding-inline: 0.3rem;
		}
	}
</style>
