<!-- The alphabet as the trainer (/alphabet) sets it out: six groups, each a
     card with a switch that takes it into the practice, and its letters as
     tiles. A tile shows the letter, its Latin and how far the learner has got
     with it; pressed, it opens what there is to know of the letter under the
     tiles: name, sound, a word to meet it in, and its recording. -->
<script lang="ts">
	import { Switch } from 'bits-ui';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import { knownAmong, stateOf, type Progress } from '#lib/alphabet/drill.ts';
	import { GROUP_IDS, isSign, letterInfo, lettersOf, pair, type GroupId } from '#lib/alphabet/letters.ts';
	import { RECORDINGS } from '#lib/alphabet/recordings.ts';
	import { letterPath } from '#lib/browse.ts';
	import { commonsPage } from '#lib/commons.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		progress,
		chosen,
		ontoggle,
		onplay
	}: {
		progress: Progress;
		/** The groups switched on. The last one cannot be switched off. */
		chosen: readonly GroupId[];
		ontoggle: (group: GroupId, on: boolean) => void;
		/** Play the recording at this address. */
		onplay: (url: string) => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	/** The letter whose details are open, if any. */
	let open = $state<string | null>(null);
	let info = $derived(open === null ? undefined : letterInfo(open));
</script>

<div class="groups">
	{#each GROUP_IDS as id (id)}
		{@const letters = lettersOf([id])}
		{@const group = m.alphabet.group[id]}
		{@const on = chosen.includes(id)}
		<section class="ui-card group" class:off={!on}>
			<header>
				<h3 id="group-{id}">{group.name}</h3>
				<span class="muted">{m.alphabet.known(knownAmong(progress, letters), letters.length)}</span>
				<Switch.Root
					class="ui-switch"
					aria-label={m.alphabet.include(group.name)}
					checked={on}
					disabled={on && chosen.length === 1}
					onCheckedChange={(checked) => ontoggle(id, checked)}
				>
					<Switch.Thumb class="ui-switch-thumb" />
				</Switch.Root>
			</header>
			<p class="muted">{group.note}</p>

			<ul class="tiles" aria-labelledby="group-{id}">
				{#each letters as letter (letter)}
					{@const one = letterInfo(letter)!}
					{@const state = stateOf(progress[letter])}
					<li>
						<button
							type="button"
							class="tile"
							data-state={state}
							aria-expanded={open === letter}
							aria-controls="letter-details"
							onclick={() => (open = open === letter ? null : letter)}
						>
							<span class="glyph" lang="uk">{one.upper}{letter}</span>
							<span class="latin">{one.latin || m.alphabet.sign[letter]}</span>
							<span class="ui-sr-only">, {m.alphabet.state[state]}</span>
						</button>
					</li>
				{/each}
			</ul>

			{#if info && info.group === id}
				<div class="details" id="letter-details">
					<div class="head">
						<span class="big" lang="uk">{pair(info.letter)}</span>
						{#if RECORDINGS[info.letter]}
							{@const url = RECORDINGS[info.letter]}
							<button type="button" class="ui-icon-btn" aria-label={m.alphabet.details.listen} title={m.alphabet.details.listen} onclick={() => onplay(url)}>
								<Icon name="speaker" />
							</button>
							<!-- Its author and licence are on its Commons page, as for a word's recording -->
							<a class="more" href={commonsPage(url)}>{m.word.recording}</a>
						{/if}
						<button type="button" class="ui-icon-btn close" aria-label={m.alphabet.details.close} onclick={() => (open = null)}>
							<Icon name="x" size={18} />
						</button>
					</div>
					<dl>
						{#if info.latin}
							<div><dt>{m.alphabet.details.latin}</dt><dd class="strong">{info.latin}</dd></div>
						{/if}
						<div><dt>{m.alphabet.details.name}</dt><dd lang="uk">{info.name}</dd></div>
						<div>
							<dt>{m.alphabet.details.sound}</dt>
							<dd>
								{#if info.ipa}<span class="ipa">/{info.ipa}/</span>{/if}
								<!-- English only, as the dictionary's meanings are -->
								<span lang="en">{info.hint}</span>
							</dd>
						</div>
						<div>
							<dt>{m.alphabet.details.example}</dt>
							<dd>
								<Headword text={info.example} size="sm" href={wordPath(info.example)} />
								<span class="muted" lang="en">{info.meaning}</span>
							</dd>
						</div>
					</dl>
					{#if !isSign(info.letter)}
						<a class="more" href={letterPath(info.letter)}>{m.alphabet.details.words(info.upper)}</a>
					{/if}
				</div>
			{/if}
		</section>
	{/each}
</div>

<style>
	.groups {
		display: grid;
		gap: 1rem;
	}

	.group {
		display: grid;
		gap: 0.6rem;
		padding: 1rem 1.25rem 1.25rem;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.75rem;
	}

	h3 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	/* The switch at the right edge, whatever the name's length */
	header :global(.ui-switch) {
		margin-left: auto;
	}

	p,
	dl,
	dd {
		margin: 0;
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.tiles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.25rem 0 0;
		padding: 0;
		list-style: none;
	}

	.tile {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.1rem;
		min-width: 3.6rem;
		padding: 0.5rem 0.6rem 0.4rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
	}

	@media (hover: hover) {
		.tile:hover {
			background: var(--surface-2);
		}
	}

	.tile[aria-expanded='true'] {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	/* How far the learner has got: no mark for a new letter, a ring for one
	   being learnt, a full dot for one that is known */
	.tile::after {
		content: '';
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
	}

	.tile[data-state='learning']::after {
		border: 1.5px solid var(--accent);
	}

	.tile[data-state='known']::after {
		background: var(--accent);
	}

	/* A group left out of the practice stands back; its letters can still be read */
	.off .tile {
		border-color: var(--border);
	}

	.off .glyph {
		color: var(--ink-2);
	}

	.glyph {
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
		font-weight: 800;
		line-height: 1.2;
	}

	.latin {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.details {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.25rem;
		padding: 0.9rem 1rem 1rem;
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.big {
		font-family: var(--font-headword);
		font-size: var(--headword-md);
		font-weight: 800;
		line-height: 1.1;
	}

	.close {
		margin-left: auto;
	}

	dl {
		display: grid;
		gap: 0.4rem;
	}

	dl div {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		align-items: baseline;
		gap: 0.75rem;
	}

	dt {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	dd {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.15rem 0.6rem;
	}

	.strong {
		font-weight: 700;
	}

	.ipa {
		font-family: var(--font-ipa);
	}

	.more {
		font-size: var(--text-sm);
	}
</style>
