<!-- The comments at the foot of a grammar point's page, as the user picked
     them in Figma on 2026-11-18 ("A, ruled line"): one line between two
     rules, in the page's own type, that folds open into a plain list without
     frames (as the page's examples are) and the form under it.

       ─────────────────────────────────────
       Comments 3                         ⌄
       ─────────────────────────────────────
       Oksana  18 Nov 2026          Report
       A trick that helped me…
       [ Ask a question or share a tip…   ]
       [Name (optional)]  Shown at once…
       [Turnstile]  [Post comment]

     Anyone may post, with or without a name; a comment is shown at once and
     anyone may report it (/api/comments, docs/api.md). The site's keeper also
     sees the hidden ones, with Hide and Show again. A Melt Collapsible, closed
     on every visit. -->
<script lang="ts">
	import { Collapsible } from 'melt/builders';
	import { page } from '$app/state';
	import { MAX_COMMENT, MAX_COMMENT_NAME, type Comment } from '#lib/comments.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import { useToasts } from '#lib/toasts.ts';
	import Turnstile from './Turnstile.svelte';

	let { pageId, comments: initial, keeper = false, sitekey: givenKey = null }: {
		/** The grammar point's id: 'genitive-after-bez'. */
		pageId: string;
		/** As the server loaded them, newest first. */
		comments: Comment[];
		/** The site's keeper: sees hidden comments and can hide or show them. */
		keeper?: boolean;
		/** The bot check's site key, or null when the server checks no token. */
		sitekey?: string | null;
	} = $props();

	const settings = useSettings();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));

	// Written over when a comment is posted or hidden, so it shows at once; made
	// again from the props when the page moves to another point (the component
	// is kept between them)
	let comments = $derived<Comment[]>([...initial]);

	// A signed-in reader is not asked for the bot check (see /api/comments)
	let sitekey = $derived(page.data.user ? null : givenKey);
	let shown = $derived(comments.filter((comment) => !comment.hidden).length);

	let open = $state(false);
	const fold = new Collapsible({ open: () => open, onOpenChange: (now) => (open = now) });

	let body = $state('');
	let name = $state('');
	let token = $state<string | null>(null);
	let check = $state<Turnstile>();
	let sending = $state(false);
	let problem = $state<string | null>(null);

	// The name and the comments this browser reported are kept, so the name
	// need not be typed again and a comment is not reported twice from here.
	// A browser that refuses storage just asks again.
	const NAME_KEY = 'comment-name';
	const REPORTED_KEY = 'comments-reported';
	let reported = $state<number[]>([]);

	$effect(() => {
		try {
			name = (localStorage.getItem(NAME_KEY) ?? '').slice(0, MAX_COMMENT_NAME);
			const kept = JSON.parse(localStorage.getItem(REPORTED_KEY) ?? '[]');
			if (Array.isArray(kept)) reported = kept.filter((id) => Number.isInteger(id));
		} catch {
			// Nothing kept, or storage is off
		}
	});

	// British order in English (18 Nov 2026). UTC on both sides, so the server
	// and the browser write the same date
	const locale = $derived(settings.lang === 'uk' ? 'uk' : 'en-GB');
	const date = $derived(new Intl.DateTimeFormat(locale, {
		day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
	}));
	const max = $derived(MAX_COMMENT.toLocaleString(locale));

	async function post(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		if (!body.trim()) {
			problem = m.comments.empty;
			return;
		}
		if (sitekey && !token) {
			problem = m.report.check;
			return;
		}
		sending = true;
		problem = null;
		let status = 0;
		let added: Comment | null = null;
		try {
			const response = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ page: pageId, body, name, turnstile: token })
			});
			status = response.status;
			if (status === 200) added = ((await response.json()) as { comment: Comment | null }).comment;
		} catch {
			// No answer: the same message as a refusal
		}
		sending = false;
		// The token went with this send and works once
		check?.reset();
		if (status === 200) {
			if (added) comments = [keeper ? { ...added, hidden: false, reports: 0 } : added, ...comments];
			body = '';
			try {
				localStorage.setItem(NAME_KEY, name.trim());
			} catch {
				// Storage is off: the next comment asks again
			}
			toaster.addToast({ data: { title: m.comments.posted } });
			return;
		}
		problem =
			status === 413 ? m.comments.tooLong
			: status === 429 ? m.comments.tooMany
			: status === 403 || status === 503 ? m.report.check
			: m.comments.failed;
	}

	async function report(comment: Comment) {
		let ok = false;
		try {
			ok = (await fetch(`/api/comments/${comment.id}/report`, { method: 'POST' })).ok;
		} catch {
			// No answer
		}
		if (!ok) {
			toaster.addToast({ data: { title: m.comments.actionFailed } });
			return;
		}
		reported = [...reported, comment.id];
		try {
			localStorage.setItem(REPORTED_KEY, JSON.stringify(reported.slice(-500)));
		} catch {
			// Storage is off: the button comes back on the next visit
		}
		toaster.addToast({ data: { title: m.comments.reportThanks } });
	}

	async function setHidden(comment: Comment, hidden: boolean) {
		let ok = false;
		try {
			ok = (await fetch(`/api/comments/${comment.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ hidden })
			})).ok;
		} catch {
			// No answer
		}
		if (!ok) {
			toaster.addToast({ data: { title: m.comments.actionFailed } });
			return;
		}
		comments = comments.map((each) => (each.id === comment.id ? { ...each, hidden } : each));
	}
</script>

<section class="comments" aria-labelledby="comments-title">
	<h2 id="comments-title" class="heading">
		<button {...fold.trigger} type="button" class="toggle">
			{m.comments.title}
			{#if shown}<span class="count">{shown}</span>{/if}
			<svg class="chevron" class:up={open} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</h2>

	<div {...fold.content} class="body">
		{#if fold.open}
			{#if comments.length}
				<ul class="list">
					{#each comments as comment (comment.id)}
						{@const who = comment.name ?? m.comments.anonymous}
						<li class:hidden={comment.hidden}>
							<p class="who">
								<b class:anonymous={!comment.name}>{who}</b>
								<time datetime={new Date(comment.created_at).toISOString()}>{date.format(comment.created_at)}</time>
								{#if keeper}
									{#if comment.hidden}<span class="flag">{m.comments.hidden}</span>{/if}
									{#if comment.reports}<span class="flag">{m.comments.reports(comment.reports)}</span>{/if}
								{/if}
								<span class="actions">
									{#if keeper}
										<button type="button" class="quiet" onclick={() => setHidden(comment, !comment.hidden)}>
											{comment.hidden ? m.comments.unhide : m.comments.hide}
										</button>
									{/if}
									{#if !comment.hidden}
										{#if reported.includes(comment.id)}
											<span class="done">{m.comments.reported}</span>
										{:else}
											<button type="button" class="quiet" aria-label={m.comments.reportLabel(who)} onclick={() => report(comment)}>
												{m.comments.report}
											</button>
										{/if}
									{/if}
								</span>
							</p>
							<p class="text">{comment.body}</p>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="none">{m.comments.none}</p>
			{/if}

			<form class="form" onsubmit={post}>
				<label class="ui-sr-only" for="comment-body">{m.comments.label}</label>
				<textarea
					id="comment-body"
					class="ui-field"
					rows="4"
					maxlength={MAX_COMMENT}
					placeholder={m.comments.placeholder}
					bind:value={body}
					aria-invalid={problem === m.comments.empty ? 'true' : undefined}
				></textarea>
				<div class="row">
					<label class="ui-sr-only" for="comment-name">{m.comments.name}</label>
					<input
						id="comment-name"
						class="ui-field name"
						maxlength={MAX_COMMENT_NAME}
						autocomplete="nickname"
						placeholder={m.comments.name}
						bind:value={name}
					/>
					<span class="note">{m.comments.note(max)}</span>
				</div>
				<div class="row">
					{#if sitekey}<Turnstile bind:this={check} bind:token {sitekey} />{/if}
					<button type="submit" class="ui-btn ui-btn-primary" disabled={sending}>
						{sending ? m.comments.posting : m.comments.post}
					</button>
				</div>
				{#if problem}<p class="problem" role="alert">{problem}</p>{/if}
			</form>
		{/if}
	</div>
</section>

<style>
	.comments {
		margin-top: 1.5rem;
		font-family: var(--font-text);
	}

	/* The line between two rules: the whole width opens and closes it */
	.heading {
		margin: 0;
		font-size: var(--text-md);
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.85rem 0;
		border: 0;
		border-block: 1px solid var(--border);
		background: none;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.toggle[aria-expanded='true'] {
		border-bottom-color: transparent;
	}

	.toggle:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.count {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	.chevron {
		margin-left: auto;
		color: var(--muted);
		transition: transform var(--duration);
	}

	.chevron.up {
		transform: rotate(180deg);
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.list li {
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--border);
	}

	.list li.hidden {
		opacity: 0.6;
	}

	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.5rem;
		margin: 0;
		font-size: var(--text-sm);
	}

	.who b {
		font-weight: 600;
	}

	.who b.anonymous {
		color: var(--muted);
		font-weight: 400;
	}

	time,
	.flag,
	.done {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		margin-left: auto;
	}

	.quiet {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-xs);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.quiet:hover {
		color: var(--ink);
	}

	.text {
		margin: 0.3rem 0 0;
		color: var(--ink-2);
		line-height: 1.5;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	.none {
		margin: 0.5rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.form {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.9rem;
	}

	.form textarea {
		resize: vertical;
		font: inherit;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.row .name {
		width: 15rem;
		max-width: 100%;
		font: inherit;
	}

	.note {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.problem {
		margin: 0;
		color: var(--stress);
		font-size: var(--text-sm);
	}
</style>
