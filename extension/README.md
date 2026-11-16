# Nebokrai browser extension

A pop-up dictionary for Ukrainian. A double-click on a Ukrainian word on any page, or the pointer on one while
Ctrl is held, opens a small card: the word with its stress, what it means, and which form the page has
(діаметром: instrumental, singular). It is the card [nebokrai.app](https://nebokrai.app) shows over a word of
an example sentence, and it asks the same `GET /api/gloss` ([`docs/api.md`](../docs/api.md)).

Signed in on nebokrai.app, a bookmark on the card saves the word to your account and your lists stand under it.

## Build

The extension is built with [WXT](https://wxt.dev) and Svelte 5, and imports a few plain TypeScript files from
the site (`../src/lib/sentence.ts`, `../src/lib/search/normalize.ts`, `../src/lib/search/slug.ts`), so it is
built from a checkout of the whole repository, not from this folder alone.

```bash
cd extension
npm ci
npm run build
```

- Needs Node 22.18 or later. Built and tested with Node 26 and npm 9.8 on Windows 11; the
  commands are the same on Linux and macOS.
- `npm run build` writes `.output/chrome-mv3/` (Manifest V3, for Chrome and Edge) and `.output/firefox-mv2/`.
- `npm run zip` writes the two packages to upload, as `.zip` files in `.output/`.
- The code is bundled and minified by Vite, never obfuscated, and loads no code from anywhere at run time.
- The icons in `public/icon/` are drawn from the site's logo by `npm run app-icons` in the repository root.

For Firefox's reviewers: the source to build from is this repository at the released tag. The exact versions
of every dependency are in `extension/package-lock.json`. The `-sources.zip` that `npm run zip` also writes holds this
folder only, without the three site files, so it does not build by itself: do not upload that one.

## Develop

```bash
npm run dev            # Chrome, with reload on change
npm run dev:firefox
npm run check          # types
npm test               # the word-finding tests
```

To ask a local dev server instead of nebokrai.app, put `WXT_API_BASE=http://localhost:5173` in
`extension/.env.local`. Saving then needs a session on that server.

## What it asks for, and why

| In the manifest | Why |
|---|---|
| Content script on `http://*/*` and `https://*/*` | A Ukrainian word can be on any page. The script only listens for a double-click and for the pointer while the chosen key is held; it reads the one text under the pointer and draws the card. |
| Host permission `https://nebokrai.app/*` | The one site it talks to: the dictionary answer, and saving a word with the reader's session there. |
| `storage` | The reader's choices on the options page. |
| Firefox: `data_collection_permissions: websiteContent` | The word asked about and the word on each side of it are text of the page, and are sent to nebokrai.app. |

Nothing is sent until the reader asks about a word. The page, its address and the rest of its text never leave
it. [nebokrai.app/privacy](https://nebokrai.app/privacy) says the same for readers.

## Publishing

Each store step is the owner's to take. Before the first submission:

- [x] Run the Firefox build in Firefox 140 or later: done in Firefox 160 on 2026-11-15 (double-click, hover, saving, options).
- [x] Run the Chrome build in Chrome itself: done in Chrome 157 on 2026-11-15 (double-click, hover, saving, themes, sizes).
- [x] Screenshots at 1280 by 800 are in `store/screenshots/`: the card, a saved word, sepia, dark, the options page.
- [ ] Chrome Web Store: developer account with 2-step verification, non-trader declaration; on the privacy tab
      the single purpose below, the reasons from the table above, "website content" and "authentication
      information" as the data handled, and the privacy page's address.
- [ ] Firefox Add-ons: upload `.output/*-firefox.zip` and the repository source; decide whether Firefox for
      Android is wanted (it needs `gecko_android` in `wxt.config.ts` and a test there).
- [ ] Edge Add-ons: the Chrome package as it is.
- [ ] Once a store has it: put the address of its listing in src/lib/extension.ts. That switches on the /extension
      page, its links on About and in the footer, and the hint in the card on the site.

The extension is free and carries no advertising, as the site is: VESUM's licence asks for that
([`docs/sources-and-licences.md`](../docs/sources-and-licences.md)).

### Listing text

Single purpose: show the dictionary entry for a Ukrainian word the reader points at on a web page.

**English**

> **Nebokrai: Ukrainian pop-up dictionary**
>
> Double-click a Ukrainian word on any page to see what it is and what it means.
>
> Reading Ukrainian news, Wikipedia or a friend's message? Double-click a word, or hold Ctrl and point at it,
> and a small card tells you the dictionary word with its stress, what it means in English, and which form you
> are looking at: "instrumental, singular" for діаметром. Pairs that are one expression, like будь ласка, are
> read together.
>
> Sign in on nebokrai.app and a bookmark on the card saves the word to your lists, ready for flashcards or an
> Anki export.
>
> You choose the key, the theme (light, sepia or dark) and a serif or sans-serif face. Free, with no ads and no
> tracking: a word is sent to nebokrai.app only when you ask about it. The dictionary is built from Wiktionary
> and VESUM.

**Українською**

> **Nebokrai: спливний словник української**
>
> Двічі клацніть українське слово на будь-якій сторінці, щоб побачити, що це за слово і що воно означає.
>
> Читаєте українські новини, Вікіпедію чи повідомлення від друга? Двічі клацніть слово або наведіть на нього
> вказівник, тримаючи Ctrl, і невелика картка покаже словникову форму з наголосом, переклад англійською та
> форму, яку ви бачите: «орудний відмінок, однина» для «діаметром». Пари, які є одним висловом, як-от «будь
> ласка», читаються разом.
>
> Увійдіть на nebokrai.app, і закладка на картці збереже слово до ваших списків: для карток чи експорту в Anki.
>
> Ви обираєте клавішу, тему (світлу, сепію чи темну) і шрифт із засічками чи без. Безплатно, без реклами й
> відстеження: слово надсилається на nebokrai.app лише тоді, коли ви про нього питаєте. Словник створено на
> основі Вікісловника та ВЕСУМ.
