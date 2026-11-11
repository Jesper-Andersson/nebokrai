<!-- The settings under the header's sliders button: a Bits UI Popover (it
     handles Escape, clicks outside and focus) holding one RadioGroup per
     setting. The settings themselves work as before (src/lib/settings.ts). -->
<script lang="ts">
	import { Popover, RadioGroup } from 'bits-ui';
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
	import Icon from './Icon.svelte';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const themes: Theme[] = ['system', 'light', 'dark'];
	const languages: [Lang, string][] = [['uk', 'Українська'], ['en', 'English']];
	const layouts: KeyboardLayout[] = ['standard', 'phonetic'];
	// Small previews of the photos; the plain background shows the page colour.
	const previews: Record<Background, string | null> = { plain: null, field: fieldThumb, hills: hillsThumb };

	function set<K extends 'theme' | 'lang' | 'layout' | 'background'>(name: K, value: string) {
		settings[name] = value as (typeof settings)[K];
		applySetting(name, settings[name]);
	}

	let hasAccount = $derived(Boolean(page.data.user) || page.data.providers?.length > 0);
</script>

<Popover.Root>
	<Popover.Trigger class="ui-icon-btn" aria-label={m.settings.open} title={m.settings.open}>
		<Icon name="settings" size={20} />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="ui-popover" align="end" sideOffset={10} collisionPadding={8}>
			<div class="groups">
				<section>
					<h2 id="ui-set-theme">{m.settings.appearance}</h2>
					<RadioGroup.Root
						class="ui-segmented"
						orientation="horizontal"
						aria-labelledby="ui-set-theme"
						value={settings.theme}
						onValueChange={(value) => set('theme', value)}
					>
						{#each themes as theme (theme)}
							<RadioGroup.Item class="ui-segment" value={theme}>{m.settings[theme]}</RadioGroup.Item>
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
									{/if}
								</span>
								{m.settings.backgrounds[background]}
							</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</section>
				<section>
					<h2 id="ui-set-lang">{m.settings.language}</h2>
					<RadioGroup.Root
						class="ui-segmented"
						orientation="horizontal"
						aria-labelledby="ui-set-lang"
						value={settings.lang}
						onValueChange={(value) => set('lang', value)}
					>
						{#each languages as [code, name] (code)}
							<RadioGroup.Item class="ui-segment" value={code} lang={code}>{name}</RadioGroup.Item>
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
					<p class="hint">{m.settings.layoutHint}</p>
				</section>
				{#if hasAccount}
					<section class="account">
						<h2>{m.account.legend}</h2>
						<AccountPanel />
					</section>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
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
		font-size: 0.78rem;
		font-weight: 700;
	}

	/* The background choices: a small picture with its name under it. The
	   buttons are drawn by Bits UI, so their rules are global. */
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
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.picture {
		display: block;
		aspect-ratio: 8 / 5;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: 9px;
		background: var(--bg);
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
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
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.account {
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}
</style>
