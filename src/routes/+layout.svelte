<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import AccountPanel from '#lib/AccountPanel.svelte';
	import favicon from '#lib/assets/favicon.svg';
	import uaFlag from '#lib/assets/flag-ukraine.svg';
	import { messagesFor } from '#lib/i18n.ts';
	import { provideSaved } from '#lib/saved.svelte.ts';
	import {
		applySetting,
		provideSettings,
		type KeyboardLayout,
		type Lang,
		type Theme
	} from '#lib/settings.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The settings come from cookies on the server; changing them here updates
	// the whole page at once and stores the new cookie.
	// svelte-ignore state_referenced_locally
	const settings = $state({ ...data.settings });
	provideSettings(settings);
	let m = $derived(messagesFor(settings.lang));

	// Saved words: read from this browser once the page is running, and synced
	// with the account when signed in (see saved.svelte.ts).
	// svelte-ignore state_referenced_locally
	const saved = provideSaved(data.user?.id ?? null);
	onMount(() => void saved.load());

	const links = $derived([
		{ href: '/', label: m.nav.dictionary },
		{ href: '/resources', label: m.nav.resources },
		{ href: '/saved', label: m.nav.saved },
		{ href: '/about', label: m.nav.about }
	]);

	const themes: Theme[] = ['system', 'light', 'dark'];
	const languages: [Lang, string][] = [['uk', 'Українська'], ['en', 'English']];

	function setTheme(theme: Theme) {
		settings.theme = theme;
		applySetting('theme', theme);
	}

	function setLang(lang: Lang) {
		settings.lang = lang;
		applySetting('lang', lang);
	}

	// The draft redesign under /draft has a header and footer of its own
	// (src/routes/draft/+layout.svelte); this layout then only provides the
	// settings and the saved words.
	let draft = $derived(page.url.pathname === '/draft' || page.url.pathname.startsWith('/draft/'));

	const layouts: KeyboardLayout[] = ['standard', 'phonetic'];

	function setLayout(layout: KeyboardLayout) {
		settings.layout = layout;
		applySetting('layout', layout);
	}

	// The settings dropdown: opens from the cog, closes on Escape or a click outside.
	let menuOpen = $state(false);
	let menu: HTMLElement | undefined = $state();

	function onWindowClick(event: MouseEvent) {
		if (menuOpen && menu && !menu.contains(event.target as Node)) menuOpen = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) {
			menuOpen = false;
			menu?.querySelector<HTMLButtonElement>('.settings')?.focus();
		}
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Nebokrai</title>
</svelte:head>

