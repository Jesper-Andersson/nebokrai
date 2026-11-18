<!-- The settings under the header's sliders button: a Bits UI Popover (it
     handles Escape, clicks outside and focus) holding one RadioGroup per
     setting, and a Switch for each that is only on or off. Since 2026-11-18
     they are in three tabs, so that the menu no longer scrolls (user's pick
     in Figma, "A"): Look (theme, background, font), Reading (the language and
     what a word's page shows), Typing (the keyboard, and the radio). It opens
     on Look each time. The settings themselves work as before
     (src/lib/settings.ts). -->
<script lang="ts">
	import { Popover, RadioGroup, Switch, Tabs } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import DeleteAccount from '#lib/DeleteAccount.svelte';
	import LoginButton from '#lib/LoginButton.svelte';
	import type { Provider, User } from '#lib/server/users.ts';
	import fieldThumb from '#lib/assets/backgrounds/field-thumb.webp';
	import hillsThumb from '#lib/assets/backgrounds/hills-thumb.webp';
	import { messagesFor } from '#lib/i18n.ts';
	import {
		applySetting,
		BACKGROUNDS,
		FONTS,
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

	function set<K extends 'theme' | 'lang' | 'layout' | 'background' | 'font' | 'radio' | 'roman' | 'ipa' | 'blur'>(
		name: K,
		value: string
	) {
		settings[name] = value as (typeof settings)[K];
		applySetting(name, settings[name]);
	}

	// Both from the root layout's load (src/routes/+layout.server.ts)
	let user = $derived(page.data.user as User | null);
	let providers = $derived((page.data.providers ?? []) as Provider[]);

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
				<!-- The account first (user, 2026-11-16): who is signed in with
				     Log out, or the one Log in button -->
				{#if user}
					<section class="account-row">
						<p>{user.name ? m.account.signedInAs(user.name) : m.account.signedIn}</p>
						<form method="POST" action="/logout">
							<button type="submit" class="ui-btn">{m.account.signOut}</button>
						</form>
					</section>
				{:else if providers.length}
					<section class="account-row">
						<p class="account-hint">{m.account.signInHint}</p>
						<LoginButton primary />
					</section>
				{/if}
				<Tabs.Root value="look" class="ui-settings-tabs">
					<Tabs.List class="ui-segmented ui-tab-list">
						<Tabs.Trigger class="ui-segment" value="look">{m.settings.tabs.look}</Tabs.Trigger>
						<Tabs.Trigger class="ui-segment" value="reading">{m.settings.tabs.reading}</Tabs.Trigger>
						<Tabs.Trigger class="ui-segment" value="typing">{m.settings.tabs.typing}</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="look" class="ui-tab">
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
						<!-- Each choice shows its letters in its own face -->
						<section>
							<h2 id="ui-set-font">{m.settings.font}</h2>
							<RadioGroup.Root
								class="ui-segmented"
								orientation="horizontal"
								aria-labelledby="ui-set-font"
								aria-describedby="ui-set-font-hint"
								value={settings.font}
								onValueChange={(value) => set('font', value)}
							>
								{#each FONTS as font (font)}
									<RadioGroup.Item class="ui-segment" value={font}>
										<span class="mark {font}" aria-hidden="true">Аа</span>
										{m.settings.fonts[font]}
									</RadioGroup.Item>
								{/each}
							</RadioGroup.Root>
							<!-- The chosen face at work, on a line of Ukrainian -->
							<p class="sample" lang="uk">Добрий день! Як справи?</p>
							<p class="hint" id="ui-set-font-hint">{m.settings.fontHint}</p>
						</section>
					</Tabs.Content>
					<Tabs.Content value="reading" class="ui-tab">
						<section>
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
						<!-- What a word's page shows under the headword (word/[word]/+page.svelte) -->
						<section class="divided">
							<div class="switch-row">
								<h2 id="ui-set-roman">{m.settings.roman}</h2>
								<Switch.Root
									class="ui-switch"
									aria-labelledby="ui-set-roman"
									aria-describedby="ui-set-roman-hint"
									checked={settings.roman === 'on'}
									onCheckedChange={(on) => set('roman', on ? 'on' : 'off')}
								>
									<Switch.Thumb class="ui-switch-thumb" />
								</Switch.Root>
							</div>
							<p class="hint" id="ui-set-roman-hint">{m.settings.romanHint}</p>
						</section>
						<section>
							<div class="switch-row">
								<h2 id="ui-set-ipa">{m.settings.ipa}</h2>
								<Switch.Root
									class="ui-switch"
									aria-labelledby="ui-set-ipa"
									aria-describedby="ui-set-ipa-hint"
									checked={settings.ipa === 'on'}
									onCheckedChange={(on) => set('ipa', on ? 'on' : 'off')}
								>
									<Switch.Thumb class="ui-switch-thumb" />
								</Switch.Root>
							</div>
							<p class="hint" id="ui-set-ipa-hint">{m.settings.ipaHint}</p>
						</section>
						<section>
							<div class="switch-row">
								<h2 id="ui-set-blur">{m.settings.blur}</h2>
								<Switch.Root
									class="ui-switch"
									aria-labelledby="ui-set-blur"
									aria-describedby="ui-set-blur-hint"
									checked={settings.blur === 'on'}
									onCheckedChange={(on) => set('blur', on ? 'on' : 'off')}
								>
									<Switch.Thumb class="ui-switch-thumb" />
								</Switch.Root>
							</div>
							<p class="hint" id="ui-set-blur-hint">{m.settings.blurHint}</p>
						</section>
					</Tabs.Content>
					<Tabs.Content value="typing" class="ui-tab">
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
					</Tabs.Content>
				</Tabs.Root>
				<!-- Deleting the account stays at the foot, away from Log out (user, 2026-11-16) -->
				{#if user}
					<section class="divided">
						<h2>{m.account.legend}</h2>
						<DeleteAccount />
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

	.mark.serif {
		font-family: var(--font-serif);
	}

	.mark.sans {
		font-family: var(--font-text);
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

	/* Until 2026-11-18 a phone hid the lines that explain each setting: the
	   one long menu was 1,149px in 780. In three tabs the tallest is about
	   500px with them, so they stay. */

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

	/* Who is signed in, or why to log in, and the button at the other end */
	.account-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.account-row p {
		margin: 0;
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	.account-row .account-hint {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.account-row form {
		flex: none;
	}

	/* A line above: where the language settings start, the radio, and the account */
	.divided {
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}
	/* The three tabs: a row of segments at the top, and the open tab's settings under it */
	:global(.ui-settings-tabs),
	:global(.ui-tab) {
		display: grid;
		gap: 1rem;
	}

	/* A closed tab is hidden by Bits UI's own attribute, which a display above would undo */
	:global(.ui-tab[hidden]) {
		display: none;
	}

	:global(.account-row + .ui-settings-tabs) {
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}

	:global(.ui-tab-list .ui-segment[data-state='active']) {
		background: var(--raised);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
		color: var(--ink);
	}

	:global(.ui-tab:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
		border-radius: var(--radius-sm);
	}

	/* A line of Ukrainian in the face chosen: the reading face follows the setting */
	.sample {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-reading);
		font-size: var(--text-lg);
	}
</style>
