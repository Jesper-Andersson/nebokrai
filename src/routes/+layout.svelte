<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import uaFlag from '#lib/assets/flag-ukraine.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: '/', label: 'Dictionary' },
		{ href: '/resources', label: 'Resources' },
		{ href: '/saved', label: 'Saved' },
		{ href: '/about', label: 'About' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Nebokrai</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&family=Patua+One&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

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
	<a href="/settings" class="settings" aria-label="Settings">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
			/>
		</svg>
	</a>
</header>

<main>
	{@render children()}
</main>

<footer>
	<a href="/report">Report An Issue</a>
	<p>Copyright - Jesper Andersson 2026</p>
</footer>

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		border-bottom: 1px solid #2b2b2b;
		background-color: #e4cb81;
		font-family: 'Patua One', serif;
		font-size: 24px;
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

	.settings svg {
		width: 1.5em;
		height: 1.5em;
	}

	main {
		padding: 0 16px;
	}

	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: auto;
		padding: 15px 16px;
		background-color: #1e1e1e;
		color: white;
		font-family: 'Patua One', serif;
		font-size: 15px;
	}

	footer p {
		margin: 0;
	}
</style>
