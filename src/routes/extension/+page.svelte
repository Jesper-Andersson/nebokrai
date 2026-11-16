<!-- The browser extension's own page: what it does and where to get it
     (design 1 on the "advertise" page of "Nebokrai design – Extension card"
     in Figma). The store listings, the About entry, the footer and the hint
     in the gloss card all lead here. It exists only once a store has the
     extension: see src/lib/extension.ts. -->
<script lang="ts">
	import TextPage from '#lib/TextPage.svelte';
	import { offered } from '#lib/extension.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let uk = $derived(settings.lang === 'uk');

	// The visitor's own browser first, and its button the filled one
	let stores = $derived(
		[...offered()].sort((a, b) => Number(b.browser === data.browser) - Number(a.browser === data.browser))
	);
</script>

<TextPage title={m.pageTitle.extension} description={m.meta.extension}>
	<p class="lead">
		{#if uk}
			Двічі клацніть українське слово на будь-якій сторінці й побачте, що це за слово і що воно означає,
			не відриваючись від читання.
		{:else}
			Double-click a Ukrainian word on any page and see what it is and what it means, without leaving
			what you are reading.
		{/if}
	</p>

	<div class="stores">
		{#each stores as store (store.browser)}
			{@const own = store.browser === data.browser}
			{@const label = own ? (uk ? `Додати до ${store.name}` : `Add to ${store.name}`) : store.name}
			{#if store.url}
				<a class="ui-btn" class:ui-btn-primary={own} href={store.url} rel="noopener">{label}</a>
			{:else}
				<!-- Only in `npm run dev`: a store that does not have the extension yet -->
				<button type="button" class="ui-btn ui-btn-planned" disabled>{label}</button>
			{/if}
		{/each}
	</div>
	<p class="small">
		{#if uk}
			Безплатно, без реклами й відстеження.{#if !data.browser}{' '}Розширення працює в браузерах на
				комп’ютері: Chrome, Firefox та Edge.{/if}
		{:else}
			Free, with no ads and no tracking.{#if !data.browser}{' '}The extension is for browsers on a
				computer: Chrome, Firefox and Edge.{/if}
		{/if}
	</p>

	<figure>
		<img
			src="/extension/card.png"
			width="800"
			height="500"
			loading="lazy"
			alt={uk
				? 'Картка над словом «склянки» в статті Вікіпедії: склянка, іменник жіночого роду, glass (drinking vessel), форми слова й списки, до яких його можна додати.'
				: 'The card over the word склянки in a Wikipedia article: склянка, feminine noun, glass (drinking vessel), the forms it can be and the lists it can go into.'}
		/>
		<figcaption>
			{#if uk}
				Картка в статті української Вікіпедії (текст статті: Вікіпедія, CC BY-SA 4.0).
			{:else}
				The card on a Ukrainian Wikipedia article (the article’s text: Wikipedia, CC BY-SA 4.0).
			{/if}
		</figcaption>
	</figure>

	{#if uk}
		<h2>Що показує картка</h2>
		<p>
			Словникову форму з наголосом, значення і те, яку форму ви бачите: «орудний відмінок, однина» для
			<span lang="uk">діаметром</span>. Пари, які є одним висловом, як-от
			<span lang="uk">будь ласка</span>, читаються разом.
		</p>

		<h2>Зберігайте, читаючи</h2>
		<p>
			Якщо ви ввійшли на цьому сайті, закладка на картці збереже слово до ваших списків: для
			<a href="/review">карток</a> чи експорту в Anki.
		</p>

		<h2>Налаштуйте під себе</h2>
		<p>
			Подвійне клацання або Ctrl і вказівник на слові. Світла, сепія чи темна тема; шрифт із засічками
			чи без; чотири розміри.
		</p>

		<h2>Що надсилається</h2>
		<p>
			Лише слово, про яке ви питаєте, і по одному слову з кожного боку від нього, і лише тоді, коли ви
			питаєте. Докладніше на сторінці <a href="/privacy">Приватність</a>.
		</p>
	{:else}
		<h2>What the card tells you</h2>
		<p>
			The dictionary word with its stress, what it means, and which form you are looking at:
			“instrumental, singular” for <span lang="uk">діаметром</span>. Pairs that are one expression,
			like <span lang="uk">будь ласка</span>, are read together.
		</p>

		<h2>Save as you read</h2>
		<p>
			Signed in here, a bookmark on the card saves the word to your lists, ready for
			<a href="/review">flashcards</a> or an Anki export.
		</p>

		<h2>Make it yours</h2>
		<p>
			Double-click, or hold Ctrl and point. Light, sepia or dark; serif or sans-serif; four sizes.
		</p>

		<h2>What it sends</h2>
		<p>
			Only the word you ask about and the word on each side of it, and only when you ask.
			<a href="/privacy">Privacy</a> has the details.
		</p>
	{/if}
</TextPage>

<style>
	.stores {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1.2rem 0 0.5rem;
	}

	/* A link drawn as a button keeps the button's look, not the page's link colour */
	.stores a {
		text-decoration: none;
	}

	.small,
	figcaption {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	figure {
		margin: 1.5rem 0;
	}

	img {
		display: block;
		width: 100%;
		height: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}

	figcaption {
		margin-top: 0.4rem;
	}
</style>
