<!-- What the site keeps about a visitor. It says what the code does: read it
     again whenever users.ts, oauth.ts, reports.ts or the report endpoint
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
			На Nebokrai немає реклами й відстеження. Файли cookie потрібні лише для входу й налаштувань.
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

		<h2>Інші сайти</h2>
		<p>
			Дещо завантажується з інших сайтів, які бачать ваш запит так само, як будь-який сайт: записи
			вимови — з Вікісховища, коли ви натискаєте кнопку відтворення, фото профілю на сторінці
			<a href="/about">Про проєкт</a> — з GitHub, а перевірка на сторінці повідомлення про помилку,
			яка відрізняє людину від програми, — з Cloudflare (Turnstile).
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

		<h2>Запитання</h2>
		<p>Пишіть на <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
	{:else}
		<p class="lead">
			Nebokrai has no ads and no tracking. Cookies are used only for signing in and for your
			settings.
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

		<h2>Other sites</h2>
		<p>
			Three things are loaded from other sites, which see the request as any site would: recordings
			come from Wikimedia Commons when you press play, the profile picture on the
			<a href="/about">About</a> page comes from GitHub, and the check on the report page that
			tells a person from a program comes from Cloudflare (Turnstile).
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

		<h2>Questions</h2>
		<p>Email <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
	{/if}
</TextPage>
