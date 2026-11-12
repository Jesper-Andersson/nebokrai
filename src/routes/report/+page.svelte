<!-- "Report an issue". Sends to /api/report, which stores the report in the
     private reports database (src/lib/server/reports.ts) and announces it by email. Still to come:
     Cloudflare Turnstile against spam. -->
<script lang="ts">
	import Grammar from '#lib/Grammar.svelte';
	import Headword from '#lib/Headword.svelte';
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { REPORT_KINDS, type ReportKind } from '#lib/report.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// svelte-ignore state_referenced_locally
	let kind = $state<ReportKind | null>(data.kind);
	let message = $state('');
	let email = $state('');
	let sent = $state(false);
	let sending = $state(false);
	let showError = $state(false);
	// Why sending failed, if it did.
	let failure = $state<'too_many' | 'failed' | null>(null);
	// Honeypot: hidden from people, so only bots fill it in.
	let website = $state('');

	const wiktionary = (word: string) => `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Ukrainian`;

	// Everything the report would carry. Shown to the reporter after sending,
	// so nothing goes out that they haven't seen.
	let payload = $derived({
		kind,
		message: message.trim(),
		email: email.trim() || null,
		entry: data.entry ? { id: data.entry.id, word: data.entry.word, pos: data.entry.pos } : null,
		query: data.query || null,
		page: fromPage()
	});

	// The page on this site the reporter came from, if any.
	function fromPage(): string | null {
		if (typeof document === 'undefined' || !document.referrer) return null;
		try {
			const url = new URL(document.referrer);
			return url.origin === location.origin ? url.pathname + url.search : null;
		} catch {
			return null;
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		if (!kind || !message.trim()) {
			showError = true;
			return;
		}
		sending = true;
		failure = null;
		try {
			const res = await fetch('/api/report', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...payload, entry: data.entry?.id ?? null, website })
			});
			if (res.status === 429) failure = 'too_many';
			else if (!res.ok) failure = 'failed';
			else sent = true;
		} catch {
			failure = 'failed';
		} finally {
			sending = false;
		}
	}

	function reset() {
		message = '';
		sent = false;
		showError = false;
		failure = null;
	}
</script>

<TextPage title={m.report.title} description={m.meta.report}>
	{#if sent}
		<section class="thanks" aria-live="polite">
			<h2>{m.report.thanks}</h2>
			<p>{m.report.thanksBody}</p>

			{#if data.entry || (kind === 'missing' && data.query)}
				<p>{m.report.fixUpstream}</p>
				<ul class="upstream">
					{#if data.entry}
						<li><a href={wiktionary(data.entry.word)} rel="noopener">{m.report.onWiktionary(data.entry.word)}</a></li>
					{:else}
						<li><a href={wiktionary(data.query)} rel="noopener">{m.report.addToWiktionary(data.query)}</a></li>
					{/if}
				</ul>
			{/if}

			<details>
				<summary>{m.report.preview}</summary>
				<pre>{JSON.stringify(payload, null, 2)}</pre>
			</details>

			<button type="button" class="ui-btn" onclick={reset}>{m.report.another}</button>
		</section>
	{:else}
		<p class="muted">{m.report.intro}</p>

		<form onsubmit={submit} novalidate>
			{#if data.entry || data.query}
				<p class="context">
					<span class="muted">{m.report.contextLabel}</span>
					{#if data.entry}
						<Headword text={data.entry.headword} size="sm" tag="b" />
						<Grammar pos={data.entry.pos} inline />
					{:else}
						{m.report.contextQuery(data.query)}
					{/if}
				</p>
			{/if}

			<fieldset>
				<legend>{m.report.kindLegend}</legend>
				<div class="kinds">
					{#each REPORT_KINDS as k (k)}
						<label class="ui-chip">
							<input type="radio" name="kind" value={k} bind:group={kind} />
							{m.report.kinds[k]}
						</label>
					{/each}
				</div>
			</fieldset>

			<label class="field" for="report-message">
				<span>{m.report.messageLabel}</span>
				<textarea
					id="report-message"
					class="ui-field"
					rows="4"
					maxlength="2000"
					bind:value={message}
					placeholder={kind ? m.report.placeholders[kind] : m.report.placeholders.other}
					aria-invalid={showError && !message.trim()}
					aria-describedby={showError ? 'report-error' : undefined}
				></textarea>
			</label>

			<label class="field" for="report-email">
				<span>{m.report.emailLabel}</span>
				<input id="report-email" class="ui-field" type="email" autocomplete="email" bind:value={email} />
				<small class="muted">{m.report.emailHint}</small>
			</label>

			<!-- Honeypot: hidden from people and screen readers -->
			<div class="trap" aria-hidden="true">
				<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} /></label>
			</div>

			{#if showError && (!kind || !message.trim())}
				<p class="error" id="report-error" role="alert">{m.report.required}</p>
			{/if}
			{#if failure}
				<p class="error" role="alert">{failure === 'too_many' ? m.report.tooMany : m.report.failed}</p>
			{/if}

			<button type="submit" class="ui-btn ui-btn-primary" disabled={sending}>
				{sending ? m.report.sending : m.report.send}
			</button>
		</form>
	{/if}
</TextPage>

<style>
	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	form {
		display: grid;
		gap: 1.1rem;
		margin-top: 1rem;
	}

	.context {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.1rem 0.5rem;
		margin: 0;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--surface);
		border: 1px solid var(--border);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend,
	.field > span {
		margin-bottom: 0.4rem;
		font-weight: 700;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* The radio buttons stay for keyboard and screen readers; the chips show the choice */
	.kinds input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.field {
		display: grid;
		gap: 0.3rem;
	}

	textarea {
		resize: vertical;
	}

	textarea[aria-invalid='true'] {
		border-color: var(--stress);
	}

	.error {
		margin: 0;
		color: var(--stress);
		font-weight: 600;
	}

	/* A button is as wide as its words, not as the form */
	button {
		justify-self: start;
	}

	.thanks {
		display: grid;
		gap: 0.5rem;
	}

	.thanks h2 {
		margin-top: 0.5rem;
	}

	.upstream {
		margin: 0;
		padding-left: 1.2rem;
	}

	details {
		margin-top: 0.5rem;
	}

	summary {
		color: var(--muted);
		cursor: pointer;
	}

	pre {
		overflow-x: auto;
		margin: 0.5rem 0 0;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--surface);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
	}
</style>
