<!-- One part of a word's page that a reader can suggest a correction to: the
     headword, a meaning, an example, a form in the tables. The word page turns
     this on with its pencil button; until then `place` is null and the part is
     drawn as it always is, with nothing added around it.

     While on, the part gets a dotted outline and a click opens a Bits UI
     Popover with a short form: what the page says now, the reader's version,
     and optionally why and a name for the credit. It is sent to /api/suggest
     (src/lib/suggest.ts says what a place is).

     The outline is a button laid over the part, not a wrapper turned into a
     button: the part may hold a paragraph or a link, which a button may not. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import { MAX_SUGGEST_NAME, MAX_SUGGEST_NOTE, MAX_SUGGEST_TEXT, type SuggestPlace } from '#lib/suggest.ts';
	import { useToasts } from '#lib/toasts.ts';
	import Turnstile from './Turnstile.svelte';

	let { place, label, current, currentEn = null, block = false, children }: {
		/** Where this part is, or null while suggesting is off. */
		place: SuggestPlace | null;
		/** The part's name, over the form: "Meaning 2". */
		label: string;
		/** What the page shows now. */
		current: string;
		/** The English beside it, for a sentence that has one. */
		currentEn?: string | null;
		/** The part is a block (a heading, a sentence with its translation), not words in a line. */
		block?: boolean;
		children: Snippet;
	} = $props();

	const settings = useSettings();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));

	// A signed-in reader is not asked for the bot check (see /api/suggest)
	let sitekey = $derived(page.data.user ? null : ((page.data.turnstile as string | null | undefined) ?? null));

	let open = $state(false);
	let proposed = $state('');
	let proposedEn = $state('');
	let note = $state('');
	let native = $state(false);
	let name = $state('');
	let token = $state<string | null>(null);
	let check = $state<Turnstile>();
	let sending = $state(false);
	let problem = $state<string | null>(null);

	// The name and the tick are the same for every suggestion a reader sends,
	// so the browser keeps them. A browser that refuses storage just asks again.
	const KEPT = 'suggest-sender';

	function opened(now: boolean) {
		problem = null;
		if (!now) return;
		proposed = current;
		proposedEn = currentEn ?? '';
		note = '';
		try {
			const kept = JSON.parse(localStorage.getItem(KEPT) ?? '{}');
			name = typeof kept.name === 'string' ? kept.name.slice(0, MAX_SUGGEST_NAME) : '';
			native = kept.native === true;
		} catch {
			// Nothing kept, or storage is off
		}
	}

	let same = $derived(
		proposed.trim() === current.trim() && (currentEn === null || proposedEn.trim() === currentEn.trim())
	);

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (!place || sending || same || !proposed.trim()) return;
		if (sitekey && !token) {
			problem = m.report.check;
			return;
		}
		sending = true;
		problem = null;
		let status = 0;
		try {
			const response = await fetch('/api/suggest', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					...place,
					current,
					proposed,
					proposed_en: currentEn === null ? null : proposedEn,
					note,
					native,
					name,
					turnstile: token
				})
			});
			status = response.status;
		} catch {
			// No answer: the same message as a refusal
		}
		sending = false;
		if (status === 200) {
			try {
				localStorage.setItem(KEPT, JSON.stringify({ name: name.trim(), native }));
			} catch {
				// Storage is off: the next suggestion asks again
			}
			open = false;
			toaster.addToast({ data: { title: m.suggest.thanks } });
			return;
		}
		// The token went with this send and works once
		check?.reset();
		problem =
			status === 404 ? m.suggest.gone
			: status === 413 ? m.suggest.tooLong
			: status === 429 ? m.suggest.tooMany
			: status === 403 || status === 503 ? m.report.check
			: m.suggest.failed;
	}
</script>

{#if place}
	<svelte:element this={block ? 'div' : 'span'} class="part" class:block>
		{@render children()}
		<Popover.Root bind:open onOpenChange={opened}>
			<Popover.Trigger class="ui-suggest-hit" aria-label={m.suggest.open(label)} />
			<Popover.Portal>
				<Popover.Content class="ui-popover ui-suggest" align="start" sideOffset={8} collisionPadding={8}>
					<form onsubmit={send}>
						<h2>{label}</h2>
						<div>
							<span class="ui-suggest-label">{m.suggest.now}</span>
							<p class="ui-suggest-now" lang={currentEn === null ? undefined : 'uk'}>
								{current}{#if currentEn}<br /><span lang="en">{currentEn}</span>{/if}
							</p>
						</div>
						<label>
							<span class="ui-suggest-label">{currentEn === null ? m.suggest.proposed : m.suggest.ukrainian}</span>
							<textarea
								class="ui-field"
								rows="2"
								maxlength={MAX_SUGGEST_TEXT}
								required
								bind:value={proposed}
							></textarea>
						</label>
						{#if currentEn !== null}
							<label>
								<span class="ui-suggest-label">{m.suggest.english}</span>
								<textarea class="ui-field" rows="2" maxlength={MAX_SUGGEST_TEXT} bind:value={proposedEn}></textarea>
							</label>
						{/if}
						<label>
							<span class="ui-suggest-label">{m.suggest.note}</span>
							<textarea
								class="ui-field"
								rows="2"
								maxlength={MAX_SUGGEST_NOTE}
								placeholder={m.suggest.notePlaceholder}
								bind:value={note}
							></textarea>
						</label>
						<label class="ui-suggest-tick">
							<input type="checkbox" bind:checked={native} />
							{m.suggest.native}
						</label>
						<label>
							<span class="ui-suggest-label">{m.suggest.name}</span>
							<input
								class="ui-field"
								type="text"
								maxlength={MAX_SUGGEST_NAME}
								autocomplete="name"
								bind:value={name}
							/>
						</label>
						{#if sitekey}<Turnstile bind:this={check} bind:token {sitekey} />{/if}
						<p class="ui-suggest-small">{m.suggest.licence}</p>
						{#if problem}<p class="ui-suggest-problem" role="alert">{problem}</p>{/if}
						<div class="ui-suggest-buttons">
							<button type="button" class="ui-btn" onclick={() => (open = false)}>{m.suggest.cancel}</button>
							<button
								type="submit"
								class="ui-btn ui-btn-primary"
								disabled={same || !proposed.trim()}
								aria-busy={sending}
							>
								{sending ? m.suggest.sending : m.suggest.send}
							</button>
						</div>
					</form>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	</svelte:element>
{:else}
	{@render children()}
{/if}

<style>
	/* The part keeps its place in the line; the button is laid over it */
	.part {
		position: relative;
		display: inline-block;
		max-width: 100%;
	}

	.part.block {
		display: block;
	}

	/* Bits UI renders the button and, at the end of <body>, the panel: their
	   rules are global and carry a prefix of their own. */
	:global(.ui-suggest-hit) {
		position: absolute;
		inset: -3px -5px;
		padding: 0;
		border: 1.5px dotted var(--muted);
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
	}

	:global(.ui-suggest-hit[data-state='open']) {
		border: 2px solid var(--accent);
	}

	@media (hover: hover) {
		:global(.ui-suggest-hit:hover) {
			border-color: var(--accent);
		}
	}

	/* The panel's own rules (ui-suggest) are in src/app.css: AddWord.svelte uses them on
	   pages where this component is not loaded. */
</style>
