<!-- What the site is and who makes it. What it keeps about a visitor is on a
     page of its own, /privacy. The profile picture here comes from GitHub,
     and that page says so: tell it if this one starts loading anything else
     from another site. -->
<script lang="ts">
	import GitHubCard from '#lib/GitHubCard.svelte';
	import Headword from '#lib/Headword.svelte';
	import TextPage from '#lib/TextPage.svelte';
	import { SOURCE_URL } from '#lib/index.ts';
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
	const AGPL = 'https://www.gnu.org/licenses/agpl-3.0.html';
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
			<li>
				Бачити синоніми, антоніми, споріднені слова й етимологію та шукати будь-яке слово з прикладу,
				натиснувши на нього.
			</li>
			<li>Набирати українською з екранної клавіатури, у стандартній або фонетичній розкладці.</li>
			<li>
				Зберігати слова, розкладати їх за списками й експортувати для Anki чи електронної таблиці.
			</li>
			<li>
				Повторювати слова на <a href="/review">картках</a>, збережені або найуживаніші: кожна картка
				повертається незадовго до того, як ви забули б слово.
			</li>
			<li>
				Вивчити абетку з вправами, переглянути 1000 найуживаніших слів і граматичні терміни: усе це
				на сторінці <a href="/learn">Навчання</a>.
			</li>
			<li>
				Увійти через Google або GitHub, щоб збережені слова й картки були на всіх ваших пристроях.
			</li>
			<li>Користуватися сайтом англійською чи українською, у світлій, сепієвій або темній темі.</li>
			<li>Слухати українське радіо під час навчання: його можна ввімкнути в налаштуваннях.</li>
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
				<a href="/saved">Збережені слова</a> або надіслати просто в Anki, якщо він відкритий і має
				додаток AnkiConnect.
			</li>
			<li>
				<b>Телефон.</b> Nebokrai можна встановити як застосунок: у меню браузера виберіть «Додати на
				головний екран». Словнику й далі потрібне з’єднання з інтернетом.
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
			Nebokrai створив я, Jesper Andersson, як некомерційний проєкт. Я вивчаю українську з 2022 року і
			створив цей сайт, бо вважав, що українська заслуговує на зручний сайт, де можна шукати слова й
			дивитися відмінювання!
		</p>
		<GitHubCard profile={data.github} />

		<h2>Вихідний код</h2>
		<p>
			Код сайту — вільне програмне забезпечення за ліцензією
			<a href={AGPL} rel="noopener">GNU Affero General Public License</a> версії 3 або пізнішої. Він
			опублікований <a href={SOURCE_URL} rel="noopener">на GitHub</a>: там можна його прочитати,
			повідомити про помилку чи запропонувати зміну.
		</p>

		<h2>Підтримати Nebokrai</h2>
		<p>
			Nebokrai повністю безкоштовний, без реклами й відстеження. Якщо він вам корисний, можете
			допомогти мені покрити витрати на хостинг <a href={KOFI} rel="noopener">на Ko-fi</a>. Внески
			цілком добровільні й не дають жодних переваг. Усе на сайті лишається безкоштовним для всіх. Якщо
			хочете натомість допомогти Україні, дивіться: <a href="/support">Підтримати Україну</a>.
		</p>

		<h2>Контакти</h2>
		<p>
			Пишіть на <a href="mailto:{EMAIL}">{EMAIL}</a>. Знайшли помилку в словнику?
			<a href="/report">Повідомте про неї</a>. Що сайт зберігає про вас, а що ні, сказано на
			сторінці <a href="/privacy">Приватність</a>.
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
			<li>
				See a word’s synonyms, antonyms, related words and etymology, and look up any word of an
				example sentence by pressing it.
			</li>
			<li>Type Ukrainian with the on-screen keyboard, in the standard or a phonetic layout.</li>
			<li>Save words, sort them into lists and export them for Anki or a spreadsheet.</li>
			<li>
				Practise with <a href="/review">flashcards</a> from your saved words or the most common
				ones: each card comes back shortly before you would forget it.
			</li>
			<li>
				Learn the alphabet with a drill, browse the 1,000 most common words and look up grammar
				words, all from the <a href="/learn">Learn</a> page.
			</li>
			<li>Sign in with Google or GitHub to have your saved words and flashcards on every device.</li>
			<li>Use the site in English or Ukrainian, in a light, sepia or dark theme.</li>
			<li>Listen to Ukrainian radio while you study: switch it on in the settings.</li>
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
				<a href="/saved">Saved words</a> page, or send them straight into Anki when it is open and
				has the AnkiConnect add-on.
			</li>
			<li>
				<b>Your phone.</b> Nebokrai can be installed as an app: choose Add to Home Screen in your
				browser’s menu. The dictionary still needs a connection.
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
			Nebokrai is made by me, Jesper Andersson, as a non-commercial project. I have been learning Ukrainian since 2022 and created this site because I felt Ukrainian deserves a user-friendly site to look up words and declension!
		</p>
		<GitHubCard profile={data.github} />

		<h2>Source code</h2>
		<p>
			The code of the site is free software under the
			<a href={AGPL} rel="noopener">GNU Affero General Public License</a>, version 3 or later. It is
			published <a href={SOURCE_URL} rel="noopener">on GitHub</a>, where you can read it, report a
			problem or suggest a change.
		</p>

		<h2>Supporting Nebokrai</h2>
		<p>
			Nebokrai is completely free and has no ads or tracking. If you find it useful, you can help me cover the hosting costs
			<a href={KOFI} rel="noopener">on Ko-fi</a>. Donations are entirely voluntary and unlock nothing.
			Everything on the site stays free for everyone. To give to Ukraine instead, see:
			<a href="/support">Support Ukraine</a>.
		</p>

		<h2>Contact</h2>
		<p>
			Email <a href="mailto:{EMAIL}">{EMAIL}</a>. Found a mistake in the dictionary?
			<a href="/report">Report an issue</a>. What the site keeps about you, and what it does not,
			is on the <a href="/privacy">Privacy</a> page.
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
