<!-- A word of an example sentence that tells what it is: pressed, or with a
     mouse rested on, it opens a small card under itself (design A in Figma,
     "Glosses", 2026-11-15):

       скля́нка  noun · feminine
       скля́нку: accusative singular
       glass (drinking vessel)
       Open word →                    [save]
       Want this card on any page? Get the extension   [x]

     Built as Term.svelte is: a Bits UI Popover, which a phone opens with a
     press, not a tooltip, which needs a pointer. The card is drawn at the end
     of <body>, so its styles are the global `ui-gloss` classes in app.css.
     It asks /api/gloss (docs/api.md) the first time it opens, with the words
     either side, so that ласка after будь reads as будь ла́ска, "please". -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import { dropHint, wantsHint } from '#lib/extension.ts';
	import type { Gloss, GlossAnswer } from '#lib/gloss.ts';
	import { messagesFor, posLabel, tagLabel } from '#lib/i18n.ts';
	import { useQuickSearch } from '#lib/quick-search.svelte.ts';
	import { plain } from '#lib/search/normalize.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import SaveButton from './SaveButton.svelte';
	import Stressed from './Stressed.svelte';

	let {
		text,
		before,
		after
	}: {
		/** The word as the sentence has it: склянку */
		text: string;
		/** The words either side, only when a space alone stands between (never across a comma). */
		before?: string;
		after?: string;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	const quick = useQuickSearch();

	// The same pause as a grammar word's note: a pointer passing along the
	// line opens nothing, one resting on a word does not wait long
	const HOVER_OPEN = 400;
	const HOVER_CLOSE = 300;

	/** The tags worth a word on a small card: what a learner needs to use it. */
	const SHOWN_TAGS = new Set(['masculine', 'feminine', 'neuter', 'perfective', 'imperfective']);

	let open = $state(false);
	let answer = $state.raw<GlossAnswer | null>(null);
	let failed = $state(false);
	// The card's last line offers the browser extension, which shows this card
	// on any page: to a visitor on a computer who has neither got it nor put
	// the line away (extension.ts). Asked each time the card opens.
	let hint = $state(false);

	let main = $derived(answer && (answer.phrase ?? answer.readings[0] ?? null));
	let others = $derived(answer ? (answer.phrase ? answer.readings : answer.readings.slice(1)) : []);

	async function ask() {
		const params = new URLSearchParams({ w: plain(text) });
		if (before) params.set('before', plain(before));
		if (after) params.set('after', plain(after));
		try {
			const response = await fetch(`/api/gloss?${params}`);
			if (!response.ok) throw new Error(String(response.status));
			answer = await response.json();
		} catch {
			failed = true;
		}
	}

	function onOpenChange(now: boolean) {
		if (now && !answer && !failed) void ask();
		if (now) hint = wantsHint();
	}

	function grammar(gloss: Gloss): string {
		const name = posLabel(m, gloss.pos).toLocaleLowerCase(settings.lang);
		const tags = gloss.tags.filter((t) => SHOWN_TAGS.has(t)).map((t) => tagLabel(m, settings.lang, t));
		return [name, ...tags].join(' · ');
	}

	function putHintAway() {
		dropHint();
		hint = false;
	}

	function search() {
		open = false;
		quick.openWith(plain(text));
	}
</script>

<Popover.Root bind:open {onOpenChange}
	><Popover.Trigger class={[...text].length === 1 ? 'ui-gloss-word short' : 'ui-gloss-word'} openOnHover openDelay={HOVER_OPEN} closeDelay={HOVER_CLOSE}
		>{text}</Popover.Trigger
	><Popover.Portal>
		<Popover.Content class="ui-popover ui-gloss" sideOffset={6} collisionPadding={8}>
			{#if main}
				<p class="ui-gloss-head">
					<b lang="uk"><Stressed text={main.headword} /></b>
					<span class="ui-gloss-muted">{grammar(main)}</span>
				</p>
				{#if main.forms.length}
					<p>
						{#each main.forms as group, i (group.form)}{#if i}{' · '}{/if}<span lang="uk"
								><Stressed text={group.form} /></span
							>: {group.labels.join('; ')}{/each}
					</p>
				{/if}
				{#if main.meaning}
					<p class="ui-gloss-meaning">{main.meaning}</p>
				{:else}
					<p class="ui-gloss-muted">{m.card.noEntry}</p>
				{/if}
				{#if others.length}
					<p class="ui-gloss-also">
						{m.word.gloss.also}
						{#each others as other, i (i)}{#if i}{'; '}{/if}<b lang="uk"><Stressed text={other.headword} /></b>
							<span class="ui-gloss-muted">{posLabel(m, other.pos).toLocaleLowerCase(settings.lang)}</span
							>{#if other.meaning}: {other.meaning}{/if}{/each}
					</p>
				{/if}
				{#if !main.vesum_only}
					<div class="ui-gloss-actions">
						<a href={wordPath(main.word)}>{m.word.gloss.open} →</a>
						<SaveButton word={main.word} headword={main.headword} size={18} />
					</div>
				{/if}
				{#if hint}
					<p class="ui-gloss-hint">
						<span>{m.word.gloss.hint} <a href="/extension" onclick={dropHint}>{m.word.gloss.getExtension}</a></span>
						<button type="button" aria-label={m.word.gloss.hideHint} title={m.word.gloss.hideHint} onclick={putHintAway}
							><Icon name="x" size={14} /></button
						>
					</p>
				{/if}
			{:else if answer || failed}
				<p>{m.word.gloss.missing}</p>
				<div class="ui-gloss-actions">
					<button type="button" onclick={search}>{m.word.gloss.search}</button>
				</div>
			{:else}
				<p class="ui-gloss-muted" role="status">{m.word.gloss.loading}</p>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
