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
	// A search's address, less the word: what a browser or a reading tool is
	// given to look words up here (static/opensearch.xml names the same one).
	const SEARCH = 'https://nebokrai.app/?q=';
	// Voluntary help with the hosting bill. It must never buy anything on the
	// site: the VESUM data keeps Nebokrai non-commercial.
	const KOFI = 'https://ko-fi.com/jesperandersson0';
</script>

<TextPage title={m.pageTitle.about} description={m.meta.about}>
	{#if settings.lang === 'uk'}
		<p class="lead">
			Nebokrai — безкоштовний українсько-англійський словник для тих, хто вивчає українську.
		</p>

		<h2>Назва</h2>
		<p>
			<Headword text="Небокра́й" size="sm" tag="b" /> означає «горизонт», дослівно — «край неба».
		</p>

		<h2>Що тут можна робити?</h2>
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

		<h2>Nebokrai в інших програмах</h2>
		<ul>
			<li>
				<b>Адресний рядок браузера.</b> Після відвідин сайту браузер може шукати в Nebokrai просто з
				адресного рядка. У Firefox клацніть правою кнопкою на адресному рядку й виберіть «Додати
				"Nebokrai"». У Chrome та Edge увімкніть Nebokrai в налаштуваннях пошукових систем, серед
				пошуку на сайтах.
			</li>
			<li>
				<b>Посилання на пошук.</b> Кожен пошук має адресу, якою можна поділитися або яку можна
				зберегти в закладках: <code>{SEARCH}kava</code>.
			</li>
			<li>
				<b>Інструменти для читання.</b> Якщо інструмент дозволяє додати власний словник, вкажіть ту
				саму адресу з його позначкою на місці слова: у Readlang це
				<code>{SEARCH}{'{{query}}'}</code>, у Language Reactor — <code>{SEARCH}WORD</code>. Nebokrai
				не відкривається всередині інших сайтів, тож у Readlang скористайтеся кнопкою «Open in new
				window».
			</li>
			<li>
				<b>Anki.</b> Збережені слова можна експортувати як файл для Anki на сторінці
				<a href="/saved">Збережені слова</a>.
			</li>
		</ul>

		<h2>Звідки слова</h2>
		<p>
			У словнику близько 30 000 слів. Його зібрано з відкритих даних, створених волонтерами:
			значення, наголоси й таблиці — з англомовного Вікісловника, записи вимови — з Вікісховища,
			приклади речень — з Tatoeba, а частотність — із субтитрів до фільмів і серіалів. ВЕСУМ, Великий
			електронний словник української мови, допомагає розпізнавати форми слів, яких бракує у
			Вікісловнику. Докладніше на сторінці <a href="/sources">Джерела й ліцензії</a>.
		</p>

		<h2>Про мене</h2>
		<p>
			Nebokrai створив я Jesper Andersson як некомерційний проєкт. Я вивчаю українську з 2022 року і
			створив цей сайт, бо вважав, що українська заслуговує на зручний сайт, де можна шукати слова й
			дивитися відмінювання!
		</p>
		<GitHubCard profile={data.github} />

		<h2>Підтримати Nebokrai</h2>
		<p>
			Nebokrai повністю безкоштовний, без реклами й відстеження. Якщо він вам корисний, можете
			допомогти мені покрити витрати на хостинг <a href={KOFI} rel="noopener">на Ko-fi</a>. Внески
			цілком добровільні й не дають жодних переваг. Усе на сайті лишається безкоштовним для всіх. Якщо
			хочете натомість допомогти Україні, дивіться: <a href="/support">Підтримати Україну</a>.
		</p>

		<h2>Приватність</h2>
		<p>
			На Nebokrai немає реклами й відстеження. Файли cookie потрібні лише для входу й налаштувань.
		</p>
		<p>
			Збережені слова та списки, у які ви їх розклали, зберігаються у вашому браузері. Якщо ви
			входите через Google або GitHub, ми зберігаємо ваш ідентифікатор у цьому сервісі, ваше ім’я,
			збережені слова, назви ваших списків і те, які слова ви експортували, щоб усе це було на всіх
			ваших пристроях. Ми не просимо вашу електронну адресу й
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
		<p>
			Радіо, яке можна ввімкнути в налаштуваннях, грає просто із сервера станції: коли ви вмикаєте
			станцію, ваш браузер з’єднується з нею, і вона бачить вашу IP-адресу, як будь-який сайт, який
			ви відкриваєте. Доки ви не натиснули «Слухати», жодна станція нічого не отримує.
		</p>

		<h2>Контакти</h2>
		<p>
			Пишіть на <a href="mailto:{EMAIL}">{EMAIL}</a>. Знайшли помилку в словнику?
			<a href="/report">Повідомте про неї</a>.
		</p>
	{:else}
		<p class="lead">
			Nebokrai is a free Ukrainian–English dictionary for people learning Ukrainian.
		</p>

		<h2>The name</h2>
		<p>
			<Headword text="Небокра́й" size="sm" tag="b" /> means “horizon”, literally “the sky’s edge”.
		</p>

		<h2>What can you do here?</h2>
		<ul>
			<li>Search in Ukrainian, in Latin letters (<i>pryvit</i>) or in English (<i>hello</i>).</li>
			<li>Find a word from any of its forms: <i lang="uk">книги</i> leads to <i lang="uk">книга</i>.</li>
			<li>
				Still find it when it is misspelt, typed by ear (<i>kniga</i>) or typed on the wrong keyboard
				layout (<i>ghbdsn</i> for <i lang="uk">привіт</i>).
			</li>
			<li>See where the stress falls, full declension and conjugation tables and example sentences.</li>
			<li>Hear the word: a recording where there is one, a computer voice where there is not.</li>
			<li>See how common a word is.</li>
			<li>Save words and export them for Anki or a spreadsheet.</li>
		</ul>

		<h2>Using Nebokrai from elsewhere</h2>
		<ul>
			<li>
				<b>Your browser’s address bar.</b> Once you have visited the site, your browser can search
				Nebokrai straight from its address bar. In Firefox, right-click the address bar and choose
				Add “Nebokrai”. In Chrome and Edge, turn Nebokrai on in the search engine settings, under
				site search.
			</li>
			<li>
				<b>A link to a search.</b> Every search has an address you can share or bookmark:
				<code>{SEARCH}kava</code>.
			</li>
			<li>
				<b>Reading tools.</b> If a tool lets you add a dictionary of your own, give it the same
				address with its placeholder where the word goes: in Readlang that is
				<code>{SEARCH}{'{{query}}'}</code>, in Language Reactor <code>{SEARCH}WORD</code>. Nebokrai
				does not open inside other sites, so in Readlang use “Open in new window”.
			</li>
			<li>
				<b>Anki.</b> Export your saved words as an Anki file from the
				<a href="/saved">Saved words</a> page.
			</li>
		</ul>

		<h2>Where the words come from</h2>
		<p>
			The dictionary has about 30,000 words and is built from open data made by volunteers. Meanings,
			stress and tables come from the English Wiktionary, recordings from Wikimedia Commons, example
			sentences from Tatoeba, and frequency ranks from film and television subtitles. VESUM, the
			Large Electronic Dictionary of Ukrainian, recognises word forms that Wiktionary lacks. See
			<a href="/sources">Sources and licences</a> for the credits.
		</p>

		<h2>About me</h2>
		<p>
			Nebokrai is made by me Jesper Andersson as a non-commerical project. I have been learning Ukrainian since 2022 and created this site because I felt Ukrainian deserves a user-friendly site to look up words and declenasion!
		</p>
		<GitHubCard profile={data.github} />

		<h2>Supporting Nebokrai</h2>
		<p>
			Nebokrai is completely free and has no ads or tracking. If you find it useful, you can help me cover the hosting costs
			<a href={KOFI} rel="noopener">on Ko-fi</a>. Donations are entirely voluntary and unlock nothing.
			Everything on the site stays free for everyone. To give to Ukraine instead, see:
			<a href="/support">Support Ukraine</a>.
		</p>

		<h2>Privacy</h2>
		<p>
			Nebokrai has no ads and no tracking. Cookies are used only for signing in and for your
			settings.
		</p>
		<p>
			Saved words, and the lists you sort them into, are kept in your browser. If you sign in with
			Google or GitHub, we store that service’s id for you, your name, your saved words, the names
			you give your lists and which words you have exported, so that they follow you to every device. We do not ask for your email address and never see your
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
		<p>
			The radio you can switch on in the settings plays straight from each station’s server: when
			you start a station, your browser connects to it, and it sees your IP address as any site you
			visit does. Until you press Play, no station hears from you.
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

	/* An address to copy: kept whole where it fits, broken anywhere on a phone
	   rather than pushing the page wider than the screen */
	code {
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.9em;
		overflow-wrap: anywhere;
	}
</style>