{#if draft}
	{@render children()}
{:else}
<header>
	<a href="/" class="logo">
		<img src={uaFlag} alt="" />
		Nebokrai
	</a>
	<nav>
		{#each links as link (link.href)}
			<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
				{link.label}
			</a>
		{/each}
	</nav>
	<div class="settings-menu" bind:this={menu}>
		<button
			type="button"
			class="settings"
			aria-label={m.settings.open}
			aria-expanded={menuOpen}
			aria-controls="settings-panel"
			onclick={() => (menuOpen = !menuOpen)}
		>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
			/>
		</svg>
		</button>
		{#if menuOpen}
			<div class="panel" id="settings-panel">
				<fieldset>
					<legend>{m.settings.appearance}</legend>
					<div class="segmented">
						{#each themes as theme (theme)}
							<label class:on={settings.theme === theme}>
								<input
									type="radio"
									name="theme"
									value={theme}
									checked={settings.theme === theme}
									onchange={() => setTheme(theme)}
								/>
								{m.settings[theme]}
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset>
					<legend>{m.settings.language}</legend>
					<div class="segmented">
						{#each languages as [code, name] (code)}
							<label class:on={settings.lang === code} lang={code}>
								<input
									type="radio"
									name="lang"
									value={code}
									checked={settings.lang === code}
									onchange={() => setLang(code)}
								/>
								{name}
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset>
					<legend>{m.settings.layout}</legend>
					<div class="segmented">
						{#each layouts as layout (layout)}
							<label class:on={settings.layout === layout}>
								<input
									type="radio"
									name="layout"
									value={layout}
									checked={settings.layout === layout}
									onchange={() => setLayout(layout)}
								/>
								{m.settings[layout]}
							</label>
						{/each}
					</div>
					<p class="hint">{m.settings.layoutHint}</p>
				</fieldset>
				{#if data.user || data.providers.length}
					<fieldset>
						<legend>{m.account.legend}</legend>
						<AccountPanel />
					</fieldset>
				{/if}
			</div>
		{/if}
	</div>
</header>

<main>
	{@render children()}
</main>

<footer>
	<a href="/report">{m.footer.report}</a>
	<p class="copyright">
		© 2026 Jesper Andersson · {m.footer.data} ·
		<a href="/sources">{m.footer.sources}</a>
	</p>
</footer>
{/if}

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		border-bottom: 1px solid #2b2b2b;
		background-color: #e4cb81;
		font-family: var(--font-heading);
		font-size: 22px;
		font-weight: 700;
	}

	/* Every header link fills the bar's full height, so the active one gets a full-height highlight */
	header a {
		display: flex;
		align-items: center;
		padding: 14px 0.8em;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
	}

	nav a[aria-current='page'] {
		padding-inline: 1.4em;
		background-color: #5b8fd6;
		color: white;
	}

	.logo {
		gap: 0.15em;
		margin-right: 0.4em;
	}

	.logo img {
		height: 1em;
	}

	.settings-menu {
		position: relative;
		display: flex;
	}

	.settings {
		display: flex;
		align-items: center;
		padding: 14px 0.8em;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.settings[aria-expanded='true'] {
		background-color: rgb(0 0 0 / 0.08);
	}

	.settings:focus-visible {
		outline: 3px solid #5b8fd6;
		outline-offset: -3px;
	}

	/* The dropdown under the cog */
	.panel {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 10;
		display: grid;
		gap: 0.9rem;
		width: max-content;
		max-width: calc(100vw - 16px);
		padding: 0.9rem 1rem 1rem;
		border: 1px solid var(--menu-line);
		border-radius: 8px;
		background: var(--menu-bg);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
		color: var(--menu-ink);
		font-family: var(--font-text);
		font-size: 0.95rem;
		font-weight: 400;
		text-align: left;
	}

	fieldset {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		padding: 0 0 0.4rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.75;
	}

	.hint {
		max-width: 17rem;
		margin: 0.1rem 0 0;
		font-size: 0.8rem;
		line-height: 1.4;
		opacity: 0.75;
	}

	.segmented {
		display: flex;
		border: 1px solid var(--menu-line);
		border-radius: 999px;
		overflow: hidden;
	}

	.segmented label {
		flex: 1;
		padding: 0.35rem 0.9rem;
		text-align: center;
		white-space: nowrap;
		cursor: pointer;
	}

	.segmented label + label {
		border-left: 1px solid var(--menu-line);
	}

	.segmented label.on {
		background: var(--menu-on);
		color: var(--menu-on-ink);
		font-weight: 700;
	}

	.segmented label:has(input:focus-visible) {
		outline: 3px solid var(--menu-on);
		outline-offset: -3px;
	}

	/* The radio buttons stay for keyboard and screen readers; the labels show the choice */
	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.settings svg {
		width: 1.5em;
		height: 1.5em;
	}

	main {
		padding: 0 16px;
	}

	/* Tablets: smaller type keeps the bar on one line. At 22px the Ukrainian
	   bar is about 880px wide, so on a 768px tablet the cog fell to a line of its own. */
	@media (max-width: 1000px) {
		header {
			font-size: 18px;
		}
	}

	/* Phones: logo and cog on the first line, the four links spread across the second */
	@media (max-width: 740px) {
		header {
			display: grid;
			grid-template-columns: 1fr auto;
			font-size: 20px;
		}

		.logo {
			grid-area: 1 / 1;
			justify-self: start;
			margin-right: 0;
			padding: 10px 16px;
		}

		.settings-menu {
			grid-area: 1 / 2;
		}

		.settings {
			padding: 10px 16px;
		}

		nav {
			grid-area: 2 / 1 / 3 / 3;
			flex-wrap: nowrap;
			overflow-x: auto;
			border-top: 1px solid rgb(0 0 0 / 0.14);
			font-size: clamp(13px, 3.9vw, 17px);
			scrollbar-width: none;
		}

		nav a,
		nav a[aria-current='page'] {
			flex: 1 0 auto;
			justify-content: center;
			padding: 13px 0.45em;
			white-space: nowrap;
		}

		.panel {
			right: 8px;
		}

		main {
			padding: 0 10px;
		}

		footer {
			flex-direction: column;
			gap: 6px;
			text-align: center;
		}
	}

	/* The longest row (Як у системі / Світлий / Темний) must fit a 320px screen */
	@media (max-width: 400px) {
		.segmented label {
			padding-inline: 0.55rem;
		}
	}

	/* Fingers need bigger targets than a mouse pointer does */
	@media (pointer: coarse) {
		.segmented label {
			padding-block: 0.75rem;
		}
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		justify-content: space-between;
		align-items: center;
		margin-top: auto;
		padding: 15px 16px;
		background-color: #1e1e1e;
		color: white;
		font-family: var(--font-heading);
		font-size: 15px;
		font-weight: 600;
	}

	footer p {
		margin: 0;
	}

	/* A taller tap area for the report link, without making the bar taller */
	footer > a {
		margin-block: -0.7rem;
		padding-block: 0.7rem;
	}

	.copyright {
		color: #b5b5b5;
		font-family: var(--font-text);
		font-size: 14px;
		letter-spacing: 0.02em;
	}

	.copyright a {
		color: white;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
