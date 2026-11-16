<!-- The card over a double-clicked word: the one a word of an example sentence
     opens on the site (GlossWord.svelte there), drawn on someone else's page.

       скля́нка  noun · feminine
       скля́нку: accusative singular
       glass (drinking vessel)
       Open word →
       Data: Wiktionary, VESUM

     with how common the word is after its grammar, and the bookmark that
     saves it in the top right corner.

     It lives in a shadow root, so the page's styles do not reach it and its
     own do not leak out. Sizes are in px (times the Size setting), not rem: a rem here would be the
     page's, and pages set that to anything. -->
<script lang="ts">
	import type { Gloss } from '../../../src/lib/gloss.ts';
	import { commonality, type Commonality } from '../../../src/lib/labels.ts';
	import { plain } from '../../../src/lib/search/normalize.ts';
	import { wordPath } from '../../../src/lib/search/slug.ts';
	import { SITE, type SaveReply, type SaveRequest } from '../../lib/api.ts';
	import { messagesFor } from '../../lib/messages.ts';
	import { card, look } from './state.svelte.ts';

	const language = browser.i18n.getUILanguage();
	const m = messagesFor(language);

	// The frequency meter's bars: each 3 wide and 3 taller than the one before, on a 16 x 14 grid
	const LIT: Record<Commonality, number> = { 'very-common': 4, common: 3, uncommon: 2, rare: 1 };
	const BARS = [0, 1, 2, 3].map((i) => ({ x: i * 4.33, height: 5 + i * 3 }));

	const GAP = 6;
	const EDGE = 8;

	let width = $state(0);
	let height = $state(0);
	let viewport = $state({ width: window.innerWidth, height: window.innerHeight });

	let main = $derived(card.answer && (card.answer.phrase ?? card.answer.readings[0] ?? null));
	let others = $derived(card.answer ? (card.answer.phrase ? card.answer.readings : card.answer.readings.slice(1)) : []);

	// How common the word is. An answer the browser kept from before the site
	// sent `freq_rank` has none, and a word with no entry has no rank to show.
	let tier = $derived(main && !main.vesum_only && main.freq_rank !== undefined ? commonality(main.freq_rank) : null);
	let rank = $derived(main?.freq_rank?.toLocaleString(language.toLowerCase().startsWith('uk') ? 'uk' : 'en'));
	let frequency = $derived(tier ? `${m.tiers[tier]}. ${rank ? m.rankTitle(rank) : m.unranked}` : '');

	// Under the word; over it when there is no room below and there is above
	let x = $derived(Math.max(EDGE, Math.min(card.left, viewport.width - width - EDGE)));
	let below = $derived(card.bottom + GAP + height <= viewport.height - EDGE || card.top - GAP - height < EDGE);
	let y = $derived(below ? card.bottom + GAP : card.top - GAP - height);

	function grammar(gloss: Gloss): string {
		const tags = gloss.tags.filter((t) => t in m.tags).map((t) => m.tags[t]);
		return [m.pos[gloss.pos] ?? gloss.pos.replace(/_/g, ' '), ...tags].join(' · ');
	}

	// A form's label as the site writes it has its cases first, then the rest:
	// "nominative, accusative, vocative plural", "genitive masculine neuter
	// singular". A verb's has no case: "first-person present singular".
	const CASE = '(?:nominative|genitive|dative|accusative|instrumental|locative|vocative)';
	const CASES_FIRST = new RegExp(`^(${CASE}(?:, ${CASE})*)(?: (.+))?$`);

	function named(label: string): { cases: string; rest: string } {
		const found = CASES_FIRST.exec(label);
		return found ? { cases: found[1], rest: found[2] ?? '' } : { cases: '', rest: label };
	}

	// Saving (design A, "Nebokrai design – Extension card" in Figma): a bookmark
	// saves the word into the reader's account on the site, and their lists
	// then stand under it as chips. A chip only adds: taking a word out of one
	// list is done on the site.
	let account = $derived(main && !main.vesum_only && card.saved?.ok ? card.saved : null);
	let busy = $state(false);
	// What the last press led to, and for which word: the next word starts clean
	let note = $state.raw<{ asked: number; justSaved: boolean; problem: 'full' | 'failed' | null }>({
		asked: -1,
		justSaved: false,
		problem: null
	});
	let mine = $derived(note.asked === card.asked ? note : null);

	async function send(request: SaveRequest): Promise<SaveReply> {
		try {
			return (await browser.runtime.sendMessage(request)) ?? { ok: false, why: 'failed' };
		} catch {
			return { ok: false, why: 'failed' };
		}
	}

	/** Saves the word, into `list` when one is given, or removes it when it is saved and none is. */
	async function press(list?: string) {
		const state = card.saved;
		if (!main || !state?.ok || !state.signedIn || busy) return;
		const asked = card.asked;
		const saving = list !== undefined || !state.saved;
		busy = true;
		const reply = await send(
			saving ? { type: 'save', word: main.word, lists: list ? [list] : [] } : { type: 'unsave', word: main.word }
		);
		busy = false;
		if (asked !== card.asked) return;
		if (reply.ok) {
			card.saved = {
				...state,
				saved: saving,
				// A removed word leaves every list it was in
				lists: state.lists.map((l) => ({ ...l, has: saving && (l.has || l.id === list) }))
			};
			note = { asked, justSaved: saving && !state.saved, problem: null };
		} else if (reply.why === 'signed_out') card.saved = { ok: true, signedIn: false };
		else note = { asked, justSaved: false, problem: reply.why };
	}
