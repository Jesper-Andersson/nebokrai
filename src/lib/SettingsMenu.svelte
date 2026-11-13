<!-- The settings under the header's sliders button: a Bits UI Popover (it
     handles Escape, clicks outside and focus) holding one RadioGroup per
     setting, and a Switch for the one that is only on or off. The settings
     themselves work as before (src/lib/settings.ts). -->
<script lang="ts">
	import { Popover, RadioGroup, Switch } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import fieldThumb from '#lib/assets/backgrounds/field-thumb.webp';
	import hillsThumb from '#lib/assets/backgrounds/hills-thumb.webp';
	import { messagesFor } from '#lib/i18n.ts';
	import {
		applySetting,
		BACKGROUNDS,
		useSettings,
		type Background,
		type KeyboardLayout,
		type Lang,
		type Theme
	} from '#lib/settings.ts';
	import Icon, { type IconName } from './Icon.svelte';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// From brightest to darkest after the system's own choice
	const themes: [Theme, IconName][] = [
		['system', 'monitor'],
		['light', 'sun'],
		['sepia', 'book'],
		['dark', 'moon']
	];
	// Each language is marked by two letters of its own script, not a flag: a
	// flag names a country, and ї is written in Ukrainian alone.
	const languages: [Lang, string, string][] = [['uk', 'Українська', 'Її'], ['en', 'English', 'Aa']];
	const layouts: KeyboardLayout[] = ['standard', 'phonetic'];
	// Small previews of the photos; the plain background shows the page colour.
	const previews: Record<Background, string | null> = { plain: null, field: fieldThumb, hills: hillsThumb };

	function set<K extends 'theme' | 'lang' | 'layout' | 'background' | 'radio'>(name: K, value: string) {
		settings[name] = value as (typeof settings)[K];
		applySetting(name, settings[name]);
	}

	let hasAccount = $derived(Boolean(page.data.user) || page.data.providers?.length > 0);

	// A touch screen: the open menu holds the page still (see the menu below)
	const coarse = new MediaQuery('(pointer: coarse)');
</script>

