<!-- The style guide (/dev/styleguide, `npm run dev` only): what the site is
     built from, on one page, to look at in each theme before and after a
     change to the design.

     The tokens are not listed here by hand. They are read out of src/app.css
     itself, so a new token shows up without anyone remembering this page, and
     a `ui-` class that has no example here is named at the end of its section. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import css from '../../app.css?raw';
	import source from './StyleGuide.svelte?raw';
	import FormTables from '#lib/FormTables.svelte';
	import { formTables } from '#lib/forms.ts';
	import FrequencyMeter from '#lib/FrequencyMeter.svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon, { ICON_NAMES } from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import RelatedWords from '#lib/RelatedWords.svelte';
	import SaveButton from '#lib/SaveButton.svelte';
	import { plain } from '#lib/search/normalize.ts';
	import type { SearchResult } from '#lib/search/search.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordEntry } from '#lib/search/word.ts';
	import Sentence from '#lib/Sentence.svelte';
	import { applySetting, BACKGROUNDS, useSettings, type Background, type Theme } from '#lib/settings.ts';
	import ShareButton from '#lib/ShareButton.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import Tip from '#lib/Tip.svelte';
	import { useToasts } from '#lib/toasts.ts';
	import WordCard from '#lib/WordCard.svelte';

	// One real word from the dictionary (кава), as a search result and as the
	// entry of its own page. Null when the database does not have it.
	let { card, entry }: { card: SearchResult | null; entry: WordEntry | null } = $props();

	const settings = useSettings();
	const toasts = useToasts();

	const THEMES: Theme[] = ['system', 'light', 'sepia', 'dark'];

	function set<K extends 'theme' | 'background'>(name: K, value: string) {
		settings[name] = value as (typeof settings)[K];
		applySetting(name, settings[name]);
	}

	// Every custom property app.css defines, in the order it first appears,
	// with the note written after it on the same line, if any.
	interface Token {
		name: string;
		note: string;
	}
	const tokens: Token[] = [];
	for (const [, name, note = ''] of css.matchAll(/^\t+(--[a-z0-9-]+):[^;]+;(?:[ \t]*\/\*\s*(.*?)\s*\*\/)?/gm)) {
		if (!tokens.some((token) => token.name === name)) tokens.push({ name, note });
	}

	const GROUPS = {
		fonts: /^--font-/,
		sizes: /^--(text-|headword-|title$)/,
		corners: /^--radius-/,
		spaces: /^--space-/,
		widths: /^--(page|prose|frame-width)$/,
		shadows: /^--shadow/,
		other: /^--duration$/
	};
	const group = (name: keyof typeof GROUPS) => tokens.filter((token) => GROUPS[name].test(token.name));
	// Whatever is none of the above is a colour.
	const colours = tokens.filter((token) => !Object.values(GROUPS).some((pattern) => pattern.test(token.name)));

	// What each token comes to in the theme on screen (#f7f6f2, 0.88rem).
	let values = $state.raw<Record<string, string>>({});
	$effect(() => {
		// Read again when either of these changes; applySetting has by then
		// rewritten <html data-theme data-bg>.
		void settings.theme;
		void settings.background;
		const style = getComputedStyle(document.documentElement);
		values = Object.fromEntries(tokens.map(({ name }) => [name, style.getPropertyValue(name).trim()]));
	});

	// The `ui-` classes app.css defines that this file never writes.
	const classes = [...new Set(Array.from(css.matchAll(/\.(ui-[a-z0-9-]+)/g), (match) => match[1]))];
	const unshown = classes.filter((name) => !new RegExp(`${name}(?![a-z0-9-])`).test(source));

	const SAMPLE = 'Небокра́й — це лі́нія, де не́бо схо́диться із земле́ю.';
	const SAMPLE_EN = 'The horizon is the line where the sky meets the earth.';

	let pressed = $state(true);
	let chosen = $state('week');

	let tables = $derived(entry ? formTables(entry.pos, entry.forms, entry.word).tables : []);
	let own = $derived(
		new Set(entry ? [entry.word, ...entry.forms.map((f) => f.form).filter((form) => !form.includes(' '))].map(plain) : [])
	);
	let related = $derived(entry ? entry.relations.filter((x) => x.kind === 'derived' || x.kind === 'related') : []);
</script>

<PageMeta title="Style guide · Nebokrai" description="Every token, shared class and main component of the site. For development only." />

