<!-- The Saved page's account block: the Log in button, or who is signed in
     with Log out and Delete account. Renders nothing where accounts are not
     set up. The settings menu shows the same parts apart: who is signed in at
     its top, Delete account at its foot. -->
<script lang="ts">
	import { page } from '$app/state';
	import DeleteAccount from '#lib/DeleteAccount.svelte';
	import LoginButton from '#lib/LoginButton.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import type { Provider, User } from '#lib/server/users.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	// Both come from the root layout's load (src/routes/+layout.server.ts).
	let user = $derived(page.data.user as User | null);
	let providers = $derived(page.data.providers as Provider[]);
</script>

{#if user}
	<div class="account">
		<p>{user.name ? m.account.signedInAs(user.name) : m.account.signedIn}</p>
		<div class="buttons">
			<form method="POST" action="/logout">
				<button type="submit" class="ui-btn">{m.account.signOut}</button>
			</form>
			<DeleteAccount />
		</div>
	</div>
{:else if providers.length}
	<div class="account">
		<p>{m.account.signInHint}</p>
		<div><LoginButton /></div>
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
</style>
