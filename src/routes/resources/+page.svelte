<!-- Draft: a starting list to review and extend. Keep Russian-made resources out. -->
<script lang="ts">
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	type Resource = { name: string; url: string; en: string; uk: string };
	type Group = { en: string; uk: string; items: Resource[] };

	const groups: Group[] = [
		{
			en: 'Courses and lessons',
			uk: 'Курси й уроки',
			items: [
				{
					name: 'Ukrainian Lessons',
					url: 'https://www.ukrainianlessons.com/',
					en: 'Podcast, lessons and grammar notes for learners at every level.',
					uk: 'Подкаст, уроки й пояснення граматики для будь-якого рівня.'
				}
			]
		},
		{
			en: 'Dictionaries',
			uk: 'Словники',
			items: [
				{
					name: 'Горох',
					url: 'https://goroh.pp.ua/',
					en: 'Ukrainian-language dictionaries: meanings, synonyms, stress and inflection.',
					uk: 'Тлумачення, синоніми, наголоси й словозміна українською.'
				},
				{
					name: 'Wiktionary',
					url: 'https://en.wiktionary.org/wiki/Category:Ukrainian_language',
					en: 'The source of Nebokrai’s entries, with etymology and usage notes.',
					uk: 'Джерело статей Nebokrai, з етимологією та поясненнями вживання.'
				}
			]
		},
		{
			en: 'Practice',
			uk: 'Практика',
			items: [
				{
					name: 'Tatoeba',
					url: 'https://tatoeba.org/',
					en: 'Example sentences with translations, many with audio.',
					uk: 'Речення з перекладами, багато з аудіо.'
				},
				{
					name: 'Forvo',
					url: 'https://forvo.com/languages/uk/',
					en: 'Pronunciations recorded by native speakers.',
					uk: 'Вимова, записана носіями мови.'
				}
			]
		}
	];
</script>

<TextPage title={m.pageTitle.resources} description={m.meta.resources}>
	<p class="muted">
		{settings.lang === 'uk'
			? 'Добірка інших місць, де можна вчити українську. Список ще доповнюється.'
			: 'Other good places to learn Ukrainian. This list is still growing.'}
	</p>

	{#each groups as group (group.en)}
		<h2>{settings.lang === 'uk' ? group.uk : group.en}</h2>
		<ul class="resources">
			{#each group.items as item (item.url)}
				<li>
					<a href={item.url} rel="noopener">{item.name}</a>
					<span>{settings.lang === 'uk' ? item.uk : item.en}</span>
				</li>
			{/each}
		</ul>
	{/each}
</TextPage>

<style>
	.resources {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.resources li {
		display: grid;
		gap: 0.1rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.resources a {
		font-weight: 700;
	}

	.resources span {
		color: var(--muted);
	}
</style>