{#snippet token(t: Token)}
	<span class="name">{t.name}</span>
	<span class="value">{values[t.name] ?? ''}</span>
	{#if t.note}<span class="note">{t.note}</span>{/if}
{/snippet}

<div class="guide">
	<header class="top">
		<h1 class="ui-title">Style guide</h1>
		<p class="lead">
			What the site is built from. The tokens are read from <b>src/app.css</b>; the values are those of the theme
			on screen. This page exists in <b>npm run dev</b> only.
		</p>
		<div class="switches">
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-label="Theme"
				value={settings.theme}
				onValueChange={(value) => set('theme', value)}
			>
				{#each THEMES as theme (theme)}
					<RadioGroup.Item class="ui-segment" value={theme}>{theme}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-label="Background"
				value={settings.background}
				onValueChange={(value) => set('background', value as Background)}
			>
				{#each BACKGROUNDS as background (background)}
					<RadioGroup.Item class="ui-segment" value={background}>{background}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
		</div>
		<nav aria-label="Sections">
			{#each ['Colours', 'Type', 'Corners', 'Spacing', 'Widths', 'Shadows', 'Shared classes', 'Components', 'Icons'] as name (name)}
				<a href="#{name.toLowerCase().replace(' ', '-')}">{name}</a>
			{/each}
		</nav>
	</header>

	<section id="colours">
		<h2 class="ui-label">Colours</h2>
		<ul class="swatches">
			{#each colours as t (t.name)}
				<li>
					<span class="swatch" style:background="var({t.name})"></span>
					{@render token(t)}
				</li>
			{/each}
		</ul>
	</section>

	<section id="type">
		<h2 class="ui-label">Type</h2>
		<ul class="rows">
			{#each group('fonts') as t (t.name)}
				<li>
					<div class="caption">{@render token(t)}</div>
					<p class="specimen" lang="uk" style:font-family="var({t.name})"><Stressed text={SAMPLE} /></p>
					<p class="specimen" style:font-family="var({t.name})">{SAMPLE_EN} 0123456789</p>
				</li>
			{/each}
		</ul>
		<ul class="rows">
			{#each group('sizes') as t (t.name)}
				<li>
					<div class="caption">{@render token(t)}</div>
					{#if t.name.startsWith('--headword')}
						<p class="specimen headword" lang="uk" style:font-size="var({t.name})"><Stressed text="небокра́й" /></p>
					{:else if t.name === '--title'}
						<p class="specimen title" style:font-size="var({t.name})">The commonest words</p>
					{:else}
						<p class="specimen" style:font-size="var({t.name})">{SAMPLE_EN}</p>
					{/if}
				</li>
			{/each}
			<li>
				<div class="caption"><span class="name">body text</span><span class="value">1rem</span></div>
				<p class="specimen">{SAMPLE_EN}</p>
			</li>
		</ul>
	</section>

	<section id="corners">
		<h2 class="ui-label">Corners</h2>
		<ul class="boxes">
			{#each group('corners') as t (t.name)}
				<li>
					<span class="corner" style:border-radius="var({t.name})"></span>
					{@render token(t)}
				</li>
			{/each}
		</ul>
	</section>

	<section id="spacing">
		<h2 class="ui-label">Spacing</h2>
		<ul class="rows tight">
			{#each group('spaces') as t (t.name)}
				<li class="measure">
					<span class="bar" style:width="var({t.name})"></span>
					{@render token(t)}
				</li>
			{/each}
		</ul>
	</section>

	<section id="widths">
		<h2 class="ui-label">Widths</h2>
		<ul class="rows tight">
			{#each group('widths') as t (t.name)}
				<li>
					<div class="caption">{@render token(t)}</div>
					<span class="bar" style:max-width="var({t.name})"></span>
				</li>
			{/each}
		</ul>
	</section>

	<section id="shadows">
		<h2 class="ui-label">Shadows and motion</h2>
		<ul class="boxes">
			{#each group('shadows') as t (t.name)}
				<li>
					<span class="lifted" style:box-shadow="var({t.name})"></span>
					<span class="name">{t.name}</span>
				</li>
			{/each}
			{#each group('other') as t (t.name)}
				<li>{@render token(t)}</li>
			{/each}
		</ul>
	</section>

	<section id="shared-classes">
		<h2 class="ui-label">Shared classes</h2>
		<dl class="demos">
			<dt>ui-title</dt>
			<dd><p class="ui-title">Ukrainian grammar in brief</p></dd>

			<dt>ui-label</dt>
			<dd><p class="ui-label">Meanings</p></dd>

			<dt>ui-card</dt>
			<dd><div class="ui-card padded">Anything that lies on the page as a sheet.</div></dd>

			<dt>ui-senses</dt>
			<dd>
				<ol class="ui-senses">
					<li>coffee (the drink)</li>
					<li>coffee tree</li>
				</ol>
			</dd>

			<dt>ui-senses inline</dt>
			<dd>
				<ol class="ui-senses inline">
					<li>coffee (the drink);</li>
					<li>coffee tree</li>
				</ol>
			</dd>

			<dt>ui-btn</dt>
			<dd class="line">
				<button type="button" class="ui-btn">Export</button>
				<button type="button" class="ui-btn"><Icon name="download" size={16} />With an icon</button>
				<button type="button" class="ui-btn ui-btn-primary">Send</button>
				<button type="button" class="ui-btn" disabled>Disabled</button>
				<button type="button" class="ui-btn ui-btn-planned" disabled>Planned</button>
			</dd>

			<dt>ui-icon-btn</dt>
			<dd class="line">
				<button type="button" class="ui-icon-btn" aria-label="Search"><Icon name="search" /></button>
				<button
					type="button"
					class="ui-icon-btn"
					aria-label="Keyboard"
					aria-pressed={pressed}
					onclick={() => (pressed = !pressed)}
				>
					<Icon name="keyboard" />
				</button>
				<span class="note">The second one is pressed; click to release it.</span>
			</dd>

			<dt>ui-chip</dt>
			<dd class="line">
				{#each ['day', 'week', 'month'] as period (period)}
					<button type="button" class="ui-chip" aria-pressed={chosen === period} onclick={() => (chosen = period)}>
						{period}
					</button>
				{/each}
			</dd>

			<dt>ui-segmented, ui-segment</dt>
			<dd class="line"><span class="note">The theme switch at the top of this page.</span></dd>

			<dt>ui-field</dt>
			<dd class="fields">
				<input class="ui-field" type="text" placeholder="A text box" aria-label="A text box" />
				<textarea class="ui-field" rows="2" placeholder="A larger box for writing in" aria-label="A larger box"
				></textarea>
			</dd>

			<dt>ui-badge, ui-kbd</dt>
			<dd class="line">
				<span class="ui-badge">noun</span>
				<span class="ui-badge">feminine</span>
				<kbd class="ui-kbd">Ctrl</kbd>
				<kbd class="ui-kbd">K</kbd>
			</dd>

			<dt>ui-tooltip</dt>
			<dd class="line">
				<span class="ui-tooltip">Play the recording</span>
				<Tip label="A live one">
					{#snippet trigger(props)}
						<button type="button" class="ui-icon-btn" aria-label="A live one" {...props}><Icon name="help" /></button>
					{/snippet}
				</Tip>
			</dd>

			<dt>ui-popover</dt>
			<dd><div class="ui-popover">The settings menu and the list picker open in one of these.</div></dd>

			<dt>ui-popover ui-menu</dt>
			<dd>
				<div class="ui-popover ui-menu" role="menu" aria-label="An example menu">
					<div class="ui-menu-heading">Export</div>
					<div class="ui-menu-item" role="menuitem" tabindex="-1" data-highlighted>
						Under the pointer
					</div>
					<div class="ui-menu-item" role="menuitem" tabindex="-1">
						Anki deck
						<span class="ui-menu-note">Needs Anki open on this computer</span>
					</div>
					<div class="ui-menu-item" role="menuitem" tabindex="-1" aria-disabled="true" data-disabled>Disabled</div>
					<div class="ui-menu-separator"></div>
					<div class="ui-menu-item" role="menuitemradio" tabindex="-1" aria-checked="true" data-state="checked">
						All words <span class="ui-menu-count">212</span>
					</div>
					<div class="ui-menu-item" role="menuitemradio" tabindex="-1" aria-checked="false">
						Їжа <span class="ui-menu-count">31</span>
					</div>
				</div>
			</dd>

			<dt>ui-term, ui-term-note</dt>
			<dd class="line">
				<span>The <Term id="genitive" /> of кава is кави.</span>
				<span class="note">Press the word; the note is a ui-popover ui-term-note.</span>
			</dd>
			<dd>
				<div class="ui-popover ui-term-note">
					<p class="ui-term-name"><b>genitive</b> <span>родовий</span></p>
					<p>Of something, or none of it.</p>
					<p class="ui-term-example" lang="uk">ча́шка ка́ви <span lang="en">a cup of coffee</span></p>
					<a href="/grammar">More in the grammar</a>
				</div>
			</dd>

			<dt>ui-page, ui-overlay, ui-sr-only</dt>
			<dd class="line">
				<span class="note">
					The column of a dictionary page; the dimmed page behind the quick search (Ctrl+K); text for screen
					readers only.
				</span>
			</dd>
		</dl>
		{#if unshown.length}
			<p class="missing">In app.css but with no example here: {unshown.join(', ')}</p>
		{/if}
	</section>

	<section id="components">
		<h2 class="ui-label">Components</h2>
		<dl class="demos">
			<dt>Headword</dt>
			<dd class="stack">
				<Headword text="небокра́й" size="lg" />
				<Headword text="небокра́й" size="md" />
				<Headword text="небокра́й" size="sm" />
			</dd>

			<dt>Stressed</dt>
			<dd class="line" lang="uk">
				<Stressed text="рука́" />
				<Stressed text="ру́ки" moved />
			</dd>

			<dt>FrequencyMeter</dt>
			<dd class="line">
				<FrequencyMeter rank={227} showTier />
				<FrequencyMeter rank={4200} showTier />
				<FrequencyMeter rank={31000} showTier />
				<FrequencyMeter rank={null} showTier />
			</dd>

			<dt>Toasts</dt>
			<dd class="line">
				<button
					type="button"
					class="ui-btn"
					onclick={() => toasts.addToast({ data: { title: 'Saved', headword: 'ка́ва', undo: () => {} } })}
				>
					Show a toast
				</button>
			</dd>

			{#if entry}
				<dt>SaveButton, ShareButton</dt>
				<dd class="line">
					<SaveButton word={entry.word} headword={entry.headword} />
					<ShareButton path={wordPath(entry.word)} headword={entry.headword} />
				</dd>
			{/if}

			{#if card}
				<dt>WordCard</dt>
				<dd><WordCard entry={card} /></dd>
			{/if}

			{#if entry}
				{#if entry.examples.length}
					<dt>Sentence</dt>
					<dd lang="uk"><Sentence text={entry.examples[0].uk} {own} /></dd>
				{/if}

				{#if related.length}
					<dt>RelatedWords</dt>
					<dd><RelatedWords label="Related words" words={related} limit={12} /></dd>
				{/if}

				{#if tables.length}
					<dt>FormTables</dt>
					<dd><FormTables {tables} headword={entry.headword} /></dd>
				{/if}
			{:else}
				<dt>From the dictionary</dt>
				<dd class="note">кава was not found in nebokrai.db, so the components that need a word are left out.</dd>
			{/if}
		</dl>
	</section>

	<section id="icons">
		<h2 class="ui-label">Icons</h2>
		<ul class="icons">
			{#each ICON_NAMES as name (name)}
				<li><Icon {name} size={22} /><span class="name">{name}</span></li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.guide {
		display: grid;
		gap: var(--space-7);
		max-width: var(--frame-width);
		margin-inline: auto;
		padding: var(--space-6) var(--space-4) 0;
	}

	.top,
	section {
		display: grid;
		gap: var(--space-4);
		/* a grid item is as wide as its widest line unless told otherwise */
		min-width: 0;
	}

	.lead {
		max-width: var(--prose);
		margin: 0;
		color: var(--on-page);
		font-size: var(--text-lg);
	}

	.switches,
	nav,
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}

	.switches :global(.ui-segment) {
		text-transform: capitalize;
	}

	nav a {
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* A section's heading clears the sticky header when its link is followed */
	section {
		scroll-margin-top: var(--space-7);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.name {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.value,
	.note {
		color: var(--on-page);
		font-size: var(--text-xs);
	}

	.value {
		overflow-wrap: anywhere;
	}

	.swatches,
	.boxes,
	.icons {
		display: grid;
		/* two across on a phone */
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: var(--space-5) var(--space-4);
	}

	.swatches li,
	.boxes li {
		display: grid;
		align-content: start;
		gap: var(--space-1);
	}

	.swatch,
	.corner,
	.lifted {
		height: 3.5rem;
		margin-bottom: var(--space-1);
		border: 1px solid var(--border-strong);
	}

	.swatch {
		border-radius: var(--radius-md);
	}

	.corner {
		width: 7rem;
		background: var(--surface-2);
	}

	.lifted {
		border-color: var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}

	.rows {
		display: grid;
		gap: var(--space-5);
	}

	.rows.tight {
		gap: var(--space-3);
	}

	.rows li {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}

	.caption,
	.measure {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
	}

	.rows li.measure {
		display: flex;
		align-items: center;
	}

	.specimen {
		margin: 0;
		line-height: 1.3;
	}

	.specimen.headword {
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.specimen.title {
		font-family: var(--font-heading);
		font-weight: 700;
	}

	.bar {
		display: block;
		height: var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--accent);
	}

	/* A name on the left and its example on the right; one under the other
	   on a phone */
	.demos {
		display: grid;
		grid-template-columns: 12rem minmax(0, 1fr);
		gap: var(--space-5) var(--space-4);
		margin: 0;
	}

	.demos dt {
		grid-column: 1;
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.demos dd {
		grid-column: 2;
		min-width: 0;
		margin: 0;
	}

	@media (max-width: 700px) {
		.demos {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-2);
		}

		.demos dt,
		.demos dd {
			grid-column: 1;
		}

		.demos dd {
			margin-bottom: var(--space-5);
		}
	}

	.padded {
		padding: var(--space-4);
	}

	.fields,
	.stack {
		display: grid;
		gap: var(--space-2);
		max-width: 24rem;
	}

	.stack {
		justify-items: start;
	}

	.missing {
		margin: 0;
		color: var(--stress);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.icons {
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: var(--space-4);
	}

	.icons li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
