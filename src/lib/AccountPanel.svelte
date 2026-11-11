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
		<div class="buttons">
			{#each providers as provider (provider)}
				<!-- A server route that redirects to the provider, so a full page load -->
				<a class="ui-btn" href="/login/{provider}" data-sveltekit-reload>
					{m.account.signInWith(names[provider])}
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
