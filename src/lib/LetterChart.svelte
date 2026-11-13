<!-- The alphabet as the trainer (/alphabet) sets it out: six groups, each a
     card with the group's name, what makes it a group, and its letters as
     tiles. Pressing a card anywhere but on a letter takes the group into the
     practice or out of it; a card that is in is tinted and ticked. A tile
     shows the letter, its Latin and how far the learner has got with it;
     pressed, it opens what there is to know of the letter under the tiles:
     name, sound, a word to meet it in, and its recording.

     The cards are kept low on purpose: on a desktop they stand in two columns
     of three and the whole alphabet is in sight without scrolling.

     The card is not itself a button (it holds buttons): the group's name is,
     and it is stretched over the card, with the tiles lying on top of it. -->
<script lang="ts">
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import { knownAmong, stateOf, type Progress } from '#lib/alphabet/drill.ts';
	import { GROUP_IDS, isSign, letterInfo, lettersOf, pair, type GroupId } from '#lib/alphabet/letters.ts';
	import { RECORDINGS } from '#lib/alphabet/recordings.ts';
	import { letterPath } from '#lib/browse.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		label,
		progress,
		chosen,
		ontoggle,
		onplay
	}: {
		/** What the cards are together, for a screen reader: "The letters". */
		label: string;
		progress: Progress;
		/** The groups being practised. The last one cannot be taken out. */
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

<section class="groups" aria-label={label}>
	{#each GROUP_IDS as id (id)}
		{@const letters = lettersOf([id])}
		{@const group = m.alphabet.group[id]}
		{@const on = chosen.includes(id)}
		<div class="ui-card group" class:on>
			<h3>
				<button
					type="button"
					class="pick"
					id="group-{id}"
					aria-pressed={on}
					disabled={on && chosen.length === 1}
					onclick={() => ontoggle(id, !on)}
				>
					{group.name}
				</button>
				<span class="known">{m.alphabet.known(knownAmong(progress, letters), letters.length)}</span>
			</h3>
			<span class="mark" aria-hidden="true">{#if on}<Icon name="check" size={14} />{/if}</span>
			<p class="note">{group.note}</p>

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
							{@const recording = RECORDINGS[info.letter]}
							<button type="button" class="ui-icon-btn" aria-label={m.alphabet.details.listen} title={m.alphabet.details.listen} onclick={() => onplay(recording.src)}>
								<Icon name="speaker" />
							</button>
							<!-- The recording this one was cut from: its author and licence are on its Commons page -->
							<a class="more" href={recording.page}>{m.word.recording}</a>
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
								{#if !isSign(info.letter)}
									<a class="more" href={letterPath(info.letter)}>{m.alphabet.details.words(info.upper)}</a>
								{/if}
							</dd>
						</div>
					</dl>
				</div>
			{/if}
		</div>
	{/each}
</section>

<style>
	.groups {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.6rem;
	}

	/* On a desktop the six stand three and three, the first three down the
	   left and the rest down the right. The page is 50rem at its widest
	   (--page), which gives a card 23rem: the eight letters of the longest
	   group, on one line. */
	@media (min-width: 52rem) {
		.groups {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-rows: repeat(3, auto);
			grid-auto-flow: column;
			gap: 0.75rem;
		}
	}

	/* A group: its name and its tick on a line, what makes it a group, then
	   its letters. A letter's details open under them. */
	.group {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'name mark'
			'note note'
			'tiles tiles'
			'details details';
		align-content: start;
		align-items: center;
		gap: 0.15rem 0.75rem;
		padding: 0.6rem 0.75rem 0.7rem;
	}

	/* In the practice: tinted with the flag's yellow, the logo's (--flag in app.css) */
	.group.on {
		border-color: var(--flag-line);
		background: var(--flag-soft);
	}

	@media (hover: hover) {
		.group:has(.pick:hover:not(:disabled)) {
			border-color: var(--border-strong);
		}

		.group.on:has(.pick:hover:not(:disabled)) {
			border-color: var(--flag-line);
			box-shadow: 0 0 0 1px var(--flag-line);
		}
	}

	h3 {
		grid-area: name;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.5rem;
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1rem;
		line-height: 1.25;
	}

	/* The name is the button; it reaches over the whole card, so pressing the
	   card anywhere that is not a letter presses it */
	.pick {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pick::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}

	/* The last group in the practice stays in */
	.pick:disabled {
		cursor: default;
	}

	.pick:focus-visible {
		outline: none;
	}

	.pick:focus-visible::after {
		outline: 2px solid var(--flag-line);
		outline-offset: 2px;
	}

	.known {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 400;
	}

	/* A ring that fills and takes a tick when the group is in */
	.mark {
		grid-area: mark;
		display: grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 1.5px solid var(--border-strong);
		border-radius: 50%;
		color: var(--flag-ink);
	}

	.on .mark {
		border-color: var(--flag-line);
		background: var(--flag);
	}

	p,
	dl,
	dd {
		margin: 0;
	}

	.note {
		grid-area: note;
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1.35;
	}

	.on .note,
	.on .known {
		color: var(--ink-2);
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* Over the stretched button; the room between the tiles still presses the card */
	.tiles {
		grid-area: tiles;
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0.35rem 0 0;
		padding: 0;
		list-style: none;
		pointer-events: none;
	}

	.tile {
		position: relative;
		display: grid;
		justify-items: center;
		min-width: 2.5rem;
		padding: 0.3rem 0.15rem 0.2rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		pointer-events: auto;
	}

	/* Fingers need a taller target than a mouse pointer does */
	@media (pointer: coarse) {
		.tile {
			padding-block: 0.5rem 0.4rem;
		}
	}

	@media (hover: hover) {
		.tile:hover {
			background: var(--surface-2);
		}
	}

	/* Open: a doubled edge, which shows on a tinted card as on a plain one */
	.tile[aria-expanded='true'] {
		border-color: var(--flag-line);
		box-shadow: 0 0 0 1px var(--flag-line);
	}

	/* How far the learner has got: no mark for a new letter, a ring for one
	   being learnt, a full dot for one that is known */
	.tile::after {
		content: '';
		position: absolute;
		top: 0.2rem;
		right: 0.2rem;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
	}

	.tile[data-state='learning']::after {
		border: 1.5px solid var(--flag-line);
	}

	.tile[data-state='known']::after {
		background: var(--flag-line);
	}

	.glyph {
		font-family: var(--font-headword);
		font-size: 1.1rem;
		font-weight: 800;
		line-height: 1.2;
	}

	.latin {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1.2;
	}

	/* On a phone a group's letters still go on one line: eight of them in 21rem */
	@media (max-width: 42rem) {
		.tile {
			min-width: 2.3rem;
			padding-inline: 0.1rem;
		}

		.glyph {
			font-size: 1.05rem;
		}
	}

	.details {
		grid-area: details;
		position: relative;
		z-index: 1;
		display: grid;
		gap: 0.5rem;
		margin-top: 0.45rem;
		padding: 0.6rem 0.9rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
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
		white-space: nowrap;
	}

	.close {
		margin-left: auto;
	}

	dl {
		display: grid;
		gap: 0.25rem;
	}

	dl div {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr);
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
