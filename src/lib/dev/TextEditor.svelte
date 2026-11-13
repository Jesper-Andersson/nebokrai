<!-- The text editor of `npm run dev`: a switch in the corner of every page.
     With it on, a click on any text opens a box to change it, and Save writes
     the change into the source file the text comes from: src/lib/i18n.ts or
     the page it is written in. The dev server finds the place and does the
     writing (scripts/edit-text/plugin.ts); the page then updates by itself.

     English that is changed is also put on the list of what the Ukrainian has
     fallen behind on (src/lib/i18n-todo.json); the number on the switch is
     the length of that list.

     The frame loads this file only in `npm run dev` (+layout.svelte), so the
     built site has none of it. Its own words are English only and written
     here, not in i18n.ts: they are a tool's, not the site's. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { useSettings } from '#lib/settings.ts';

	/** A place in the source where the clicked text is written (scripts/edit-text/source.ts). */
	interface Spot {
		id: string;
		file: string;
		line: number;
		key: string | null;
		lang: 'en' | 'uk';
		text: string;
		holes: string[];
		kind: 'string' | 'template' | 'markup';
	}

	const settings = useSettings();

	// On or off is remembered for this tab, so it survives the reload that
	// follows some saves.
	const KEY = 'nebokrai-edit-text';
	let on = $state(false);
	let pending = $state(0);

	// The edit box. `clicked` is the text as the page had it; null: no box.
	let clicked = $state<string | null>(null);
	let stage = $state<'looking' | 'ready' | 'missing' | 'saving' | 'saved'>('looking');
	let spots = $state.raw<Spot[]>([]);
	let chosen = $state(0);
	let value = $state('');
	let pageFile = $state<string | null>(null);
	let note = $state('');
	let failed = $state('');

	let spot = $derived<Spot | undefined>(spots[chosen]);

	let root: HTMLElement | undefined = $state();
	let box: HTMLTextAreaElement | undefined = $state();

	async function ask<T>(path: string, body?: object): Promise<T> {
		const res = await fetch(
			`/__edit-text/${path}`,
			body && { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
		);
		const answer = await res.json();
		if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
		return answer;
	}

	const question = (text: string) => ({ text, route: page.route.id, lang: settings.lang });
	const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

	onMount(() => {
		try {
			on = sessionStorage.getItem(KEY) === '1';
		} catch {}
		ask<{ pending: number }>('pending').then(
			(answer) => (pending = answer.pending),
			() => {}
		);
	});

	function toggle() {
		on = !on;
		if (!on) close();
		try {
			sessionStorage.setItem(KEY, on ? '1' : '0');
		} catch {}
	}

	/** The piece of text under the pointer: a text of the element itself, not of the whole page. */
	function textAt(target: Element, x: number, y: number): string | null {
		if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && !target.value) {
			return target.placeholder || null;
		}
		const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
		const range = document.createRange();
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!node.nodeValue?.trim()) continue;
			range.selectNodeContents(node);
			for (const rect of range.getClientRects()) {
				if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) {
					return node.nodeValue;
				}
			}
		}
		return null;
	}

	async function open(text: string) {
		clicked = text;
		stage = 'looking';
		failed = '';
		note = '';
		try {
			const found = await ask<{ spots: Spot[]; page: string | null }>('locate', question(text));
			if (clicked !== text) return;
			spots = found.spots;
			pageFile = found.page;
			choose(0);
			stage = spots.length ? 'ready' : 'missing';
			await tick();
			box?.focus();
			box?.select();
		} catch (error) {
			spots = [];
			pageFile = null;
			stage = 'missing';
			failed = reason(error);
		}
	}

	function choose(index: number) {
		chosen = index;
		value = spots[index]?.text ?? '';
		failed = '';
	}

	function close() {
		clicked = null;
		spots = [];
	}

	async function save() {
		if (!spot || clicked === null || stage !== 'ready') return;
		const text = clicked;
		stage = 'saving';
		failed = '';
		try {
			const saved = await ask<{ file: string; marked: boolean; pending: number }>('save', {
				...question(text),
				id: spot.id,
				value
			});
			pending = saved.pending;
			note = saved.marked
				? `Saved to ${saved.file}. Its Ukrainian is marked for translation.`
				: `Saved to ${saved.file}.`;
			stage = 'saved';
			setTimeout(() => {
				if (clicked === text && stage === 'saved') close();
			}, 2500);
		} catch (error) {
			stage = 'ready';
			failed = reason(error);
		}
	}

	/** Vite opens a file of the project in the editor it finds running. */
	function inEditor(file: string, line = 1) {
		void fetch(`/__open-in-editor?file=${encodeURIComponent(`${file}:${line}:1`)}`).catch(() => {});
	}

	// The element the pointer is over is outlined while it has text to change
	let hovered: Element | null = null;

	function outline(element: Element | null) {
		if (element === hovered) return;
		hovered?.removeAttribute('data-edit-text');
		element?.setAttribute('data-edit-text', '');
		hovered = element;
	}

	$effect(() => {
		if (!on) return;

		// Before the page's own handlers, and instead of them: a click on a
		// link's text edits the text. Alt+click is an ordinary click; so is a
		// click on anything with no text under the pointer, such as an icon.
		const onClick = (event: MouseEvent) => {
			const target = event.target;
			if (event.button !== 0 || event.altKey || !(target instanceof Element) || root?.contains(target)) return;
			const text = textAt(target, event.clientX, event.clientY);
			if (text === null) return;
			event.preventDefault();
			event.stopPropagation();
			void open(text);
		};
		const onOver = (event: MouseEvent) => {
			const target = event.target;
			const editable =
				target instanceof Element &&
				!root?.contains(target) &&
				[...target.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim());
			outline(editable ? target : null);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && clicked !== null) {
				event.stopPropagation();
				close();
			}
		};

		document.addEventListener('click', onClick, true);
		document.addEventListener('mouseover', onOver, true);
		document.addEventListener('keydown', onKey, true);
		return () => {
			document.removeEventListener('click', onClick, true);
			document.removeEventListener('mouseover', onOver, true);
			document.removeEventListener('keydown', onKey, true);
			outline(null);
		};
	});

	function onBoxKey(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void save();
		}
	}

	const where = (s: Spot) => (s.key ? `${s.lang}.${s.key}` : s.file.replace(/^src\//, ''));
</script>

<div class="editor" bind:this={root}>
	{#if clicked !== null}
		<section class="panel" aria-label="Edit text">
			{#if stage === 'looking'}
				<p class="quiet">Looking for this text in the source…</p>
			{:else if stage === 'missing'}
				<p>
					<b>“{clicked.trim().slice(0, 80)}”</b> is not written in the site's source as it stands. It may come
					from the dictionary data, or be put together from several pieces.
				</p>
				{#if failed}<p class="failed">{failed}</p>{/if}
				<div class="row">
					{#if pageFile}
						<button type="button" class="ui-btn" onclick={() => inEditor(pageFile!)}>Open {pageFile}</button>
					{/if}
					<button type="button" class="ui-btn" onclick={close}>Close</button>
				</div>
			{:else if spot}
				{#if spots.length > 1}
					<fieldset>
						<legend>Written in {spots.length} places. Change which?</legend>
						{#each spots as s, i (s.id)}
							<label>
								<input type="radio" name="edit-text-spot" checked={i === chosen} onchange={() => choose(i)} />
								<span>{where(s)}</span>
								<span class="quiet">line {s.line}</span>
							</label>
						{/each}
					</fieldset>
				{:else}
					<p class="place"><span>{where(spot)}</span> <span class="quiet">{spot.file}, line {spot.line}</span></p>
				{/if}

				<textarea
					bind:this={box}
					bind:value
					class="ui-field"
					rows={Math.min(10, Math.max(2, Math.ceil(value.length / 48)))}
					aria-label="The text"
					spellcheck="true"
					lang={spot.lang}
					disabled={stage !== 'ready'}
					onkeydown={onBoxKey}
				></textarea>

				{#if spot.holes.length}
					<p class="quiet">Keep {spot.holes.join(' and ')} as written: the page fills that in.</p>
				{/if}
				{#if failed}<p class="failed">{failed}</p>{/if}

				{#if stage === 'saved'}
					<p class="saved">{note}</p>
				{:else}
					<div class="row">
						<button type="button" class="ui-btn ui-btn-primary" disabled={stage !== 'ready'} onclick={save}>
							Save
						</button>
						<button type="button" class="ui-btn" onclick={close}>Cancel</button>
						<button type="button" class="ui-btn file" onclick={() => inEditor(spot!.file, spot!.line)}>
							Open file
						</button>
					</div>
					<p class="quiet">
						{spot.lang === 'en' ? 'The Ukrainian will be marked for translation.' : 'Ukrainian: saved as it is.'}
						Ctrl+Enter saves, Esc closes.
					</p>
				{/if}
			{/if}
		</section>
	{/if}

	<button
		type="button"
		class="switch"
		aria-pressed={on}
		title="Click any text on the page to change it. Alt+click follows a link instead."
		onclick={toggle}
	>
		<span class="dot"></span>
		Edit text
		{#if pending}<span class="count">{pending} to translate</span>{/if}
	</button>
</div>

<style>
	/* Above everything the site itself puts over a page (the highest is 60) */
	.editor {
		position: fixed;
		bottom: 0.75rem;
		left: 0.75rem;
		z-index: 200;
		display: grid;
		justify-items: start;
		gap: 0.5rem;
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		box-shadow: var(--shadow);
		color: var(--ink-2);
		font-weight: 600;
		cursor: pointer;
	}

	.switch[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--ink);
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--border-strong);
	}

	.switch[aria-pressed='true'] .dot {
		background: var(--accent);
	}

	.count {
		padding-left: 0.5rem;
		border-left: 1px solid var(--border);
		color: var(--muted);
		font-weight: 400;
	}

	.panel {
		box-sizing: border-box;
		display: grid;
		gap: 0.6rem;
		width: min(30rem, calc(100vw - 1.5rem));
		padding: 0.9rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
	}

	p,
	fieldset {
		margin: 0;
	}

	fieldset {
		display: grid;
		gap: 0.3rem;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 0.3rem;
		padding: 0;
		font-weight: 600;
	}

	label {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		cursor: pointer;
	}

	.place span:first-child,
	label span:first-of-type {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	textarea {
		font-size: 1rem;
		line-height: 1.45;
		resize: vertical;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.file {
		margin-left: auto;
	}

	.quiet {
		color: var(--muted);
	}

	.saved {
		font-weight: 600;
	}

	.failed {
		color: var(--stress);
		font-weight: 600;
	}

	/* The text the next click would change. Set on the page's own elements,
	   which this component's scoped styles do not reach. */
	:global([data-edit-text]) {
		outline: 2px dashed var(--accent);
		outline-offset: 2px;
		cursor: text;
	}
</style>
