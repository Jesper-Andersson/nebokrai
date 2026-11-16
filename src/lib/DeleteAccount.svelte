<!-- Delete account: there to be found, not to be pressed by mistake. At the
     foot of the settings menu and on the Saved page, for a visitor who is
     signed in. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let failed = $state(false);

	async function deleteAccount() {
		if (!confirm(m.account.deleteConfirm)) return;
		const res = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
		if (res?.ok) location.href = '/';
		else failed = true;
	}
</script>

<button type="button" class="quiet" onclick={deleteAccount}>{m.account.delete}</button>
{#if failed}<p role="alert">{m.account.deleteFailed}</p>{/if}

<style>
	.quiet {
		justify-self: start;
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

	p {
		margin: 0;
		font-size: var(--text-sm);
	}
</style>
