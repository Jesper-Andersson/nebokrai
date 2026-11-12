<!-- Draft: a starting list to review. The funds are in src/lib/charities.ts. -->
<script lang="ts">
	import { AREAS, CHECKED } from '#lib/charities.ts';
	import Headword from '#lib/Headword.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import TextPage from '#lib/TextPage.svelte';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let uk = $derived(settings.lang === 'uk');
</script>

<TextPage title={m.support.label} description={m.meta.support}>
	{#if uk}
		<p class="lead">
			Від лютого 2022 року Україна боронить себе від повномасштабного вторгнення Росії. Тут зібрано
			організації, яким можна задонатити безпосередньо, згруповані за тим, що вони роблять.
		</p>
		<p class="muted">Кожен заголовок веде до статті про це слово в словнику.</p>
	{:else}
		<p class="lead">
			Ukraine has been defending itself against Russia’s full-scale invasion since February 2022.
			These are organisations you can give to directly, grouped by what they do.
		</p>
		<p class="muted">Each heading is a Ukrainian word and opens its entry in the dictionary.</p>
	{/if}

	{#each AREAS as area (area.word)}
		<h2>
			<Headword text={area.heading} href={wordPath(area.word)} />
			<!-- A Ukrainian reader needs no gloss -->
			{#if !uk}<span class="gloss">{area.en}</span>{/if}
		</h2>
		<ul class="funds">
			{#each area.items as item (item.url)}
				{@const name = (uk && item.nameUk) || item.name}
				<li>
					<!-- The name stands right beside it, so the logo says nothing more to a screen reader -->
					{#if item.logo}
						<img
							class="logo"
							class:dark={item.logoOnDark}
							src="/funds/{item.logo}"
							alt=""
							width="44"
							height="44"
							loading="lazy"
						/>
					{:else}
						<span class="logo initial" aria-hidden="true">{name[0]}</span>
					{/if}
					<a href={(uk && item.urlUk) || item.url} rel="noopener">{name}</a>
					<span class="about">{uk ? item.uk : item.en}</span>
				</li>
			{/each}
		</ul>
	{/each}

	{#if uk}
		<h2>Про цей список</h2>
		<p>
			Кожне посилання веде на власний сайт організації. Nebokrai не бере участі в пожертвах і нічого
			з них не отримує. Назви й логотипи належать самим організаціям.
		</p>
		<p>
			Список складено вручну, і він не вичерпний. Посилання востаннє перевірено {CHECKED.uk}. Шахраї
			часом копіюють сайти фондів, тож перед оплатою перевірте адресу.
		</p>
		<p>
			Якщо посилання не працює або тут бракує організації,
			<a href="/report?kind=site">напишіть нам</a>.
		</p>
	{:else}
		<h2>About this list</h2>
		<p>
			Every link goes to the organisation’s own site. Nebokrai takes no part in the donations and
			receives nothing from them. The names and logos belong to the organisations themselves.
		</p>
		<p>
			The list is chosen by hand and is not complete. The links were last checked on {CHECKED.en}.
			Fraudsters sometimes copy a fund’s site, so check the address before you pay.
		</p>
		<p>
			If a link is broken or an organisation is missing,
			<a href="/report?kind=site">tell us</a>.
		</p>
	{/if}
</TextPage>

<style>
	h2 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.6rem;
	}

	/* The heading is a headword, set as one is everywhere else (Headword).
	   TextPage colours and underlines every link in the sheet; these two rules
	   give the headword back its own look, gold under it only on hover.
	   `[lang]` is there to outweigh TextPage's rules. */
	h2 :global(a.headword[lang]) {
		color: var(--ink);
		text-decoration: none;
	}

	h2 :global(a.headword[lang]:hover) {
		text-decoration: underline 2px var(--gold);
		text-underline-offset: 4px;
	}

	/* The same cards as the Resources page */
	.funds {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* The logo in a column of its own, the name and the line about the fund
	   beside it */
	.funds li {
		display: grid;
		/* minmax(0, …): a long name wraps instead of widening the card */
		grid-template-columns: 2.75rem minmax(0, 1fr);
		gap: 0.1rem 0.8rem;
		align-items: start;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	/* The logos are drawn for a white page, United24's in plain black, so
	   the tile under one is white in the dark theme too: a colour token here
	   would hide half of them in one theme or the other. */
	.logo {
		grid-row: 1 / span 2;
		box-sizing: border-box;
		width: 2.75rem;
		height: 2.75rem;
		margin-top: 0.15rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: #fff;
		object-fit: contain;
	}

	.logo.dark {
		background: #16181d;
	}

	/* A fund whose logo we do not have: its first letter */
	.initial {
		display: grid;
		place-items: center;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 1.2rem;
		font-weight: 700;
	}

	.funds a {
		font-weight: 700;
	}

	.about {
		color: var(--muted);
	}

	.gloss {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: 1rem;
		font-weight: 400;
	}
</style>
