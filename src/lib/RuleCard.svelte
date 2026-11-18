<!-- A rule's card in the grammar practice (/practice): the rule, the endings
     of the case it asks for, and three real sentences with the noun in bold.

       New rule
       без → genitive
       without
       Genitive answers кого? чого?
       -а, -я      хлі́ба, учи́теля       Masculine
       -и, -і, -ї  води́, землі́, ста́нції  Feminine
       Людина не може жити без пові́тря.

     It opens unasked over the first sentence of a rule never met (`first`),
     and "Try it" (or Enter) closes it onto that sentence. After that it sits
     behind the "?" in the corner of each sentence's card, which this
     component draws where it is placed; opened from there before answering,
     the sentence counts as answered with help (PracticeGap.svelte, `onpeek`).

     A Bits UI Dialog: a sheet from the foot of the screen on a phone, a
     dialog in the middle on a wider one. The sentences are drawn from
     /api/practice as the card first opens, and none of them is about the
     noun being asked for (practice/rules.ts, `examplesFor`). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Dialog } from 'bits-ui';
	import Icon from '#lib/Icon.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import Translation from '#lib/Translation.svelte';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { introPath, lessonOfPoint } from '#lib/practice/intros.ts';
	import { meaningOfPoint, ruleOf, type Point } from '#lib/practice/points.ts';
	import { split, type Gap } from '#lib/practice/round.ts';
	import { endingsOf, examplesFor } from '#lib/practice/rules.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		point,
		gap,
		first,
		onpeek,
		refocus
	}: {
		point: Point;
		/** The sentence being asked: its noun is kept out of the examples. */
		gap: Gap;
		/** The rule is met here for the first time: the card opens unasked. */
		first: boolean;
		/** The card was opened from "?". */
		onpeek: () => void;
		/** Where focus goes when the card closes, if not back to "?". */
		refocus?: () => boolean;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let t = $derived(m.practice.rule);

	// Read once: each sentence makes its own card (PracticeGap is keyed by sentence)
	// svelte-ignore state_referenced_locally
	let open = $state(first);
	let go: HTMLElement | null = $state(null);

	let endings = $derived(endingsOf(point));
	/** The page of the lesson the rule is in, opened in a tab of its own so the round is kept. */
	let lesson = $derived(lessonOfPoint(point.id));
	let examples = $state.raw<Gap[] | null>(null);
	let asked = false;

	// The sentences are asked for once, as the card first opens; a few more
	// than are shown, as some may be about the noun being asked for
	async function load() {
		if (asked) return;
		asked = true;
		try {
			const res = await fetch(`/api/practice?points=${Array(6).fill(point.id).join(',')}`);
			examples = res.ok ? examplesFor(((await res.json()) as { gaps: Gap[] }).gaps, gap) : [];
		} catch {
			examples = [];
		}
	}

	onMount(() => {
		if (first) void load();
	});

	function opened(now: boolean) {
		if (!now) return;
		void load();
		onpeek();
	}
</script>

<Dialog.Root bind:open onOpenChange={opened}>
	<Dialog.Trigger class="ui-icon-btn rule-open" aria-label={t.open} title={t.open}>
		<Icon name="help" size={18} />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay class="ui-overlay" />
		<Dialog.Content
			class="ui-rule"
			onOpenAutoFocus={(event) => {
				// Enter closes it at once, as Next goes on: the button is where focus starts
				event.preventDefault();
				go?.focus();
			}}
			onCloseAutoFocus={(event) => {
				if (refocus?.()) event.preventDefault();
			}}
		>
			<Dialog.Close class="ui-icon-btn ui-rule-x" aria-label={t.close}>
				<Icon name="x" size={18} />
			</Dialog.Close>

			{#if first}<p class="ui-rule-new">{t.new}</p>{/if}
			<Dialog.Title class="ui-rule-title">
				{#if point.ask}
					<!-- A verb's pattern: дякувати + кому?, its case named in the line under the meaning -->
					<b lang="uk">{ruleOf(point)}</b>
				{:else}
					<b lang="uk">{point.cue}</b>
					<Icon name="arrow-right" size={16} />
					<Term id={point.case} />{#if point.number}&nbsp;{m.practice.ofNumber[point.number]}{/if}
				{/if}
			</Dialog.Title>
			<Dialog.Description class="ui-rule-meaning">{meaningOfPoint(m.practice.meaning, point, settings.lang)}</Dialog.Description>
			{#if point.ask}
				<p class="ui-rule-question"><Term id={point.case} /></p>
			{:else if HINTS[point.case]}
				<p class="ui-rule-question">
					{m.grammar.terms[point.case].name}
					{m.practice.answers}
					<span lang="uk">{HINTS[point.case]}</span>
				</p>
			{/if}

			{#if endings.length}
				<table class="ui-rule-endings">
					<caption class="ui-sr-only">{t.endings}</caption>
					<tbody>
						{#each endings as row, i (i)}
							<tr>
								<th scope="row">
									{#if row.ending}<span lang="uk">{row.ending}</span>{:else}<span class="ui-rule-same">{t.same}</span>{/if}
								</th>
								<td lang="uk"><Stressed text={row.words} /></td>
								<td class="ui-rule-kind">{row.kinds.map((kind) => m.grammar.terms[kind].name).join(' · ')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<!-- Their room is kept while they come, so the button does not move under the thumb -->
			<div class="ui-rule-examples" aria-busy={examples === null}>
				{#if examples?.length}
					<p class="ui-rule-label">{t.examples}</p>
					<ul>
						{#each examples as example (example.uk)}
							{@const parts = split(example)}
							<li>
								<p lang="uk">{parts.before}<b>{parts.word}</b>{parts.after}</p>
								<div lang="en"><Translation text={example.en} /></div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if lesson}
				<a class="ui-rule-explain" href={introPath(lesson)} target="_blank" rel="noopener">{m.intro.explain}</a>
			{/if}

			<Dialog.Close class="ui-btn ui-btn-primary ui-rule-go" bind:ref={go}>
				{first ? t.tryIt : t.resume}
				<Icon name="arrow-right" size={18} />
				<kbd class="ui-kbd">Enter</kbd>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* The "?" in the top corner of the sentence's card */
	:global(.rule-open) {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		color: var(--muted);
	}

	/* The lesson's page, under the examples */
	:global(.ui-rule-explain) {
		justify-self: start;
		color: var(--accent);
		font-size: var(--text-sm);
	}

	/* The card renders at the end of <body> (Bits UI's portal), where scoped styles do not reach */
	:global(.ui-rule) {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 50;
		box-sizing: border-box;
		display: grid;
		gap: 0.75rem;
		width: min(32rem, calc(100vw - 20px));
		max-height: calc(100dvh - 20px);
		padding: 1.35rem 1.5rem 1.25rem;
		translate: -50% -50%;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
	}

	:global(.ui-rule:focus-visible) {
		outline: none;
	}

	:global(.ui-rule p),
	:global(.ui-rule ul) {
		margin: 0;
	}

	:global(.ui-rule-x) {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		color: var(--muted);
	}

	:global(.ui-rule-new),
	:global(.ui-rule-label) {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	:global(.ui-rule-new) {
		margin-bottom: -0.6rem !important;
	}

	:global(.ui-rule-title) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem 0.45rem;
		margin: 0;
		padding-right: 2rem;
		font-size: var(--text-lg);
		font-weight: 700;
	}

	:global(.ui-rule-title b) {
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
		font-weight: 800;
	}

	:global(.ui-rule-meaning) {
		margin: -0.5rem 0 0 !important;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	:global(.ui-rule-question) {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	/* The endings: a short table, ruled as the form tables are, with no frame */
	:global(.ui-rule-endings) {
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	:global(.ui-rule-endings th),
	:global(.ui-rule-endings td) {
		padding: 0.3rem 0.9rem 0.3rem 0;
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: baseline;
	}

	:global(.ui-rule-endings tr:last-child > *) {
		border-bottom: 0;
	}

	:global(.ui-rule-endings th) {
		white-space: nowrap;
	}

	/* The words stay on one line where there is room. Below that they break
	   after a comma (води́, землі́, / ста́нції at 360 px), which keeps the label
	   beside them inside the card: a label is one word and cannot break */
	:global(.ui-rule-endings td[lang='uk']) {
		font-family: var(--font-reading);
		font-size: var(--text-lg);
		white-space: nowrap;
	}

	@media (max-width: 420px) {
		:global(.ui-rule-endings td[lang='uk']) {
			white-space: normal;
		}
	}

	:global(.ui-rule-kind),
	:global(.ui-rule-same) {
		color: var(--muted);
		font-weight: 400;
	}

	:global(.ui-rule-kind) {
		padding-right: 0 !important;
	}

	/* Three lines kept for the sentences while they come */
	:global(.ui-rule-examples) {
		display: grid;
		align-content: start;
		gap: 0.35rem;
		min-height: 9rem;
	}

	:global(.ui-rule-examples ul) {
		display: grid;
		gap: 0.5rem;
		padding: 0;
		list-style: none;
	}

	:global(.ui-rule-examples p[lang='uk']) {
		font-family: var(--font-reading);
		font-size: var(--text-lg);
		line-height: 1.35;
	}

	:global(.ui-rule-examples b) {
		font-family: var(--font-headword);
		font-weight: 800;
	}

	:global(.ui-rule-examples div[lang='en']) {
		font-size: var(--text-sm);
	}

	/* As Next is in the sentence's bar (PracticeGap.svelte) */
	:global(.ui-rule-go) {
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		min-height: 2.9rem;
		margin-top: 0.25rem;
	}

	/* No Enter key to press on a touch screen */
	@media (hover: none) {
		:global(.ui-rule-go kbd) {
			display: none;
		}
	}

	/* A phone: a sheet from the foot of the screen, under the thumb */
	@media (max-width: 600px) {
		:global(.ui-rule) {
			top: auto;
			bottom: 0;
			left: 0;
			width: 100%;
			max-height: 88dvh;
			padding: 1.25rem 1.1rem calc(1rem + env(safe-area-inset-bottom));
			translate: none;
			border-bottom: 0;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.ui-rule[data-state='open']) {
			animation: ui-pop var(--duration) ease-out;
		}

		@media (max-width: 600px) {
			:global(.ui-rule[data-state='open']) {
				animation: -global-rule-up var(--duration) ease-out;
			}
		}
	}

	@keyframes -global-rule-up {
		from {
			translate: 0 2rem;
			opacity: 0;
		}
	}
</style>
