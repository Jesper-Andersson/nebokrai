<!-- The radio: a round button in the bottom corner of every page, for those who
     switched it on in the settings. It opens a panel (a Bits UI Popover, which
     handles Escape, clicks outside and focus) with the stations, the volume
     and a way to put the button away again. The sound itself lives in
     radio.svelte.ts and goes on while the visitor moves between pages.

     The stations are plain buttons, not a radio group: in a group the arrow
     keys choose as they move, and each choice here would ring up a station. -->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { Popover } from 'bits-ui';
	import { messagesFor } from '#lib/i18n.ts';
	import { useRadio } from '#lib/radio.svelte.ts';
	import { KINDS, STATIONS } from '#lib/radio.ts';
	import { applySetting, useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import { useToasts } from './toasts.ts';

	const settings = useSettings();
	const radio = useRadio();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));

	let open = $state(false);
	/** The round button, as Bits UI drew it. */
	let trigger = $state<HTMLElement | null>(null);

	/** Fold the panel back into the round button. The keyboard goes with it: whoever pressed Enter here is not left on a button that is gone. */
	async function minimise() {
		open = false;
		await tick();
		trigger?.focus();
	}
	let current = $derived(radio.station);
	let playing = $derived(radio.status === 'playing');
	let label = $derived(radio.on ? m.radio.openPlaying(current.name) : m.radio.open);
	// Hovering the button says which song, without opening the panel
	let hint = $derived(radio.song ? `${current.name}: ${radio.song}` : label);
	let status = $derived(
		radio.status === 'loading'
			? m.radio.loading
			: radio.status === 'playing'
				? m.radio.playing
				: radio.status === 'failed'
					? m.radio.failed
					: current[settings.lang]
	);

	// The button is gone from the page, whichever way it was hidden (here or
	// in the settings): no sound may be left without the button that stops it.
	onDestroy(() => radio.stop());

	/** A press on a station: the one playing stops, any other starts. */
	function choose(id: string) {
		if (id === radio.stationId && radio.on) radio.stop();
		else radio.play(id);
	}

	function show(shown: boolean) {
		settings.radio = shown ? 'on' : 'off';
		applySetting('radio', settings.radio);
	}

	function hide() {
		open = false;
		show(false);
		// Say where it went: the settings menu is not where one looks first
		toaster.addToast({ data: { title: m.radio.hidden, undo: () => show(true) } });
	}
</script>

