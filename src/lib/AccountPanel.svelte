<!-- Sign-in buttons, or who is signed in with Sign out and Delete account.
     Shown in the settings menu and on the Saved page. Renders nothing where
     accounts are not set up. -->
<script lang="ts">
	import { page } from '$app/state';
	import { messagesFor } from '#lib/i18n.ts';
	import type { Provider, User } from '#lib/server/users.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	// Both come from the root layout's load (src/routes/+layout.server.ts).
	let user = $derived(page.data.user as User | null);
	let providers = $derived(page.data.providers as Provider[]);

	const names = { google: 'Google', github: 'GitHub' };
	let deleteFailed = $state(false);

	async function deleteAccount() {
		if (!confirm(m.account.deleteConfirm)) return;
		const res = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
		if (res?.ok) location.href = '/';
		else deleteFailed = true;
	}
</script>

{#if user}
	<div class="account">
		<p>{user.name ? m.account.signedInAs(user.name) : m.account.signedIn}</p>
		<div class="buttons">
			<form method="POST" action="/logout">
				<button type="submit" class="ui-btn">{m.account.signOut}</button>
			</form>
			<button type="button" class="quiet" onclick={deleteAccount}>{m.account.delete}</button>
		</div>
		{#if deleteFailed}<p role="alert">{m.account.deleteFailed}</p>{/if}
	</div>
{:else if providers.length}
	<div class="account">
		<p>{m.account.signInHint}</p>
		<!-- The hint above already says "Sign in", so a button shows only the
		     provider's mark and name; the full sentence is its accessible name. -->
		<div class="providers">
			{#each providers as provider (provider)}
				<!-- A server route that redirects to the provider, so a full page load -->
				<a
					class="ui-btn"
					href="/login/{provider}"
					aria-label={m.account.signInWith(names[provider])}
					data-sveltekit-reload
				>
					{#if provider === 'google'}
						<!-- Google's mark keeps its own four colours in both themes -->
						<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
							<path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
							<path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
							<path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
						</svg>
					{:else}
						<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
							<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
						</svg>
					{/if}
					{names[provider]}
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.account {
		display: grid;
		gap: 0.5rem;
		max-width: 22rem;
	}

	p {
		margin: 0;
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
	}

	/* One row of equal buttons, however many providers are set up */
	.providers {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 0.5rem;
	}

	.providers a {
		justify-content: center;
		text-decoration: none;
	}

	.providers svg {
		flex: none;
	}

	/* Delete account: there to be found, not to be pressed by mistake */
	.quiet {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
		opacity: 0.8;
		cursor: pointer;
	}
</style>
