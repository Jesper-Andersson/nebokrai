<!-- "Report an issue". Sends to /api/report, which stores the report in the
     private reports database (src/lib/server/reports.ts). Still to come: an
     email notification, and Cloudflare Turnstile against spam. -->
<script lang="ts">
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
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

<!-- A word with its stressed vowel (letter + U+0301) in red -->
{#snippet stressed(text: string)}{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span
				class="stress">{part}</span
			>{:else}{part}{/if}{/each}{/snippet}

<TextPage title={m.report.title}>
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

			<button type="button" class="secondary" onclick={reset}>{m.report.another}</button>
		</section>
	{:else}
		<p class="muted">{m.report.intro}</p>

		<form onsubmit={submit} novalidate>
			{#if data.entry || data.query}
				<p class="context">
					<span class="muted">{m.report.contextLabel}</span>
					{#if data.entry}
						<b lang="uk" class="headword">{@render stressed(data.entry.headword)}</b>
						({posLabel(m, data.entry.pos)})
					{:else}
						{m.report.contextQuery(data.query)}
					{/if}
				</p>
			{/if}

			<fieldset>
				<legend>{m.report.kindLegend}</legend>
				<div class="kinds">
					{#each REPORT_KINDS as k (k)}
						<label class="chip" class:on={kind === k}>
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
				<input id="report-email" type="email" autocomplete="email" bind:value={email} />
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

			<button type="submit" class="primary" disabled={sending}>{sending ? m.report.sending : m.report.send}</button>
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
		margin: 0;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		background: var(--surface);
		border: 1px solid var(--border);
	}

	.headword {
		font-family: var(--font-headword);
		font-size: 1.15rem;
	}

	.stress {
		color: var(--stress);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend,
	.field > span {
		margin-bottom: 0.4rem;
		font-family: var(--font-heading);
		font-weight: 700;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		padding: 0.3rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		cursor: pointer;
	}

	.chip.on {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}

	/* Fingers need bigger targets than a mouse pointer does */
	@media (pointer: coarse) {
		.chip {
			padding-block: 0.5rem;
		}
	}

	.chip:has(input:focus-visible) {
		outline: 3px solid var(--accent);
		outline-offset: 2px;
	}

	/* The radio buttons stay for keyboard and screen readers; the chips show the choice */
	.chip input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.field {
		display: grid;
		gap: 0.3rem;
	}

	textarea,
	input[type='email'] {
		box-sizing: border-box;
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 1.5px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}

	textarea {
		resize: vertical;
	}

	textarea:focus-visible,
	input[type='email']:focus-visible {
		outline: 3px solid #5b8fd6;
		outline-offset: 1px;
	}

	textarea[aria-invalid='true'] {
		border-color: var(--stress);
	}

	.error {
		margin: 0;
		color: var(--stress);
		font-weight: 600;
	}

	button {
		justify-self: start;
		padding: 0.55rem 1.3rem;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.primary {
		border: 0;
		background: var(--accent);
		color: var(--accent-ink);
	}

	.primary:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.secondary {
		border: 1.5px solid var(--border-strong);
		background: var(--surface);
		color: var(--ink);
	}

	button:focus-visible {
		outline: 3px solid #5b8fd6;
		outline-offset: 2px;
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
		border-radius: 6px;
		background: var(--surface);
		border: 1px solid var(--border);
		font-size: 0.85rem;
	}
</style>
