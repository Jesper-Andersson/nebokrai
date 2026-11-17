<!-- A button that asks for a word the dictionary does not have, and the short
     form it opens: where a search finds nothing, and on the card of a word
     only VESUM knows. The form is a Bits UI Popover, like the correction form
     of SuggestEdit.svelte, whose panel styles (ui-suggest) it shares.

     The word stands at the top with each vowel a button: a tap marks the
     stress (ґудзикоцві́т), a second tap takes it off, and a third vowel moves
     the older of two marks. Then the English meaning, the part of speech, and,
     folded away, an example or where the word was seen, "native speaker" and
     a name for the credit. It is sent to /api/suggest as target `new-word`.

     After an English search (dog) the form is turned round: `english` is the
     search, which fills in the meaning, and the reader types the Ukrainian
     word, whose vowels then appear for the stress. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import { page } from '$app/state';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import {
		canAddWord,
		MAX_SUGGEST_NAME,
		MAX_SUGGEST_NOTE,
		MAX_SUGGEST_TEXT,
		NEW_WORD_POS,
		type NewWordPos
	} from '#lib/suggest.ts';
	import { useToasts } from '#lib/toasts.ts';
	import Turnstile from './Turnstile.svelte';

	let { word = '', english = null, label }: {
		/** The word as searched for; stress marks in it are taken as the reader's. */
		word?: string;
		/** An English search: the meaning to start from, with the Ukrainian word typed in the form. */
		english?: string | null;
		/** The button's text: "Add «ґудзикоцвіт»", "Add a meaning". */
		label: string;
	} = $props();

	const settings = useSettings();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));
	let a = $derived(m.addWord);

	// A signed-in reader is not asked for the bot check (see /api/suggest)
	let sitekey = $derived(page.data.user ? null : ((page.data.turnstile as string | null | undefined) ?? null));

	const STRESS = '́';
	const VOWELS = 'аеєиіїоуюяАЕЄИІЇОУЮЯ';

	// The Ukrainian word typed in the form, after an English search
	let ukrainian = $state('');
	let source = $derived(english === null ? word : canAddWord(ukrainian) ? ukrainian : '');

	// The word's letters without stress marks, and where it had marks
	let letters = $derived([...source.normalize('NFC').trim().replaceAll(STRESS, '')]);
	let typed = $derived.by(() => {
		const at: number[] = [];
		let i = -1;
		for (const ch of source.normalize('NFC').trim()) {
			if (ch === STRESS) {
				if (i >= 0) at.push(i);
			} else i++;
		}
		return at;
	});

	let open = $state(false);
	let stressed = $state<number[]>([]);
	let meaning = $state('');
	let pos = $state<NewWordPos>('unknown');
	let more = $state(false);
	let note = $state('');
	let native = $state(false);
	let name = $state('');
	let token = $state<string | null>(null);
	let check = $state<Turnstile>();
	let sending = $state(false);
	let problem = $state<string | null>(null);
	// The word typed after an English search already has an entry: link to it
	let known = $state<string | null>(null);

	// The same keeping of name and tick as the correction form, so a reader
	// who gave them there is not asked again
	const KEPT = 'suggest-sender';

	function opened(now: boolean) {
		problem = null;
		known = null;
		if (!now) return;
		ukrainian = '';
		stressed = typed.filter((i) => VOWELS.includes(letters[i] ?? '')).slice(0, 2);
		meaning = english?.trim() ?? '';
		pos = 'unknown';
		more = false;
		note = '';
		try {
			const kept = JSON.parse(localStorage.getItem(KEPT) ?? '{}');
			name = typeof kept.name === 'string' ? kept.name.slice(0, MAX_SUGGEST_NAME) : '';
			native = kept.native === true;
		} catch {
			// Nothing kept, or storage is off
		}
	}

	function tap(i: number) {
		if (stressed.includes(i)) stressed = stressed.filter((s) => s !== i);
		else stressed = [...stressed, i].slice(-2);
	}

	let headword = $derived(letters.map((ch, i) => (stressed.includes(i) ? ch + STRESS : ch)).join(''));
	let plainWord = $derived(letters.join(''));

	// Typing the word again moves the letters: the old marks would point at others
	function retyped() {
		stressed = typed.filter((i) => VOWELS.includes(letters[i] ?? '')).slice(0, 2);
		known = null;
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (sending || !meaning.trim() || !letters.length) return;
		if (sitekey && !token) {
			problem = m.report.check;
			return;
		}
		sending = true;
		problem = null;
		known = null;
		let status = 0;
		let others = 0;
		try {
			const response = await fetch('/api/suggest', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					target: 'new-word',
					word: plainWord,
					headword,
					pos,
					proposed: meaning,
					note,
					native,
					name,
					turnstile: token
				})
			});
			status = response.status;
			if (status === 200) others = Number((await response.json()).others) || 0;
		} catch {
			// No answer: the same message as a refusal
		}
		sending = false;
		if (status === 200) {
			try {
				localStorage.setItem(KEPT, JSON.stringify({ name: name.trim(), native }));
			} catch {
				// Storage is off: the next form asks again
			}
			open = false;
			toaster.addToast({ data: { title: a.thanks(others) } });
			return;
		}
		// The token went with this send and works once
		check?.reset();
		if (status === 409 && english !== null) known = plainWord;
		problem =
			status === 409 ? (english === null ? a.exists : a.known(plainWord))
			: status === 413 ? m.suggest.tooLong
			: status === 429 ? m.suggest.tooMany
			: status === 403 || status === 503 ? m.report.check
			: m.suggest.failed;
	}
