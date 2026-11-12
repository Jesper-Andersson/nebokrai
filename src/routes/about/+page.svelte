<!-- The Privacy section says what the code does. Read it again whenever
     users.ts, oauth.ts, reports.ts or the report endpoint changes what is
     kept, or a page starts loading something from another site. -->
<script lang="ts">
	import GitHubCard from '#lib/GitHubCard.svelte';
	import Headword from '#lib/Headword.svelte';
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const EMAIL = 'contact@nebokrai.app';
	// Voluntary help with the hosting bill. It must never buy anything on the
	// site: the VESUM data keeps Nebokrai non-commercial.
	const KOFI = 'https://ko-fi.com/jesperandersson0';
</script>

<TextPage title={m.pageTitle.about} description={m.meta.about}>
	{#if settings.lang === 'uk'}
		<p class="lead">
			Nebokrai — безкоштовний українсько-англійський словник для тих, хто вивчає українську. Він
			знаходить слово, хоч як ви його наберете, і показує наголос, форми та вимову.
		</p>

		<h2>Назва</h2>
		<p>
			<Headword text="Небокра́й" size="sm" tag="b" /> означає «горизонт», дослівно — «край неба».
		</p>

		<h2>Що тут можна робити</h2>
		<ul>
			<li>Шукати українською, латинкою (<i>pryvit</i>) або англійською (<i>hello</i>).</li>
			<li>Знаходити слово за будь-якою його формою: <i lang="uk">книги</i> веде до <i lang="uk">книга</i>.</li>
			<li>
				Знаходити слово, навіть якщо його написано з помилкою, на слух (<i>kniga</i>) чи не в тій
				розкладці (<i>ghbdsn</i> замість <i lang="uk">привіт</i>).
			</li>
			<li>Бачити наголос, відмінювання й дієвідмінювання та приклади речень.</li>
			<li>Слухати вимову: запис, якщо він є, або комп’ютерний голос.</li>
			<li>Дізнатися, наскільки вживане слово.</li>
			<li>Зберігати слова й експортувати їх для Anki чи електронної таблиці.</li>
		</ul>

		<h2>Звідки слова</h2>
		<p>
			У словнику близько 30 000 слів. Його зібрано з відкритих даних, створених волонтерами:
			значення, наголоси й таблиці — з англомовного Вікісловника, записи вимови — з Вікісховища,
			приклади речень — з Tatoeba, а частотність — із субтитрів до фільмів і серіалів. ВЕСУМ, Великий
			електронний словник української мови, допомагає розпізнавати форми слів, яких бракує у
			Вікісловнику. Докладніше на сторінці <a href="/sources">Джерела й ліцензії</a>.
		</p>

		<h2>Хто це робить</h2>
		<p>
			Nebokrai — некомерційний проєкт Jesper Andersson.
		</p>
		<GitHubCard profile={data.github} />

		<h2>Підтримати Nebokrai</h2>
		<p>
			Nebokrai безкоштовний і без реклами. Якщо він вам корисний, можете допомогти покрити витрати на
			хостинг <a href={KOFI} rel="noopener">на Ko-fi</a>. Внески добровільні й не дають жодних
			переваг: усе на сайті лишається безкоштовним для всіх. Якщо хочете натомість допомогти Україні,
			дивіться сторінку <a href="/support">Підтримати Україну</a>.
		</p>

		<h2>Приватність</h2>
		<p>
			На Nebokrai немає реклами й відстеження. Файли cookie потрібні лише для входу й налаштувань.
		</p>
		<p>
			Збережені слова зберігаються у вашому браузері. Якщо ви входите через Google або GitHub, ми
			зберігаємо ваш ідентифікатор у цьому сервісі, ваше ім’я, збережені слова й те, які з них ви
			експортували, щоб вони були на всіх ваших пристроях. Ми не просимо вашу електронну адресу й
			ніколи не бачимо вашого пароля. «Видалити обліковий запис» у налаштуваннях одразу видаляє все
			це.
		</p>
		<p>
			Повідомлення про помилку зберігається разом зі словом чи запитом, якого воно стосується,
			сторінкою, з якої ви прийшли, вашими налаштуваннями мови й розкладки та назвою й версією
			браузера, щоб ми могли знайти проблему. Електронну адресу ми зберігаємо, лише якщо ви її
			вкажете, і видаляємо, щойно повідомлення закрито.
		</p>
		<p>
			Дещо завантажується з інших сайтів, які бачать ваш запит так само, як будь-який сайт: записи
			вимови — з Вікісховища, коли ви натискаєте кнопку відтворення, а фото профілю на цій сторінці —
			з GitHub.
		</p>
		<p>
			Сайт працює на Cloudflare, через який проходить кожен запит. Ми не зберігаємо вашу IP-адресу:
			вона потрібна лише на кілька хвилин, щоб обмежити кількість повідомлень поспіль.
		</p>

		<h2>Контакти</h2>
		<p>
			Пишіть на <a href="mailto:{EMAIL}">{EMAIL}</a>. Знайшли помилку в словнику?
			<a href="/report">Повідомте про неї</a>.
		</p>
	{:else}
		<p class="lead">
			Nebokrai is a free Ukrainian–English dictionary for people learning Ukrainian. It finds a word
			however you type it, and shows its stress, its forms and how it sounds.
		</p>

		<h2>The name</h2>
		<p>
			<Headword text="Небокра́й" size="sm" tag="b" /> means “horizon”, literally “the sky’s edge”.
		</p>

		<h2>What you can do here</h2>
		<ul>
			<li>Search in Ukrainian, in Latin letters (<i>pryvit</i>) or in English (<i>hello</i>).</li>
			<li>Find a word from any of its forms: <i lang="uk">книги</i> leads to <i lang="uk">книга</i>.</li>
			<li>
				Still find it when it is misspelt, typed by ear (<i>kniga</i>) or typed on the wrong keyboard
				layout (<i>ghbdsn</i> for <i lang="uk">привіт</i>).
			</li>
			<li>See where the stress falls, full declension and conjugation tables, and example sentences.</li>
			<li>Hear the word: a recording where there is one, a computer voice where there is not.</li>
			<li>See how common a word is.</li>
			<li>Save words and export them for Anki or a spreadsheet.</li>
		</ul>

		<h2>Where the words come from</h2>
		<p>
			The dictionary has about 30,000 words and is built from open data made by volunteers. Meanings,
			stress and tables come from the English Wiktionary, recordings from Wikimedia Commons, example
			sentences from Tatoeba, and frequency ranks from film and television subtitles. VESUM, the
			Large Electronic Dictionary of Ukrainian, recognises word forms that Wiktionary lacks. See
			<a href="/sources">Sources and licences</a> for the credits.
		</p>

		<h2>Who makes it</h2>
		<p>
			Nebokrai is a non-commercial project by Jesper Andersson.
		</p>
		<GitHubCard profile={data.github} />

		<h2>Supporting Nebokrai</h2>
		<p>
			Nebokrai is free and has no ads. If you find it useful, you can help cover the hosting costs
			<a href={KOFI} rel="noopener">on Ko-fi</a>. Donations are voluntary and unlock nothing:
			everything on the site stays free for everyone. To give to Ukraine instead, see
			<a href="/support">Support Ukraine</a>.
		</p>

		<h2>Privacy</h2>
		<p>
			Nebokrai has no ads and no tracking. Cookies are used only for signing in and for your
			settings.
		</p>
		<p>
			Saved words are kept in your browser. If you sign in with Google or GitHub, we store that
			service’s id for you, your name, your saved words and which of them you have exported, so that
			they follow you to every device. We do not ask for your email address and never see your
			password. “Delete account” in the settings removes all of it at once.
		</p>
		<p>
			A report you send is stored with the word or search it is about, the page you came from, your
			language and keyboard settings and your browser’s name and version, so that we can find the
			problem. Your email address is stored only if you give it, and is deleted once the report is
			closed.
		</p>
		<p>
			Two things are loaded from other sites, which see the request as any site would: recordings
			come from Wikimedia Commons when you press play, and the profile picture on this page comes
			from GitHub.
		</p>
		<p>
			The site runs on Cloudflare, which every request passes through. We do not store your IP
			address: it is used only for a few minutes, to limit how many reports can be sent in a row.
		</p>

		<h2>Contact</h2>
		<p>
			Email <a href="mailto:{EMAIL}">{EMAIL}</a>. Found a mistake in the dictionary?
			<a href="/report">Report an issue</a>.
		</p>
	{/if}
</TextPage>

<style>
	ul {
		margin: 0.5rem 0;
		padding-left: 1.3rem;
	}

	li + li {
		margin-top: 0.25rem;
	}
</style>
