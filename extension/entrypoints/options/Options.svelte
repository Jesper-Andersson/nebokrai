<!-- The settings page (design B, "settings page" in "Nebokrai design –
     Extension card" in Figma): the choices on the left, and beside them a
     sentence whose words open the card as a page's would, wearing what is
     chosen:

       Opening the card                     Try it on this sentence
         Hold a key and point  [Ctrl|Alt…]  Дайте, будь ласка, склянку води.
         Double-click a word        (on)    ┌ скля́нка  noun · feminine ┐
       How it looks                         │ glass (drinking vessel)  │
         Theme   [System|Light|Sepia|Dark]  └──────────────────────────┘
         …

     A change is kept at once, and open pages follow it. The card is the
     content script's own (Card.svelte), drawn in place. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { GlossAnswer } from '../../../src/lib/gloss.ts';
	import { plain } from '../../../src/lib/search/normalize.ts';
	import { tokens } from '../../../src/lib/sentence.ts';
	import { SITE, type GlossReply, type GlossRequest } from '../../lib/api.ts';
	import { messagesFor } from '../../lib/messages.ts';
	import {
		DEFAULTS,
		FONTS,
		HOVER_KEYS,
		readSettings,
		SIZES,
		THEMES,
		writeSettings,
		type Settings
	} from '../../lib/settings.ts';
	import Card from '../content/Card.svelte';
	import { card, look } from '../content/state.svelte.ts';

	const m = messagesFor(browser.i18n.getUILanguage()).options;

	let settings = $state<Settings>({ ...DEFAULTS });

	// The sentence the site's own docs explain the card with: it has a word in
	// a case (склянку), a pair that is one entry (будь ласка) and a spelling
	// that is two words (води)
	const parts = tokens('Дайте, будь ласка, склянку води.');
	// What the site answers for склянку, so the card is there before anything
	// is asked, and with no connection
	const SAMPLE: GlossAnswer = {
		phrase: null,
		readings: [
			{
				word: 'склянка',
				headword: 'скля́нка',
				pos: 'noun',
				tags: ['feminine', 'inanimate'],
				forms: [{ form: 'скля́нку', labels: ['accusative singular'] }],
				meaning: 'glass (drinking vessel)',
				freq_rank: 3095
			}
		]
	};
	let chosen = $state(parts.findIndex((part) => part.text === 'склянку'));
	Object.assign(card, { open: true, text: 'склянку', answer: SAMPLE, failed: false, saved: null });

	function wear() {
		look.theme = settings.theme;
		look.font = settings.font;
		look.size = settings.size;
	}

	onMount(async () => {
		settings = await readSettings();
		wear();
	});

	function change<K extends keyof Settings>(key: K, value: Settings[K]) {
		settings[key] = value;
		wear();
		void writeSettings({ [key]: value } as Partial<Settings>);
	}

	/** The word `step` tokens from token `i`, when a space alone stands between (as the content script reads a page). */
	function neighbour(i: number, step: -2 | 2): string | undefined {
		const between = parts[i + step / 2];
		const word = parts[i + step];
		return between && word?.word && /^\s+$/.test(between.text) ? word.text : undefined;
	}

	/** Opens the card for a word of the sentence, asking the site as a page's word would. */
	async function ask(i: number) {
		if (i === chosen && (card.answer || card.failed)) return;
		chosen = i;
		const mine = ++card.asked;
		Object.assign(card, { open: true, text: parts[i].text, answer: null, failed: false, saved: null });
		const request: GlossRequest = { type: 'gloss', w: plain(parts[i].text) };
		const before = neighbour(i, -2);
		const after = neighbour(i, 2);
		if (before) request.before = plain(before);
		if (after) request.after = plain(after);
		let reply: GlossReply | undefined;
		try {
			reply = await browser.runtime.sendMessage(request);
		} catch {
			reply = undefined;
		}
		if (mine !== card.asked) return;
		if (reply?.ok) card.answer = reply.answer;
		else card.failed = true;
	}

	const held = (event: MouseEvent) =>
		settings.hoverKey === 'ctrl'
			? event.ctrlKey
			: settings.hoverKey === 'alt'
				? event.altKey
				: settings.hoverKey === 'shift'
					? event.shiftKey
					: false;
</script>

<!-- One choice of a few, all in view: the site's segmented control, made of radio buttons -->
{#snippet segmented(
	key: 'hoverKey' | 'theme' | 'font' | 'size',
	values: readonly string[],
	names: Record<string, string>,
	label: string
)}
	<span class="seg" role="radiogroup" aria-label={label}>
		{#each values as value (value)}
			<label class:on={settings[key] === value}>
				<input
					type="radio"
					name={key}
					{value}
					checked={settings[key] === value}
					onchange={() => change(key, value as never)}
				/>{names[value]}
			</label>
		{/each}
	</span>
{/snippet}

<main>
	<header>
		<img src="/icon/48.png" alt="" width="28" height="28" />
		<h1>Nebokrai <span>{m.title}</span></h1>
	</header>

	<div class="page">
		<div class="choices">
			<section>
				<h2>{m.opening}</h2>
				<div class="row">
					<span><b>{m.hoverKey}</b><small>{m.hoverKeyHint}</small></span>
					{@render segmented('hoverKey', HOVER_KEYS, m.keys, m.hoverKey)}
				</div>
				<label class="row">
					<span><b>{m.doubleClick}</b></span>
					<input
						type="checkbox"
						role="switch"
						checked={settings.doubleClick}
						onchange={(event) => change('doubleClick', event.currentTarget.checked)}
					/>
				</label>
			</section>

			<section>
				<h2>{m.looks}</h2>
				<div class="row">
					<span><b>{m.theme}</b></span>
					{@render segmented('theme', THEMES, m.themes, m.theme)}
				</div>
				<div class="row">
					<span><b>{m.font}</b></span>
					{@render segmented('font', FONTS, m.fonts, m.font)}
				</div>
				<div class="row">
					<span><b>{m.size}</b></span>
					{@render segmented('size', SIZES, m.sizes, m.size)}
				</div>
			</section>

			<p class="sent">{m.sent} <a href="{SITE}/privacy" target="_blank" rel="noopener">{m.privacy}</a></p>
		</div>

		<aside>
			<small>{settings.hoverKey === 'off' && !settings.doubleClick ? m.tryItOff : m.tryIt}</small>
			<p class="sentence" lang="uk">
				{#each parts as part, i (i)}{#if part.word}<button
							type="button"
							class:chosen={i === chosen}
							ondblclick={() => settings.doubleClick && ask(i)}
							onmousemove={(event) => held(event) && ask(i)}
							onclick={(event) => event.detail === 0 && ask(i)}>{part.text}</button
						>{:else}{part.text}{/if}{/each}
			</p>
			<Card inline />
		</aside>
	</div>
</main>

<style>
	main {
		box-sizing: border-box;
		max-width: 980px;
		margin: 0 auto;
		padding: 28px 24px 48px;
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 22px;
	}

	h1 {
		margin: 0;
		font:
			700 24px/1.2 'Noto Serif',
			Cambria,
			'Times New Roman',
			serif;
	}

	h1 span {
		color: var(--muted);
		font:
			400 15px/1.2 system-ui,
			sans-serif;
	}

	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 400px);
		gap: 28px;
		align-items: start;
	}

	/* Too narrow for two columns: the sentence and its card come first, the choices under them */
	@media (max-width: 820px) {
		.page {
			grid-template-columns: minmax(0, 1fr);
		}

		aside {
			order: -1;
		}
	}

	section + section {
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--border);
	}

	h2 {
		margin: 0 0 8px;
		font:
			700 17px/1.3 'Noto Serif',
			Cambria,
			'Times New Roman',
			serif;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 7px 0;
	}

	.row b {
		display: block;
		font-weight: 600;
	}

	small {
		color: var(--muted);
		font-size: 13px;
	}

	.seg {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
	}

	.seg label {
		padding: 4px 11px;
		border-radius: 7px;
		color: var(--ink-2);
		white-space: nowrap;
		cursor: pointer;
	}

	.seg label.on {
		background: var(--raised);
		color: var(--ink);
		font-weight: 600;
		box-shadow: 0 1px 2px rgb(22 24 29 / 0.14);
	}

	/* The radio button is there for the keyboard and a screen reader; the label is what is seen */
	.seg input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.seg label:has(input:focus-visible),
	[role='switch']:focus-visible,
	.sentence button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	[role='switch'] {
		appearance: none;
		position: relative;
		flex: none;
		width: 38px;
		height: 22px;
		margin: 0;
		border-radius: 999px;
		background: var(--border-strong);
		cursor: pointer;
	}

	[role='switch']::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--surface);
		transition: left 0.12s;
	}

	[role='switch']:checked {
		background: var(--accent);
	}

	[role='switch']:checked::after {
		left: 19px;
		background: var(--accent-ink);
	}

	.sent {
		margin: 22px 0 0;
		padding-top: 14px;
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-size: 13px;
	}

	a {
		color: var(--accent);
	}

	aside {
		box-sizing: border-box;
		padding: 16px 18px 20px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
	}

	.sentence {
		margin: 6px 0 14px;
		font:
			400 19px/1.6 'Noto Serif',
			Cambria,
			'Times New Roman',
			serif;
	}

	.sentence button {
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.sentence button.chosen {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}
</style>
