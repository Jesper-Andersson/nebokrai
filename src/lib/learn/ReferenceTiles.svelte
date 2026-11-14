<!-- The pages for reading, at the foot of /learn: the alphabet, the common
     words and the grammar words, each a tile with its mark, its name and
     what it holds. The alphabet's mark is three letters, not a drawing. -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { COMMON_WORDS } from '#lib/browse.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		lettersKnown,
		letters,
		ready
	}: {
		/** Letters the alphabet drill counts as known, out of `letters`. */
		lettersKnown: number;
		letters: number;
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
			<a class="ui-card tile" href="/alphabet">
				<span class="mark letters" lang="uk" aria-hidden="true">АБВ</span>
				<span class="text">
					<b>{m.learn.tile.alphabet}</b>
					<span class="note">{ready ? m.learn.tile.letters(lettersKnown, letters) : ''}</span>
				</span>
				<Icon name="arrow-right" size={16} />
			</a>
		</li>
		<li>
			<a class="ui-card tile" href="/common-words">
				<span class="mark"><Icon name="message" size={22} /></span>
				<span class="text">
					<b>{m.learn.tile.common}</b>
					<span class="note">{m.learn.tile.commonNote(thousand)}</span>
				</span>
				<Icon name="arrow-right" size={16} />
			</a>
		</li>
		<li>
			<a class="ui-card tile" href="/grammar">
				<span class="mark"><Icon name="table" size={22} /></span>
				<span class="text">
					<b>{m.learn.tile.grammar}</b>
					<span class="note">{m.learn.tile.grammarNote}</span>
				</span>
				<Icon name="arrow-right" size={16} />
			</a>
		</li>
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

	.tiles {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tiles li {
		display: grid;
	}

	.tile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		color: var(--ink);
		text-decoration: none;
	}

	/* The mark in a soft square of the accent */
	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-md);
		background: var(--accent-soft);
		color: var(--accent);
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

	.note {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	@media (hover: hover) {
		.tile:hover {
			border-color: var(--accent);
		}
	}

	@media (max-width: 640px) {
		.tiles {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.6rem;
		}
	}
</style>
