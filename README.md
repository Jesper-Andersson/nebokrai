# Nebokrai

A Ukrainian learning site and dictionary, at [nebokrai.app](https://nebokrai.app).

*Небокрай* means "horizon", literally "sky's edge".

## What is here

| Path | |
|---|---|
| `src/routes/` | The site's pages (SvelteKit). |
| `src/lib/` | Shared components and assets. `src/lib/server/` picks the database: D1 in production, the local `nebokrai.db` during `npm run dev`. |
| `static/` | Files served as-is. `og.png`, the picture shown beside a shared link, is drawn by `npm run og-image`, and the app icons in `icons/` by `npm run app-icons` (both need Edge or Chrome). |
| `data/` | Scripts that build the dictionary database from open data. Start with `data/README.md`. |
| `src/lib/search/` | The search the site uses (TypeScript), a port of the reference search in `data/search.py`. |
| `tests/` | Checks that the TypeScript search agrees with the reference search in `data/search.py`. Run with `npm test`. |
| `docs/api.md` | What the front end asks the server and what it gets back. |
| `docs/sources-and-licences.md` | The text of the Sources page, and what each data licence requires. |

## Running the site locally

Needs Node.js 22.18 or later.

```sh
npm install
npm run dev     # http://localhost:5173
npm run check   # type and Svelte checks
npm test        # search tests; most need the databases from data/README.md
```

### Sign-in (optional)

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
person: the provider's id for them, their display name, their saved words and
when each word was last exported.

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

## The Android app

The Android app (`app.nebokrai`) is the same site shown full screen by Chrome:
a Trusted Web Activity. It has no code of its own, so the site's updates are
the app's updates, and sign-in and saved words work as they do in the browser.

| File | |
|---|---|
| `android/twa-manifest.json` | What the app is built from: package name, colours, icons, version. The only file in `android/` that is in git. |
| `static/.well-known/assetlinks.json` | The site vouching for the app. It lists the SHA-256 fingerprint of every key the app is signed with; without a match Chrome shows its address bar inside the app. |
| `tests/android.test.ts` | Holds the two files and the web manifest together. |

Building needs [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
(`npm i -g @bubblewrap/cli`), JDK 17 and the Android SDK; `bubblewrap doctor`
checks them. From `android/`:

```sh
bubblewrap update --skipVersionUpgrade  # writes the Android project from twa-manifest.json
bubblewrap build                        # app-release-signed.apk and app-release-bundle.aab
bubblewrap install                      # onto a phone connected with USB debugging
```

Things to know:

- **The signing key is not in the repo.** `signingKey.path` in
  `twa-manifest.json` says where it is on the machine that builds. Back it up:
  an update signed with another key is refused. `bubblewrap build` asks for
  its password, or reads `BUBBLEWRAP_KEYSTORE_PASSWORD` and
  `BUBBLEWRAP_KEY_PASSWORD`.
- **Google Play signs the published app with a key of its own.** Its
  fingerprint (Play Console, "App signing") goes into `assetlinks.json` and
  into `fingerprints` in `twa-manifest.json` beside the upload key's, and the
  site is deployed again.
- **Every upload to Play needs a higher `appVersionCode`.** `bubblewrap
  update` without `--skipVersionUpgrade` raises it.
- **On Windows, `bubblewrap build` fails with "'gradlew.bat' is not
  recognized"** when `NoDefaultCurrentDirectoryInExePath` is set in the
  environment. Remove it for that command.
- **Android 7 is the oldest version the app runs on** (`minSdkVersion` 24,
  which the library that opens Chrome requires).

## Deploying

The site runs on Cloudflare Workers, with four D1 databases and a binding
that sends email. `wrangler.jsonc` describes all of it.

| Binding | Database | Holds |
|---|---|---|
| `DB` | `nebokrai-dict-<date>` | the dictionary (`nebokrai.db`) |
| `VESUM` | `nebokrai-vesum-<date>` | VESUM forms (`vesum.db`), apart for its licence |
| `USERS` | `nebokrai-users` | accounts, sessions, saved words |
| `REPORTS` | `nebokrai-reports` | "Report an issue" reports |

```sh
npx wrangler login    # once per machine
npm run deploy        # builds, then publishes to nebokrai.app
npx wrangler tail     # live logs
npx wrangler rollback # back to the previous version
```

Before the first deploy, and after every rebuild of the dictionary, the data
has to be loaded into D1: see "Publishing to D1" in `data/README.md`.

Things to know:

- **`static/words.json` is not in git.** Make it before building
  (`python3 data/export_wordlist.py nebokrai.db static/words.json`), or the
  deployed site has no word list.
- **The four sign-in values are secrets**, set once with
  `npx wrangler secret put GITHUB_CLIENT_ID` and so on. The redirect address
  to register at each provider is `https://nebokrai.app/auth/callback/github`
  (or `/google`).
- **A new report is announced by email.** The `send_email` binding `MAIL`
  sends it to the address in the secret `REPORT_EMAIL`
  (`npx wrangler secret put REPORT_EMAIL`). Cloudflare delivers only to an
  address verified under Email Routing for `nebokrai.app`, so verify it there
  first. The mail never carries the reporter's own address. Without the
  secret, reports are stored and no mail is sent; to read them, see the
  command at the top of `src/lib/server/reports.ts`.
- **The site has one address.** `workers_dev` and `preview_urls` are off in
  `wrangler.jsonc`, so there is no `workers.dev` copy reaching the same
  databases.
- **`npm run dev` does not use D1.** It reads `nebokrai.db` and `vesum.db` in
  the repo root, and keeps accounts and reports in `users.db` and
  `reports.db`. To run the built site the way Cloudflare does, load the data
  with `--local` instead of `--remote` (see `data/README.md`), then
  `npm run build && npx wrangler dev .svelte-kit/cloudflare/_worker.js`.
- **Back up the two private databases**, which cannot be rebuilt:
  `npx wrangler d1 export nebokrai-users --remote --output=users.sql`, and the
  same for `nebokrai-reports`. The database does not answer while an export
  runs, so pick a quiet hour, and keep the files off this machine.

## Licence

The code is free software under the GNU Affero General Public License,
version 3 or later (`LICENSE`). Copyright © 2026 Jesper Andersson. If you run
a changed copy as a site, the licence asks you to offer your visitors its
source.

Some files are not the project's own and keep their own terms:

| Files | Terms |
|---|---|
| `src/lib/assets/fixel/`, `nyght-serif-main/`, `serif/` | Fonts under the SIL Open Font License 1.1; each folder holds its licence. |
| `src/lib/logo-paths.ts`, `src/lib/title-paths.ts` | Outlines of Caveat Bold, OFL 1.1 (`src/lib/assets/licences/Caveat-OFL.txt`). |
| `src/lib/assets/logo-icon.svg`, `static/favicon.ico`, `static/icons/` | Hold outlines of Montserrat ExtraBold, OFL 1.1 (`src/lib/assets/licences/Montserrat-OFL.txt`). |
| The bars' timings in `src/lib/RadioPlayer.svelte` | From SVG Loaders, MIT (`src/lib/assets/licences/SVG-Loaders-MIT.txt`). |
| `src/lib/assets/backgrounds/` | Photos under the Unsplash and Pexels licences. |
| `static/funds/` | Each logo belongs to its fund. No licence is given for them. |
| `tests/search-cases.json`, and the dictionary examples in `tests/` and `docs/` | Taken from the dictionary data: Wiktionary, CC BY-SA 4.0; one Tatoeba sentence, CC BY 2.0 FR. Two rows of `search-cases.json` (`соловейко`, `книжечка`) come from VESUM, CC BY-NC-SA 4.0. |

The dictionary data itself is not in this repository. The scripts in `data/`
build it from Wiktionary, Tatoeba, FrequencyWords and VESUM, and
`docs/sources-and-licences.md` credits each source and says what its licence
asks. VESUM's licence is non-commercial, so a site that serves it must be
non-commercial too.