<Popover.Root>
	<Popover.Trigger class="ui-icon-btn" aria-label={m.settings.open} title={m.settings.open}>
		<Icon name="settings" size={20} />
	</Popover.Trigger>
	<Popover.Portal>
		<!-- On a touch screen a finger moved on the menu scrolled the page
		     behind it: there the page is held still while the menu is open,
		     as under the radio's panel. With a mouse the page still scrolls
		     under the open menu. -->
		<Popover.Content
			class="ui-popover ui-settings"
			align="end"
			sideOffset={10}
			collisionPadding={8}
			preventScroll={coarse.current}
		>
			<div class="groups">
				<section>
					<h2 id="ui-set-theme">{m.settings.appearance}</h2>
					<RadioGroup.Root
						class="ui-tiles"
						orientation="horizontal"
						aria-labelledby="ui-set-theme"
						value={settings.theme}
						onValueChange={(value) => set('theme', value)}
					>
						{#each themes as [theme, icon] (theme)}
							<RadioGroup.Item class="ui-tile" value={theme}>
								<Icon name={icon} size={20} />
								{m.settings[theme]}
							</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</section>
				<section>
					<h2 id="ui-set-bg">{m.settings.background}</h2>
					<RadioGroup.Root
						class="ui-swatches"
						orientation="horizontal"
						aria-labelledby="ui-set-bg"
						value={settings.background}
						onValueChange={(value) => set('background', value)}
					>
						{#each BACKGROUNDS as background (background)}
							<RadioGroup.Item class="ui-swatch" value={background}>
								<span class="picture">
									{#if previews[background]}
										<img src={previews[background]} alt="" width="132" height="82" />
									{:else}
										<span class="mini-page"></span>
									{/if}
									<span class="tick"><Icon name="check" size={12} /></span>
								</span>
								{m.settings.backgrounds[background]}
							</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</section>
				<section class="divided">
					<h2 id="ui-set-lang">{m.settings.language}</h2>
					<RadioGroup.Root
						class="ui-segmented"
						orientation="horizontal"
						aria-labelledby="ui-set-lang"
						value={settings.lang}
						onValueChange={(value) => set('lang', value)}
					>
						{#each languages as [code, name, mark] (code)}
							<RadioGroup.Item class="ui-segment" value={code} lang={code}>
								<span class="mark" aria-hidden="true">{mark}</span>
								{name}
							</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</section>
				<section>
					<h2 id="ui-set-layout">{m.settings.layout}</h2>
					<RadioGroup.Root
						class="ui-segmented"
						orientation="horizontal"
						aria-labelledby="ui-set-layout"
						value={settings.layout}
						onValueChange={(value) => set('layout', value)}
					>
						{#each layouts as layout (layout)}
							<RadioGroup.Item class="ui-segment" value={layout}>{m.settings[layout]}</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
					<!-- The same two keys in both languages: the Latin key, then the
					     letter it types -->
					<p class="hint">
						<span class="keys"><kbd class="ui-kbd">P</kbd> → <span lang="uk">п</span></span>
						<span class="keys"><kbd class="ui-kbd">H</kbd> → <span lang="uk">г</span></span>
						<span class="sentence">{m.settings.layoutHint}</span>
					</p>
				</section>
				<!-- The radio's button (RadioPlayer.svelte) is on the page only
				     while this is on; switching it off also stops the sound -->
				<section class="divided">
					<div class="switch-row">
						<h2 id="ui-set-radio">{m.settings.radio}</h2>
						<Switch.Root
							class="ui-switch"
							aria-labelledby="ui-set-radio"
							aria-describedby="ui-set-radio-hint"
							checked={settings.radio === 'on'}
							onCheckedChange={(on) => set('radio', on ? 'on' : 'off')}
						>
							<Switch.Thumb class="ui-switch-thumb" />
						</Switch.Root>
					</div>
					<p class="hint" id="ui-set-radio-hint">{m.settings.radioHint}</p>
				</section>
				{#if hasAccount}
					<section class="divided">
						<h2>{m.account.legend}</h2>
						<AccountPanel />
					</section>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	/* The menu never grows past the window: it scrolls instead, and a swipe
	   that reaches its end is not handed to the page behind. Bits UI measures
	   the room under the header. */
	:global(.ui-settings) {
		max-height: var(--bits-floating-available-height, 80dvh);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.groups {
		display: grid;
		gap: 1rem;
	}

	section {
		display: grid;
		gap: 0.45rem;
	}

	h2 {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	/* The theme choices: an icon over its name, four in a row. The name sits
	   under the icon, not beside it, and «Як у системі» breaks into two
	   lines; the row keeps every tile the same height. The buttons are drawn
	   by Bits UI, so their rules are global. */
	:global(.ui-tiles) {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.45rem;
	}

	:global(.ui-tile) {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 0.6rem 0.3rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1.2;
		text-align: center;
		cursor: pointer;
	}

	@media (hover: hover) {
		:global(.ui-tile:hover) {
			color: var(--ink);
		}
	}

	:global(.ui-tile[data-state='checked']) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		background: var(--raised);
		color: var(--ink);
	}

	:global(.ui-tile:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 6px var(--accent-soft);
	}

	/* The chosen option's symbol takes the accent, so the choice shows at a
	   glance */
	:global(.ui-tile[data-state='checked'] svg),
	:global(.ui-segment[data-state='checked']) .mark {
		color: var(--accent);
	}

	.mark {
		color: var(--muted);
		font-family: var(--font-headword);
		font-weight: 700;
	}

	/* The background choices: a small picture with its name under it. */
	:global(.ui-swatches) {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
	}

	:global(.ui-swatch) {
		display: grid;
		gap: 0.3rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		cursor: pointer;
	}

	.picture {
		position: relative;
		display: block;
		aspect-ratio: 8 / 5;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--bg);
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* The plain background has no photo to show, so its picture is the page
	   itself in small: a card with a word and a line of text on it. */
	.mini-page {
		position: absolute;
		inset: 22% 18%;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
	}

	.mini-page::before,
	.mini-page::after {
		content: '';
		position: absolute;
		left: 12%;
		height: 3px;
		border-radius: 2px;
	}

	.mini-page::before {
		top: 26%;
		width: 40%;
		background: var(--muted);
	}

	.mini-page::after {
		top: 58%;
		width: 68%;
		background: var(--border-strong);
	}

	/* A tick in the corner of the chosen picture; the ring of the menu's own
	   colour keeps it clear of the photo behind it */
	.tick {
		position: absolute;
		top: 4px;
		right: 4px;
		display: none;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 2px var(--surface);
		color: var(--accent-ink);
	}

	:global(.ui-swatch[data-state='checked']) .tick {
		display: grid;
	}

	:global(.ui-swatch[data-state='checked']) {
		color: var(--ink);
	}

	:global(.ui-swatch[data-state='checked']) .picture {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	:global(.ui-swatch:focus-visible) {
		outline: none;
	}

	:global(.ui-swatch:focus-visible) .picture {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 6px var(--accent-soft);
	}

	.hint {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.9rem;
		margin: 0;
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1.4;
	}

	.keys {
		color: var(--ink-2);
		font-weight: 600;
		white-space: nowrap;
	}

	.sentence {
		flex-basis: 100%;
	}

	/* A setting that is only on or off: its name, and the switch at the
	   other end of the line. Bits UI draws the switch (a button) and its
	   thumb, so their rules are global. */
	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	:global(.ui-switch) {
		display: inline-flex;
		flex: none;
		align-items: center;
		width: 2.5rem;
		height: 1.5rem;
		padding: 2px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface-2);
		cursor: pointer;
	}

	:global(.ui-switch[data-state='checked']) {
		border-color: var(--accent);
		background: var(--accent);
	}

	:global(.ui-switch-thumb) {
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		background: var(--muted);
	}

	:global(.ui-switch-thumb[data-state='checked']) {
		background: var(--accent-ink);
		translate: 1rem 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.ui-switch-thumb) {
			transition: translate var(--duration);
		}
	}

	/* A line above: where the language settings start, the radio, and the account */
	.divided {
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}
</style>
