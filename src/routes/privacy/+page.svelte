<!-- What the site keeps about a visitor. It says what the code does: read it
     again whenever users.ts, oauth.ts, reports.ts, missing-words.ts, stats.ts or the report endpoint
     changes what is kept, or a page starts loading something from another
     site. It was a section of the About page until 2026-11-13. -->
<script lang="ts">
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const EMAIL = 'contact@nebokrai.app';
</script>

<TextPage title={m.pageTitle.privacy} description={m.meta.privacy}>
	{#if settings.lang === 'uk'}
		<p class="lead">
			На Nebokrai немає реклами й відстеження. Файли cookie потрібні лише для входу, для
			налаштувань і щоб пам’ятати, яке оновлення сайту ви бачили останнім.
		</p>

		<h2>Збережені слова й обліковий запис</h2>
		<p>
			Збережені слова та списки, у які ви їх розклали, зберігаються у вашому браузері. Якщо ви
			входите через Google або GitHub, ми зберігаємо ваш ідентифікатор у цьому сервісі, ваше ім’я,
			збережені слова, назви ваших списків, те, які слова ви експортували, і ваші повторення на
			картках, щоб усе це було на всіх ваших пристроях. Ми не просимо вашу електронну адресу й ніколи не бачимо вашого пароля.
			«Видалити обліковий запис» у налаштуваннях одразу видаляє все це.
		</p>

		<h2>Повідомлення про помилки</h2>
		<p>
			Повідомлення про помилку зберігається разом зі словом чи запитом, якого воно стосується,
			сторінкою, з якої ви прийшли, вашими налаштуваннями мови й розкладки та назвою й версією
			браузера, щоб ми могли знайти проблему. Електронну адресу ми зберігаємо, лише якщо ви її
			вкажете, і видаляємо, щойно повідомлення закрито.
		</p>

		<h2>Імпорт</h2>
		<p>
			Файл, який ви імпортуєте, читається у вашому браузері й нікуди не надсилається. Ми отримуємо лише
			слова, які зберігаємо, і поступ карток. Слова, яких немає в словнику, надсилаються окремо, без
			решти картки й без жодних відомостей про вас, щоб ми могли додати їх до словника. Слово, яке ви
			вилучили з імпорту, не надсилається.
		</p>

		<h2>Підрахунок відвідувань</h2>
		<p>
			Щоб знати, скільки людей користується сайтом, ми рахуємо показані сторінки й пошукові запити,
			без файлів cookie і без збереження вашої IP-адреси: протягом дня відвідувач — це зашифрований
			код, з якого не можна відновити адресу, і наприкінці дня його видаляємо. Запити до 40 символів
			зберігаються 90 днів, без зв’язку з тим, хто їх зробив. Браузер з увімкненим Do Not Track або
			Global Privacy Control ми не рахуємо.
		</p>
		<p>
			Коли ми вперше за день рахуємо відвідувача, до підсумків цього дня додаються ще три числа:
			країна, яку Cloudflare визначає для запиту, телефон це чи комп’ютер, і сайт, з якого ви
			прийшли, — лише його назва, наприклад google.com, без адреси сторінки. Це окремі лічильники:
			вони не пов’язані ні між собою, ні з вашими запитами чи сторінками.
		</p>

		<h2>Інші сайти</h2>
		<p>
			Дещо завантажується з інших сайтів, які бачать ваш запит так само, як будь-який сайт: записи
			вимови — з Вікісховища, коли ви натискаєте кнопку відтворення, фото профілю на сторінці
			<a href="/about">Про проєкт</a> — з GitHub, а перевірка на сторінці повідомлення про помилку,
			яка відрізняє людину від програми, — з Cloudflare (Turnstile).
		</p>
		<p>
			Сайт працює на Cloudflare, через який проходить кожен запит. Ми не зберігаємо вашу IP-адресу:
			вона потрібна лише на кілька хвилин, щоб обмежити кількість повідомлень поспіль, і для денного
			підрахунку відвідувань.
		</p>
		<p>
			Радіо, яке можна ввімкнути в налаштуваннях, грає просто із сервера станції: коли ви вмикаєте
			станцію, ваш браузер з’єднується з нею, і вона бачить вашу IP-адресу, як будь-який сайт, який
			ви відкриваєте. Доки ви не натиснули «Слухати», жодна станція нічого не отримує.
		</p>

		<h2>Запитання</h2>
		<p>Пишіть на <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
	{:else}
		<p class="lead">
			Nebokrai has no ads and no tracking. Cookies are used only for signing in, for your
			settings and to remember the last site update you saw.
		</p>

		<h2>Saved words and your account</h2>
		<p>
			Saved words, and the lists you sort them into, are kept in your browser. If you sign in with
			Google or GitHub, we store that service’s id for you, your name, your saved words, the names
			you give your lists, which words you have exported and your flashcard reviews, so that they
			follow you to every device. We do not ask for your email address and never see your password. “Delete account” in
			the settings removes all of it at once.
		</p>

		<h2>Reports</h2>
		<p>
			A report you send is stored with the word or search it is about, the page you came from, your
			language and keyboard settings and your browser’s name and version, so that we can find the
			problem. Your email address is stored only if you give it, and is deleted once the report is
			closed.
		</p>

		<h2>Importing</h2>
		<p>
			A file you import is read in your browser and is not sent anywhere. We receive only the words
			to save and the progress of their cards. Words the dictionary does not have are sent on their
			own, without the rest of the card and without anything about you, so that we can add them to
			the dictionary. A word you leave out of the import is not sent.
		</p>

		<h2>Counting visits</h2>
		<p>
			To know how many people use the site, we count the pages shown and the searches made, without
			a cookie and without storing your IP address: for one day a visitor is a scrambled code that
			cannot be turned back into an address, and it is deleted when the day ends. Searches of up to
			40 characters are kept for 90 days, with nothing that says who made them. A browser set to Do
			Not Track or Global Privacy Control is not counted.
		</p>
		<p>
			The first time a visitor is counted on a day, three more numbers go up in that day’s totals:
			the country Cloudflare names for the request, whether it came from a phone or a desktop, and
			the site that sent you here, by its name only (google.com, say), never the address of the
			page. They are separate tallies, tied neither to each other nor to your searches or pages.
		</p>

		<h2>Other sites</h2>
		<p>
			Three things are loaded from other sites, which see the request as any site would: recordings
			come from Wikimedia Commons when you press play, the profile picture on the
			<a href="/about">About</a> page comes from GitHub, and the check on the report page that
			tells a person from a program comes from Cloudflare (Turnstile).
		</p>
		<p>
			The site runs on Cloudflare, which every request passes through. We do not store your IP
			address: it is used only for a few minutes, to limit how many reports can be sent in a row, and
			for the day's visit count.
		</p>
		<p>
			The radio you can switch on in the settings plays straight from each station’s server: when
			you start a station, your browser connects to it, and it sees your IP address as any site you
			visit does. Until you press Play, no station hears from you.
		</p>

		<h2>Questions</h2>
		<p>Email <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
	{/if}
</TextPage>
