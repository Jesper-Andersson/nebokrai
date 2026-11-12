<!-- A small preview of a GitHub profile; the whole card links to it. The
     profile is on the left and the way out to GitHub in a panel on the right. -->
<script lang="ts">
	import type { GitHubProfile } from '#lib/server/github.ts';
	import Icon from './Icon.svelte';

	let { profile }: { profile: GitHubProfile } = $props();
</script>

<a class="card" href={profile.url} rel="noopener">
	<img src={profile.avatarUrl} alt="" width="48" height="48" loading="lazy" />
	<span class="text">
		<span class="name">
			{profile.name ?? profile.login}
			{#if profile.name}<span class="login">@{profile.login}</span>{/if}
		</span>
		{#if profile.bio}<span class="bio">{profile.bio}</span>{/if}
	</span>
	<span class="go">
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path
				fill="currentColor"
				d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
			/>
		</svg>
		<span class="word">GitHub</span>
		<Icon name="chevron-right" size={16} />
	</span>
</a>

<style>
	/* The class and the scoping hash together outweigh the text page's own link
	   colour and underline */
	.card {
		display: flex;
		align-items: stretch;
		box-sizing: border-box;
		width: min(26rem, 100%);
		margin: 0.75rem 0 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--ink);
		text-decoration: none;
		transition: border-color var(--duration);
	}

	.card:hover {
		border-color: var(--border-strong);
		color: var(--ink);
	}

	img {
		flex: none;
		align-self: center;
		width: 48px;
		height: 48px;
		margin: 0.7rem 0 0.7rem 0.85rem;
		border-radius: 50%;
		background: var(--border);
	}

	.text {
		display: grid;
		flex: 1;
		align-content: center;
		gap: 0.1rem;
		min-width: 0;
		padding: 0.7rem 0.85rem;
	}

	/* The login moves under the name whole when the two do not fit on a line,
	   never breaking at its hyphen */
	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.4rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.login {
		max-width: 100%;
		overflow: hidden;
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 400;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bio {
		overflow-wrap: anywhere;
	}

	.go {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.75rem 0 0.9rem;
		border-left: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--ink-2);
		font-size: var(--text-sm);
		font-weight: 700;
		transition: color var(--duration);
	}

	.go svg:first-child {
		flex: none;
		width: 1rem;
		height: 1rem;
	}

	.card:hover .go {
		color: var(--accent);
	}

	/* Phones: the panel keeps only the mark and the arrow */
	@media (max-width: 420px) {
		img {
			margin-left: 0.7rem;
		}

		.text {
			padding: 0.7rem;
		}

		.go {
			gap: 0.2rem;
			padding: 0 0.5rem 0 0.6rem;
		}

		.word {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.go {
			transition: none;
		}
	}
</style>
