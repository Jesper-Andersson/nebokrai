<!-- Draft text. -->
<script lang="ts">
	import GitHubCard from '#lib/GitHubCard.svelte';
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const EMAIL = 'contact@nebokrai.app';

	// Ukrainian plural forms: 1 репозиторій, 2–4 репозиторії, 5+ репозиторіїв
	function reposUk(n: number) {
		const last = n % 10, lastTwo = n % 100;
		if (last === 1 && lastTwo !== 11) return `${n} репозиторій`;
		if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} репозиторії`;
		return `${n} репозиторіїв`;
	}
	const reposEn = (n: number) => `${n} public ${n === 1 ? 'repository' : 'repositories'}`;
</script>

<TextPage title={m.pageTitle.about}>
	{#if settings.lang === 'uk'}
		<p class="lead">
			Nebokrai — безкоштовний українсько-англійський словник для тих, хто вивчає українську.
		</p>

		<h2>Назва</h2>
		<p>
			<b lang="uk">Небокрай</b> означає «горизонт», дослівно — «край неба».
		</p>

		<h2>Що тут можна робити</h2>
		<ul>
			<li>Шукати українською, латинкою (<i>pryvit</i>) або англійською (<i>hello</i>).</li>
			<li>Знаходити слово за будь-якою його формою: <i lang="uk">книги</i> веде до <i lang="uk">книга</i>.</li>
			<li>Бачити наголос, відмінювання й дієвідмінювання та приклади речень.</li>
			<li>Дізнатися, наскільки вживане слово.</li>
		</ul>

		<h2>Звідки слова</h2>
		<p>
			Словник зібрано з відкритих даних, створених волонтерами: Вікісловника, Tatoeba та інших.
			Докладніше на сторінці <a href="/sources">Джерела й ліцензії</a>.
		</p>

		<h2>Хто це робить</h2>
		<p>
			Nebokrai — некомерційний проєкт Jesper Andersson.
		</p>
		<GitHubCard profile={data.github} reposLabel={reposUk} />

		<h2>Приватність</h2>
		<p>
			Збережені слова зберігаються у вашому браузері. Якщо ви входите через Google або GitHub, ми
			зберігаємо ваш ідентифікатор у цьому сервісі, ваше ім’я та збережені слова, щоб вони були на
			всіх ваших пристроях. Ми не отримуємо вашу електронну адресу чи пароль. Файли cookie потрібні
			лише для входу й налаштувань; реклами та відстеження немає. «Видалити обліковий запис» у
			налаштуваннях одразу видаляє все це.
		</p>

		<h2>Контакти</h2>
		<p>
			Пишіть на <a href="mailto:{EMAIL}">{EMAIL}</a>. Знайшли помилку в словнику?
			<a href="/report">Повідомте про неї</a>.
		</p>
	{:else}
		<p class="lead">Nebokrai is a free Ukrainian–English dictionary for people learning Ukrainian.</p>

		<h2>The name</h2>
		<p>
			<b lang="uk">Небокрай</b> means “horizon”, literally “the sky’s edge”.
		</p>

		<h2>What you can do here</h2>
		<ul>
			<li>Search in Ukrainian, in Latin letters (<i>pryvit</i>) or in English (<i>hello</i>).</li>
			<li>Find a word from any of its forms: <i lang="uk">книги</i> leads to <i lang="uk">книга</i>.</li>
			<li>See where the stress falls, full declension and conjugation tables, and example sentences.</li>
			<li>See how common a word is.</li>
		</ul>

		<h2>Where the words come from</h2>
		<p>
			The dictionary is built from open data made by volunteers: Wiktionary, Tatoeba and others. See
			<a href="/sources">Sources and licences</a>.
		</p>

		<h2>Who makes it</h2>
		<p>
			Nebokrai is a non-commercial project by Jesper Andersson.
		</p>
		<GitHubCard profile={data.github} reposLabel={reposEn} />

		<h2>Privacy</h2>
		<p>
			Saved words are kept in your browser. If you sign in with Google or GitHub, we store that
			service’s id for you, your name and your saved words, so that they follow you to every device.
			We never receive your email address or password. Cookies are used only for signing in and for
			your settings; there are no ads and no tracking. “Delete account” in the settings removes all
			of it at once.
		</p>

		<h2>Contact</h2>
		<p>
			Email <a href="mailto:{EMAIL}">{EMAIL}</a>. Found a mistake in the dictionary?
			<a href="/report">Report an issue</a>.
		</p>
	{/if}
</TextPage>

<style>
	.lead {
		font-size: 1.15rem;
	}

	ul {
		margin: 0.5rem 0;
		padding-left: 1.3rem;
	}

	li + li {
		margin-top: 0.25rem;
	}
</style>
