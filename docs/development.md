# Developing Nebokrai

Notes for working on the site locally, beyond the quick start in the [README](../README.md).

## Sign-in (optional)

Saving words works without any setup: the list is kept in the browser. To try
sign-in locally, put the credentials of an OAuth app in a `.env` file in the
repo root (it is git-ignored):

```sh
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Either pair alone is enough; a provider without credentials has no sign-in
button. Register `http://localhost:5173/auth/callback/github` (or
`.../auth/callback/google`) as the redirect address at the provider. Accounts
and saved words then go to `users.db` in the repo root, created on first use.

In production the same four values are Worker secrets, and accounts live in a
D1 database bound as `USERS`, apart from the dictionary. What is stored about a
person: the provider's id for them, their display name, their saved words, when
each word was last exported, and the lists they sorted the words into.

## Changing the site's text

`npm run dev` puts an **Edit text** switch in the bottom left corner of every
page. With it on, click any text, change it in the box that opens and press
Save (Ctrl+Enter). The change is written into the source file the text comes
from, `src/lib/i18n.ts` or the page it is written in, and the page updates.

- A click on a link's text edits the text. Alt+click follows the link.
- A text that is written in more than one place is offered as a choice.
- A text with `${…}` in the box is a template: change the words around those
  parts and leave the parts as they are.
- Text from the dictionary data, and text a page puts together from several
  pieces, cannot be changed this way. The box says so and offers to open the
  page's file instead.

Write in English. Every change to English text is added to
`src/lib/i18n-todo.json` with what the text said before, and the switch shows
how many are waiting. The Ukrainian is then brought into line from that list,
and each entry is taken off it once done.

The switch and the address it talks to (`/__edit-text`, in
`scripts/edit-text/`) exist only in the dev server. The built site has neither.

## Installing the site as an app

A phone or a desktop browser can install the site: Chrome on Android offers
"Install app" in its menu. The installed app is the site without the
browser's bars; it is not a separate program and has no data of its own.

| File | |
|---|---|
| `static/manifest.webmanifest` | The app's name, colours, icons and shortcuts. Linked from `src/app.html`. |
| `static/icons/` | The icons, drawn from the logo by `npm run app-icons`. |
| `src/service-worker/` | Shows `static/offline.html` when a page cannot be reached, and keeps nothing else: pages and API answers differ by cookie, and the browser's own cache already holds the build's files. |
| `tests/installable.test.ts` | Holds the manifest, the icons, the offline page and the service worker together. |

The service worker has a `tsconfig.json` of its own and is type-checked at the
end of `npm run check`. It runs during `npm run dev` too: stop the dev server
and reload, and the offline page appears. Chrome's developer tools show the
manifest and the worker under Application. Nothing works offline beyond the
offline page: every search asks the server.