<!-- Four bars that rise and fall while there is sound, each to its own beat
     like a real level meter. The beats (how high each bar goes, and how
     long its round takes) are those of "audio" in SVG Loaders, copyright (c)
     2014 Sam Herbert, MIT licence (https://github.com/SamHerbert/SVG-Loaders;
     the licence is in src/lib/assets/licences/SVG-Loaders-MIT.txt).
     That drawing moves by SVG's own <animate>, which Chrome leaves standing
     for 1.4 seconds after it is put on the page (measured 2026-11-12): the
     sound came first and the bars after. Here the same beats are CSS
     keyframes, which start with the bars. `height` is the bars' height in
     pixels; the rest is in proportion, as in the drawing (55 wide to 80 high). -->
{#snippet bars(height: number)}
	<span class="bars" style="--size: {height}px" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
{/snippet}

<div class="radio" class:on={playing} class:connecting={radio.status === 'loading'}>
	<span class="halo" aria-hidden="true"></span>
	<Popover.Root bind:open>
		<Popover.Trigger
			bind:ref={trigger}
			class="ui-radio-btn"
			aria-label={label}
			title={hint}
			data-on={radio.on ? '' : undefined}
		>
			{#if playing}
				{@render bars(20)}
			{:else}
				<Icon name="radio" size={22} />
			{/if}
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content class="ui-popover ui-radio" side="top" align="end" sideOffset={10} collisionPadding={8}>
				<div class="now">
					<button
						type="button"
						class="main"
						aria-label={radio.on ? m.radio.stop : m.radio.play}
						title={radio.on ? m.radio.stop : m.radio.play}
						onclick={() => radio.toggle()}
					>
						<Icon name={radio.on ? 'stop' : 'play'} size={22} filled />
					</button>
					<p>
						<b lang="uk">{current.name}</b>
						<!-- What the station says it is playing: music stations only, and
						     not during speech or adverts (radio-now.ts) -->
						{#if radio.song}
							<span class="song">{radio.song}</span>
						{/if}
						<span class="status" class:failed={radio.status === 'failed'} role="status">{status}</span>
					</p>
					<!-- Folds the panel back into the round button; the sound goes on.
					     Escape and a press outside do the same, but nothing on the
					     panel said so, least of all on a phone, where it fills the
					     screen. -->
					<button
						type="button"
						class="ui-icon-btn minimise"
						aria-label={m.radio.minimise}
						title={m.radio.minimise}
						onclick={minimise}
					>
						<Icon name="minus" size={18} />
					</button>
				</div>

				{#if radio.canSetVolume}
					<label class="volume">
						<Icon name="speaker" size={18} />
						<span class="ui-sr-only">{m.radio.volume}</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={radio.volume}
							oninput={(event) => radio.setVolume(event.currentTarget.valueAsNumber)}
						/>
					</label>
				{/if}

				<div class="stations">
					{#each KINDS as kind (kind)}
						<section>
							<h3 id="ui-radio-{kind}">{m.radio.kinds[kind]}</h3>
							<ul aria-labelledby="ui-radio-{kind}">
								{#each STATIONS.filter((station) => station.kind === kind) as station (station.id)}
									{@const chosen = station.id === radio.stationId}
									<li>
										<button
											type="button"
											class="station"
											class:chosen
											aria-pressed={chosen && radio.on}
											onclick={() => choose(station.id)}
										>
											<span class="mark">
												{#if chosen && playing}
													{@render bars(14)}
												{:else}
													<Icon name={chosen && radio.on ? 'stop' : 'play'} size={14} filled />
												{/if}
											</span>
											<span class="name" lang="uk">{station.name}</span>
											<span class="about">{station[settings.lang]}</span>
										</button>
									</li>
								{/each}
							</ul>
						</section>
					{/each}
				</div>

				<p class="foot">
					<!-- A new tab: leaving this page would stop the sound -->
					<a href={current.home} target="_blank" rel="noopener">{m.radio.site}</a>
					<button type="button" onclick={hide}>{m.radio.hide}</button>
				</p>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>

	<!-- Hiding without opening the panel, for a mouse or a keyboard. A finger
	     could not hit it and has no hover to reveal it: on a touch screen
	     "Hide the radio" in the panel is the way. -->
	<button type="button" class="hide" aria-label={m.radio.hide} title={m.radio.hide} onclick={hide}>
		<Icon name="x" size={12} />
	</button>
</div>

<style>
	/* Under the sticky header (30) and the overlays (40): a dialog covers it.
	   Toasts.svelte keeps its messages clear of this corner. Being fixed
	   with a z-index, it is a layer of its own, so the glow below can go
	   behind the button without going behind the page. */
	.radio {
		/* The flag's colours, as in the ribbon under the header (Header.svelte):
		   half a turn of blue, half of yellow, with a soft seam between */
		--flag-blue: #005bbb;
		--flag-yellow: #ffd500;
		--flag-turn: conic-gradient(
			var(--flag-blue) 0 44%,
			var(--flag-yellow) 50% 94%,
			var(--flag-blue)
		);
		position: fixed;
		right: 1rem;
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		z-index: 20;
	}

	/* A disc in those colours behind the button, blurred into a glow. It is
	   there only from the press on, so a silent button is a plain disc of
	   the page's own surface that asks for no attention, and one that is on
	   air says so from any page without being a block of colour. (Until
	   2026-11-12 a ring in the same colours stood round the button all the
	   time; it made the silent button the loudest thing in the corner.) */
	.halo {
		position: absolute;
		inset: -3px;
		z-index: -1;
		border-radius: 50%;
		background: var(--flag-turn);
		filter: blur(8px);
		/* A glow, not a lamp: a quarter strength when on */
		opacity: 0;
		pointer-events: none;
		/* Held, not removed, when the sound stops: the next time it starts
		   from where it was, with no jump */
		animation: turn 6s linear infinite paused;
	}

	/* On air it turns. This and the bars are the one place on the site that
	   moves even for a visitor whose system asks for less motion (user,
	   2026-11-12): they are the only sign, from any page, that sound is
	   coming from this tab, they are 3rem across, and they are there only
	   for someone who switched the radio on and pressed play. */
	.radio.on .halo {
		opacity: 0.25;
		animation-play-state: running;
	}

	/* The station is being rung up: the glow turns and comes and goes */
	.radio.connecting .halo {
		animation:
			turn 6s linear infinite,
			blink 0.7s ease-in-out infinite alternate;
	}

	/* The trigger is drawn by Bits UI, so its rules are global */
	:global(.ui-radio-btn) {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 50%;
		background: var(--surface);
		box-shadow: var(--shadow);
		color: var(--muted);
		cursor: pointer;
	}

	@media (hover: hover) {
		:global(.ui-radio-btn:hover) {
			background: var(--surface-2);
			color: var(--ink);
		}
	}

	:global(.ui-radio-btn[data-on]) {
		color: var(--ink);
	}

	.hide {
		position: absolute;
		top: -0.4rem;
		right: -0.4rem;
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		background: var(--surface);
		color: var(--muted);
		cursor: pointer;
		opacity: 0;
	}

	.radio:hover .hide,
	.hide:focus-visible {
		opacity: 1;
	}

	@media (hover: hover) {
		.hide:hover {
			color: var(--ink);
		}
	}

	@media (pointer: coarse) {
		.hide {
			display: none;
		}
	}

	/* Bars 10 wide and 5 apart in a box 55 by 80, standing on its floor */
	.bars {
		display: inline-flex;
		flex: none;
		align-items: flex-end;
		gap: calc(var(--size) / 16);
		width: calc(var(--size) * 0.6875);
		height: var(--size);
	}

	.bars i {
		flex: 1;
		border-radius: calc(var(--size) * 0.0375);
		background: currentColor;
		animation: bar-1 4.3s linear infinite;
	}

	.bars i:nth-child(2) {
		animation: bar-2 2s linear infinite;
	}

	.bars i:nth-child(3) {
		animation: bar-3 1.4s linear infinite;
	}

	.bars i:nth-child(4) {
		animation: bar-4 2s linear infinite;
	}

	/* The panel never grows past the window: the stations scroll instead.
	   Bits UI measures the room above the button. */
	:global(.ui-radio) {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		max-height: var(--bits-floating-available-height, 80dvh);
	}

	.now {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.main {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-ink);
		cursor: pointer;
	}

	@media (hover: hover) {
		.main:hover {
			background: var(--link-hover);
		}
	}

	/* In the panel's top right corner, a little into its padding so the
	   line it draws sits level with the station's name */
	.minimise {
		align-self: flex-start;
		margin: -0.4rem -0.4rem 0 0;
	}

	.now p {
		display: grid;
		flex: 1;
		gap: 0.1rem;
		min-width: 0;
		margin: 0;
		line-height: 1.3;
	}

	/* A long title takes a second line, and a word with no spaces in it
	   breaks rather than widen the panel */
	.song {
		color: var(--ink-2);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.status,
	.about {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.status.failed {
		color: var(--ink-2);
	}

	.volume {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--muted);
	}

	input {
		flex: 1;
		min-width: 0;
		margin: 0;
		accent-color: var(--accent);
	}

	.stations {
		display: grid;
		gap: 0.7rem;
		min-height: 0;
		/* Room for the focus ring of a station, which the scrolling box would cut */
		margin: 0 -0.5rem;
		padding: 2px 0.5rem;
		overflow-y: auto;
	}

	section {
		display: grid;
		gap: 0.25rem;
	}

	h3 {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	ul {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* The mark, then the name over one line about the station */
	.station {
		display: grid;
		grid-template-columns: 1.1rem minmax(0, 1fr);
		gap: 0 0.5rem;
		align-items: center;
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: var(--ink);
		line-height: 1.3;
		text-align: left;
		cursor: pointer;
	}

	.mark {
		display: grid;
		place-items: center;
		color: var(--faint);
	}

	.name {
		font-weight: 600;
	}

	.about {
		grid-column: 2;
	}

	@media (hover: hover) {
		.station:hover {
			background: var(--surface-2);
		}

		.station:hover .mark {
			color: var(--ink-2);
		}
	}

	.station.chosen {
		background: var(--accent-soft);
	}

	.station.chosen .mark {
		color: var(--accent);
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.3rem 1rem;
		margin: 0;
		padding-top: 0.7rem;
		border-top: 1px solid var(--border);
		font-size: var(--text-xs);
	}

	.foot a,
	.foot button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	@media (hover: hover) {
		.foot a:hover,
		.foot button:hover {
			color: var(--ink);
		}
	}

	@media (pointer: coarse) {
		.station {
			padding-block: 0.6rem;
		}

		.foot a,
		.foot button {
			padding-block: 0.5rem;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.hide {
			transition: opacity var(--duration);
		}

		.halo {
			transition: opacity 0.4s;
		}
	}

	/* The four beats. Each list is the bar's height, out of 80, at even steps
	   through its round (Sam Herbert's numbers, see the top of the file);
	   here as a share of the box's height. One stop to a line: they are a
	   table of numbers. */
	/* 20 45 57 80 64 32 66 45 64 23 66 13 64 56 34 34 2 23 76 79 20 */
	@keyframes bar-1 {
		0% { height: 25%; }
		5% { height: 56.25%; }
		10% { height: 71.25%; }
		15% { height: 100%; }
		20% { height: 80%; }
		25% { height: 40%; }
		30% { height: 82.5%; }
		35% { height: 56.25%; }
		40% { height: 80%; }
		45% { height: 28.75%; }
		50% { height: 82.5%; }
		55% { height: 16.25%; }
		60% { height: 80%; }
		65% { height: 70%; }
		70% { height: 42.5%; }
		75% { height: 42.5%; }
		80% { height: 2.5%; }
		85% { height: 28.75%; }
		90% { height: 95%; }
		95% { height: 98.75%; }
		100% { height: 25%; }
	}

	/* 80 55 33 5 75 23 73 33 12 14 60 80 */
	@keyframes bar-2 {
		0% { height: 100%; }
		9.09% { height: 68.75%; }
		18.18% { height: 41.25%; }
		27.27% { height: 6.25%; }
		36.36% { height: 93.75%; }
		45.45% { height: 28.75%; }
		54.55% { height: 91.25%; }
		63.64% { height: 41.25%; }
		72.73% { height: 15%; }
		81.82% { height: 17.5%; }
		90.91% { height: 75%; }
		100% { height: 100%; }
	}

	/* 50 34 78 23 56 23 34 76 80 54 21 50 */
	@keyframes bar-3 {
		0% { height: 62.5%; }
		9.09% { height: 42.5%; }
		18.18% { height: 97.5%; }
		27.27% { height: 28.75%; }
		36.36% { height: 70%; }
		45.45% { height: 28.75%; }
		54.55% { height: 42.5%; }
		63.64% { height: 95%; }
		72.73% { height: 100%; }
		81.82% { height: 67.5%; }
		90.91% { height: 26.25%; }
		100% { height: 62.5%; }
	}

	/* 30 45 13 80 56 72 45 76 34 23 67 30 */
	@keyframes bar-4 {
		0% { height: 37.5%; }
		9.09% { height: 56.25%; }
		18.18% { height: 16.25%; }
		27.27% { height: 100%; }
		36.36% { height: 70%; }
		45.45% { height: 90%; }
		54.55% { height: 56.25%; }
		63.64% { height: 95%; }
		72.73% { height: 42.5%; }
		81.82% { height: 28.75%; }
		90.91% { height: 83.75%; }
		100% { height: 37.5%; }
	}

	@keyframes blink {
		from {
			opacity: 0.05;
		}

		to {
			opacity: 0.25;
		}
	}

	@keyframes turn {
		to {
			rotate: 1turn;
		}
	}
</style>