</script>

<svelte:window onresize={() => (viewport = { width: window.innerWidth, height: window.innerHeight })} />

<!-- A word with its stressed vowel (letter + U+0301) in the stress colour: кни́га -->
{#snippet stressed(text: string)}{#each text.split(/(.́)/) as part, i (i)}{#if part.endsWith('́')}<span
				class="stress">{part}</span
			>{:else}{part}{/if}{/each}{/snippet}

<!-- What a form is, its case first and in bold: accusative, singular -->
{#snippet what(label: { cases: string; rest: string })}{#if label.cases}<b>{label.cases}</b>{#if label.rest}, {label.rest}{/if}{:else}{label.rest}{/if}{/snippet}

{#if card.open}
	<div
		class="card"
		data-theme={look.theme}
		data-font={look.font}
		data-size={look.size}
		role="dialog"
		aria-label="Nebokrai"
		style:left="{x}px"
		style:top="{y}px"
		bind:offsetWidth={width}
		bind:offsetHeight={height}
	>
		{#if main}
			{#if account?.signedIn}
				<button
					type="button"
					class="bookmark"
					aria-pressed={account.saved}
					aria-label={account.saved ? m.unsave : m.save}
					title={account.saved ? m.unsave : m.save}
					disabled={busy}
					onclick={() => press()}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
						><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg
					>
				</button>
			{/if}
			<p class="head">
				<b lang="uk">{@render stressed(main.headword)}</b>
				<span class="muted">{grammar(main)}</span>
				{#if tier}
					<!-- How common the word is, drawn as on the site (FrequencyMeter.svelte
					     there): its rank, and four bars, one more lit for each step up -->
					<span class="freq {tier}" role="img" aria-label={frequency} title={frequency}>
						{#if rank}<span>#{rank}</span>{/if}
						<svg viewBox="0 0 16 14" aria-hidden="true">
							{#each BARS as bar, i (i)}
								<rect class:lit={i < LIT[tier]} x={bar.x} y={14 - bar.height} width="3" height={bar.height} rx="1" />
							{/each}
						</svg>
					</span>
				{/if}
			</p>
			{#if main.meaning}
				<p class="meaning">{main.meaning}</p>
			{:else}
				<p class="muted">{m.noEntry}</p>
			{/if}
			<!-- Which form the page has (design C, "Nebokrai design – Extension card"
			     in Figma). One form: its spelling, then what it is. A spelling that
			     is several forms (склянки́ and скля́нки): each beside what it is. -->
			{#if main.forms.length === 1}
				{@const only = main.forms[0]}
				<dl class="facts">
					<dt>{m.form}</dt>
					<dd lang="uk">{@render stressed(only.form)}</dd>
					{#each only.labels.map(named) as label, i (i)}
						<dt>{label.cases ? m.case : m.grammar}</dt>
						<dd>{@render what(label)}</dd>
					{/each}
				</dl>
			{:else if main.forms.length}
				<dl class="facts">
					{#each main.forms as group (group.form)}
						<dt lang="uk">{@render stressed(group.form)}</dt>
						<dd>
							{#each group.labels.map(named) as label, i (i)}{#if i}<br />{/if}{@render what(label)}{/each}
						</dd>
					{/each}
				</dl>
			{/if}
			{#if others.length}
				<p class="also">
					{m.also}
					{#each others as other, i (i)}{#if i}{'; '}{/if}<b lang="uk">{@render stressed(other.headword)}</b>
						<span class="muted">{m.pos[other.pos] ?? other.pos}</span>{#if other.meaning}: {other.meaning}{/if}{/each}
				</p>
			{/if}
		{:else if card.answer || card.failed}
			<p>{m.missing}</p>
		{:else}
			<p class="muted" role="status">{m.loading}</p>
		{/if}
		{#if card.answer || card.failed}
			<div class="actions">
				{#if main && !main.vesum_only}
					<a href="{SITE}{wordPath(main.word)}" target="_blank" rel="noopener">{m.open} →</a>
				{:else if !main}
					<a href="{SITE}/?q={encodeURIComponent(plain(card.text))}" target="_blank" rel="noopener">{m.search}</a>
				{:else}
					<span></span>
				{/if}
				<span class="right">
					{#if account && !account.signedIn}
						<a class="quiet" href="{SITE}/saved" target="_blank" rel="noopener">{m.signIn}</a>
					{/if}
				</span>
			</div>
			{#if account?.signedIn && account.saved && account.lists.length}
				<div class="lists">
					<span class="muted">{#if mine?.justSaved}{m.saved}{' '}{/if}{m.addTo}</span>
					{#each account.lists as list (list.id)}
						<button
							type="button"
							class="chip"
							aria-pressed={list.has}
							disabled={list.has || busy}
							onclick={() => press(list.id)}>{list.name}</button
						>
					{/each}
				</div>
			{:else if mine?.justSaved}
				<p class="muted" role="status">{m.saved}</p>
			{/if}
			{#if mine?.problem}
				<p role="alert">{m[mine.problem]}</p>
			{/if}
			<!-- The credit Wiktionary's and VESUM's licences ask for, in full on that
			     page. A line of its own: beside the bookmark it read as part of saving. -->
			<p class="credit">
				<a class="quiet" href="{SITE}/sources" target="_blank" rel="noopener">{m.credit}</a>
			</p>
		{/if}
	</div>
{/if}

<style>
	/* The site's colours (src/app.css there): light, and its warm dark */
	.card {
		--surface: #ffffff;
		--border: #e3e0d6;
		--border-strong: #cdc9bc;
		--accent-soft: #e4edfb;
		--ink: #16181d;
		--ink-2: #3c4049;
		--muted: #646a76;
		--accent: #1f5fbf;
		--stress: #cf3d2e;
		--pill-1: #2e8540;
		--pill-2: #2f6fb5;
		--pill-3: #c08a1e;
		--pill-4: #8a8f99;
		--shadow-pop: 0 2px 6px rgb(22 24 29 / 0.08), 0 16px 48px rgb(22 24 29 / 0.18);

		position: fixed;
		z-index: 2147483647;
		box-sizing: border-box;
		display: grid;
		gap: calc(5px * var(--k));
		width: min(calc(336px * var(--k)), calc(100vw - 16px));
		padding: calc(13px * var(--k)) calc(14px * var(--k));
		border: 1px solid var(--border);
		border-radius: calc(16px * var(--k));
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
		font:
			400 calc(14px * var(--k)) / 1.45 system-ui,
			sans-serif;
		text-align: left;
	}

	/* The site's three themes. Dark is written twice, as on the site: chosen,
	   and asked for by the device while the reader has chosen none. */
	.card[data-theme='dark'] {
		--surface: #1b1a18;
		--border: #302e2a;
		--border-strong: #48453f;
		--accent-soft: #1b2a44;
		--ink: #f0ede7;
		--ink-2: #d4d0c8;
		--muted: #a39f96;
		--accent: #8db4f0;
		--stress: #e8645a;
		--pill-1: #4fae67;
		--pill-2: #5b95d9;
		--pill-3: #c9962e;
		--pill-4: #88847c;
		--shadow-pop: 0 2px 6px rgb(0 0 0 / 0.4), 0 16px 48px rgb(0 0 0 / 0.55);
	}

	@media (prefers-color-scheme: dark) {
		.card[data-theme='system'] {
			--surface: #1b1a18;
			--border: #302e2a;
			--border-strong: #48453f;
			--accent-soft: #1b2a44;
			--ink: #f0ede7;
			--ink-2: #d4d0c8;
			--muted: #a39f96;
			--accent: #8db4f0;
			--stress: #e8645a;
			--pill-1: #4fae67;
			--pill-2: #5b95d9;
			--pill-3: #c9962e;
			--pill-4: #88847c;
			--shadow-pop: 0 2px 6px rgb(0 0 0 / 0.4), 0 16px 48px rgb(0 0 0 / 0.55);
		}
	}

	.card[data-theme='sepia'] {
		--surface: #ecdfc6;
		--border: #cdbb98;
		--border-strong: #b3a07a;
		--accent-soft: #d0d3d6;
		--ink: #3b2f20;
		--ink-2: #54452f;
		--muted: #655740;
		--accent: #2b4a7a;
		--stress: #a8321f;
		--pill-1: #2c7338;
		--pill-2: #2f629c;
		--pill-3: #9c6a0e;
		--pill-4: #857b66;
		--shadow-pop: 0 2px 6px rgb(59 47 32 / 0.12), 0 16px 48px rgb(59 47 32 / 0.22);
	}

	/* Ukrainian words in the serif unless the reader picked Sans-serif, as on
	   the site. The faces are the device's own: the site's are not shipped. Georgia is left out: it sets
	   the stress mark beside its letter, not over it. */
	.card {
		--font-uk: 'Noto Serif', Cambria, 'Times New Roman', 'Liberation Serif', serif;
	}

	/* The Size setting: every length of the card is a multiple of --k, so the
	   card grows as a whole, text and room together. */
	.card {
		--k: 1;
	}

	.card[data-size='small'] {
		--k: 0.88;
	}

	.card[data-size='large'] {
		--k: 1.15;
	}

	.card[data-size='larger'] {
		--k: 1.3;
	}

	.card[data-font='sans'] {
		--font-uk: system-ui, sans-serif;
	}

	[lang='uk'] {
		font-family: var(--font-uk);
	}

	p {
		margin: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 calc(10px * var(--k));
	}

	.head b {
		font-size: calc(19px * var(--k));
		font-weight: 800;
	}

	/* Room for the bookmark, which stands in the card's top right corner */
	.card:has(> .bookmark) .head {
		padding-right: calc(26px * var(--k));
	}

	.freq {
		display: inline-flex;
		align-items: center;
		gap: calc(6px * var(--k));
		color: var(--muted);
		font-size: calc(12px * var(--k));
		font-weight: 600;
		white-space: nowrap;
	}

	.freq svg {
		flex: none;
		width: calc(16px * var(--k));
		height: calc(14px * var(--k));
	}

	.freq rect {
		fill: var(--border-strong);
	}

	.freq rect.lit {
		fill: var(--tier);
	}

	.freq.very-common {
		--tier: var(--pill-1);
	}

	.freq.common {
		--tier: var(--pill-2);
	}

	.freq.uncommon {
		--tier: var(--pill-3);
	}

	.freq.rare {
		--tier: var(--pill-4);
	}

	.stress {
		color: var(--stress);
	}

	.muted {
		color: var(--muted);
	}

	.meaning {
		font-size: calc(18px * var(--k));
		font-weight: 700;
		line-height: 1.3;
	}

	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: calc(2px * var(--k)) calc(12px * var(--k));
		margin: 0;
		padding-top: calc(6px * var(--k));
		border-top: 1px solid var(--border);
	}

	.facts dt {
		color: var(--muted);
	}

	.facts dd {
		margin: 0;
	}

	.facts b {
		font-weight: 700;
	}

	.also {
		padding-top: calc(6px * var(--k));
		border-top: 1px solid var(--border);
		color: var(--ink-2);
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(12px * var(--k));
		margin-top: calc(3px * var(--k));
		padding-top: calc(5px * var(--k));
		border-top: 1px solid var(--border);
	}

	.right {
		display: flex;
		align-items: center;
		gap: calc(12px * var(--k));
	}

	.bookmark {
		position: absolute;
		top: calc(11px * var(--k));
		right: calc(10px * var(--k));
		display: grid;
		padding: calc(2px * var(--k));
		border: 0;
		border-radius: calc(6px * var(--k));
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.bookmark svg {
		width: calc(18px * var(--k));
		height: calc(18px * var(--k));
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.bookmark[aria-pressed='true'] {
		color: var(--accent);
	}

	.bookmark[aria-pressed='true'] svg {
		fill: currentColor;
	}

	.lists {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(6px * var(--k));
	}

	.chip {
		padding: calc(2px * var(--k)) calc(10px * var(--k));
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink-2);
		font: inherit;
		font-size: calc(13px * var(--k));
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--ink);
		font-weight: 600;
		cursor: default;
	}

	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	a {
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}

	.credit {
		font-size: calc(12px * var(--k));
	}

	a.quiet {
		color: var(--muted);
		font-weight: 400;
	}

	a:hover {
		text-decoration: underline;
	}

	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: calc(2px * var(--k));
	}
</style>