</script>

<Popover.Root bind:open onOpenChange={opened}>
	<Popover.Trigger class="ui-btn">{label}</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="ui-popover ui-suggest ui-add-word" align="start" sideOffset={8} collisionPadding={8}>
			<form onsubmit={send}>
				{#if english !== null}
					<label>
						<span class="ui-suggest-label">{a.ukrainian}</span>
						<input
							class="ui-field"
							type="text"
							lang="uk"
							maxlength="60"
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
							placeholder={a.ukrainianPlaceholder}
							required
							bind:value={ukrainian}
							oninput={retyped}
						/>
					</label>
				{/if}
				{#if letters.length}
					<div>
						<h2 class="ui-add-word-head" lang="uk">
							{#each letters as ch, i (i)}
								{#if VOWELS.includes(ch)}
									<button
										type="button"
										class="ui-add-letter"
										aria-pressed={stressed.includes(i)}
										aria-label={a.stressOn(ch, i + 1)}
										onclick={() => tap(i)}
									>{ch}{#if stressed.includes(i)}{STRESS}{/if}</button>
								{:else}
									<span>{ch}</span>
								{/if}
							{/each}
						</h2>
						<p class="ui-suggest-small">{a.stressHint}</p>
					</div>
				{/if}
				<label>
					<span class="ui-suggest-label">{a.meaning}</span>
					<textarea
						class="ui-field"
						rows="2"
						maxlength={MAX_SUGGEST_TEXT}
						placeholder={a.meaningPlaceholder}
						required
						bind:value={meaning}
					></textarea>
				</label>
				<fieldset>
					<legend class="ui-suggest-label">{a.posLegend}</legend>
					<div class="ui-add-pos">
						{#each NEW_WORD_POS as p (p)}
							<button type="button" class="ui-chip" aria-pressed={pos === p} onclick={() => (pos = p)}>
								{a.pos[p]}
							</button>
						{/each}
					</div>
				</fieldset>
				{#if more}
					<label>
						<span class="ui-suggest-label">{a.note}</span>
						<textarea class="ui-field" rows="2" maxlength={MAX_SUGGEST_NOTE} bind:value={note}></textarea>
					</label>
					<label class="ui-suggest-tick">
						<input type="checkbox" bind:checked={native} />
						{m.suggest.native}
					</label>
					<label>
						<span class="ui-suggest-label">{m.suggest.name}</span>
						<input class="ui-field" type="text" maxlength={MAX_SUGGEST_NAME} autocomplete="name" bind:value={name} />
					</label>
				{:else}
					<button type="button" class="ui-add-more" aria-expanded="false" onclick={() => (more = true)}>
						{a.more}
					</button>
				{/if}
				{#if sitekey}<Turnstile bind:this={check} bind:token {sitekey} />{/if}
				<p class="ui-suggest-small">{m.suggest.licence}</p>
				{#if problem}
					<p class="ui-suggest-problem" role="alert">
						{problem}
						{#if known}<a href={wordPath(known)}>{a.open}</a>{/if}
					</p>
				{/if}
				<div class="ui-suggest-buttons">
					<button type="button" class="ui-btn" onclick={() => (open = false)}>{m.suggest.cancel}</button>
					<button type="submit" class="ui-btn ui-btn-primary" disabled={!meaning.trim() || !letters.length} aria-busy={sending}>
						{sending ? m.suggest.sending : m.suggest.send}
					</button>
				</div>
			</form>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	/* The panel is rendered at the end of <body> by Bits UI: global rules with a prefix */
	:global(.ui-add-word) {
		width: min(24rem, calc(100vw - 2rem));
	}

	:global(.ui-suggest h2.ui-add-word-head) {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		font-family: var(--font-headword);
		font-size: var(--headword-md);
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	/* A vowel to tap: the size of the letter, with a light ground so it reads as a key */
	:global(.ui-add-letter) {
		min-width: 1.4em;
		margin: 0 1px;
		padding: 0 0.1em;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	:global(.ui-add-letter[aria-pressed='true']) {
		border-color: var(--stress);
		color: var(--stress);
	}

	:global(.ui-add-word fieldset),
	:global(.ui-add-word legend) {
		margin: 0;
		padding: 0;
		border: 0;
	}

	:global(.ui-add-pos) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	:global(.ui-add-more) {
		justify-self: start;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
	}
</style>
