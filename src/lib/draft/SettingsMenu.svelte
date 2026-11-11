<!-- The settings under the header's sliders button: a Bits UI Popover (it
     handles Escape, clicks outside and focus) holding one RadioGroup per
     setting. The settings themselves work as before (src/lib/settings.ts). -->
<script lang="ts">
	import { Popover, RadioGroup } from 'bits-ui';
	import { page } from '$app/state';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { applySetting, useSettings, type KeyboardLayout, type Lang, type Theme } from '#lib/settings.ts';
	import Icon from './Icon.svelte';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const themes: Theme[] = ['system', 'light', 'dark'];
	const languages: [Lang, string][] = [['uk', 'Українська'], ['en', 'English']];
	const layouts: KeyboardLayout[] = ['standard', 'phonetic'];

	function set<K extends 'theme' | 'lang' | 'layout'>(name: K, value: string) {
		settings[name] = value as (typeof settings)[K];
		applySetting(name, settings[name]);
	}

	let hasAccount = $derived(Boolean(page.data.user) || page.data.providers?.length > 0);
</script>

<Popover.Root>
	<Popover.Trigger class="d-icon-btn" aria-label={m.settings.open} title={m.settings.open}>
		<Icon name="settings" size={20} />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="d-popover" align="end" sideOffset={10} collisionPadding={8}>
			<div class="groups">
				<section>
					<h2 id="d-set-theme">{m.settings.appearance}</h2>
					<RadioGroup.Root
						class="d-segmented"
						orientation="horizontal"
						aria-labelledby="d-set-theme"
						value={settings.theme}
						onValueChange={(value) => set('theme', value)}
					>
						{#each themes as theme (theme)}
							<RadioGroup.Item class="d-segment" value={theme}>{m.settings[theme]}</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</section>
				<section>
					<h2 id="d-set-lang">{m.settings.language}</h2>
					<RadioGroup.Root
						class="d-segmented"
						orientation="horizontal"
						aria-labelledby="d-set-lang"
						value={settings.lang}
						onValueChange={(value) => set('lang', value)}
					>
						{#each languages as [code, name] (code)}
							<RadioGroup.Item class="d-segment" value={code} lang={code}>{name}</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</section>
				<section>
					<h2 id="d-set-layout">{m.settings.layout}</h2>
					<RadioGroup.Root
						class="d-segmented"
						orientation="horizontal"
						aria-labelledby="d-set-layout"
						value={settings.layout}
						onValueChange={(value) => set('layout', value)}
					>
						{#each layouts as layout (layout)}
							<RadioGroup.Item class="d-segment" value={layout}>{m.settings[layout]}</RadioGroup.Item>
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
		color: var(--d-muted);
		font-family: var(--font-text);
		font-size: 0.78rem;
		font-weight: 700;
	}

	.hint {
		margin: 0;
		color: var(--d-muted);
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.account {
		padding-top: 0.9rem;
		border-top: 1px solid var(--d-border);
	}
</style>
