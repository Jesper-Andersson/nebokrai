<!-- The pages for looking things up, at the foot of /learn: the alphabet,
     the common words, the grammar words and the stories, each a row with its
     mark, its name and what it holds, two to a line (user's pick in Figma,
     2026-11-18). The grammar points have a part of the page of their own
     above, so they are not here. The alphabet's mark is three letters. -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { COMMON_WORDS } from '#lib/browse.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		lettersKnown,
		letters,
		stories,
		ready
	}: {
		/** Letters the alphabet drill counts as known, out of `letters`. */
		lettersKnown: number;
		letters: number;
		/** How many stories /read has: none, and its row is left out. */
		stories: number;
		ready: boolean;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// A thousand is written 1,000 in English and 1000 in Ukrainian
	let thousand = $derived(settings.lang === 'uk' ? String(COMMON_WORDS) : COMMON_WORDS.toLocaleString('en'));
</script>

<section class="part" aria-labelledby="learn-reference">
	<h2 id="learn-reference">{m.learn.reference}</h2>
	<ul class="tiles">
		<li>
			<a class="tile" data-kind="alphabet" href="/alphabet">
				<span class="mark letters" lang="uk" aria-hidden="true">АБВ</span>
				<span class="text">
					<b>{m.learn.tile.alphabet}</b>
					<span class="note">{ready ? m.learn.tile.letters(lettersKnown, letters) : ''}</span>
				</span>
				<Icon name="arrow-right" size={16} />
			</a>
		</li>
		<li>
			<a class="tile" data-kind="cards" href="/common-words">
				<span class="mark"><Icon name="message" size={22} /></span>
				<span class="text">
					<b>{m.learn.tile.common}</b>
					<span class="note">{m.learn.tile.commonNote(thousand)}</span>
				</span>
				<Icon name="arrow-right" size={16} />
			</a>
		</li>
		<li>
			<a class="tile" data-kind="grammar" href="/grammar">
				<span class="mark"><Icon name="table" size={22} /></span>
				<span class="text">
					<b>{m.learn.tile.grammar}</b>
					<span class="note">{m.learn.tile.grammarNote}</span>
				</span>
				<Icon name="arrow-right" size={16} />
			</a>
		</li>
		{#if stories}
			<li>
				<a class="tile" data-kind="stories" href="/read">
					<span class="mark"><Icon name="play" size={20} /></span>
					<span class="text">
						<b>{m.learn.tile.stories}</b>
						<span class="note">{m.learn.action.stories(stories)}</span>
					</span>
					<Icon name="arrow-right" size={16} />
				</a>
			</li>
		{/if}
	</ul>
</section>

<style>
	.part {
		display: grid;
		gap: 0.6rem;
	}

	h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.15;
	}

	/* Two to a line, each a row on a rule: links to read, not cards to press */
	.tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tiles li {
		display: grid;
		border-bottom: 1px solid var(--border);
	}

	.tile {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-height: 3.75rem;
		padding: 0.7rem 0;
		color: var(--ink);
		text-decoration: none;
	}

	.tile > :global(svg:last-child) {
		color: var(--on-page);
	}

	.tile:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	/* Each tile in the colour of its kind, the same three as the newcomer's
	   steps on /learn (routes/learn/+page.svelte): the letters a quiet ink
	   grey, the words the accent, the grammar its green. Until 2026-11-16
	   all three marks were in the accent. */
	[data-kind='alphabet'] {
		--kind: var(--ink-2);
		--kind-soft: color-mix(in srgb, var(--ink-2) 12%, var(--surface));
	}

	[data-kind='stories'] {
		--kind: var(--ink-2);
		--kind-soft: var(--surface-2);
	}

	[data-kind='cards'] {
		--kind: var(--accent);
		--kind-soft: var(--accent-soft);
	}

	[data-kind='grammar'] {
		--kind: var(--pill-1-line);
		--kind-soft: color-mix(in srgb, var(--pill-1-line) 14%, var(--surface));
	}

	/* The mark in a soft square of its kind's colour */
	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-md);
		background: var(--kind-soft);
		color: var(--kind);
	}

	.letters {
		font-family: var(--font-headword);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.text {
		display: grid;
		flex: 1;
		min-width: 0;
	}

	.text b {
		font-weight: 700;
		line-height: 1.3;
	}

	/* On the page, not on a card: full ink over a background photo */
	.note {
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	@media (hover: hover) {
		.tile:hover b {
			color: var(--accent);
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}

	@media (max-width: 640px) {
		.tiles {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
