# Nebokrai

A Ukrainian learning site and dictionary, at [nebokrai.app](https://nebokrai.app).

*Небокрай* means "horizon", literally "sky's edge".

## What is here

| Path | |
|---|---|
| `src/routes/` | The site's pages (SvelteKit). |
| `src/lib/` | Shared components and assets. `src/lib/server/` picks the database: D1 in production, the local `nebokrai.db` during `npm run dev`. |
| `static/` | Files served as-is. |
| `data/` | Scripts that build the dictionary database from open data. Start with `data/README.md`. |
| `src/lib/search/` | The search the site will use (TypeScript). |
| `tests/` | Checks that the TypeScript search agrees with the reference search in `data/search.py`. Run with `npm test`. |
| `docs/api.md` | What the front end asks the server and what it gets back. |
| `docs/sources-and-licences.md` | Draft of the Sources page, and what each data licence requires. |

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
person: the provider's id for them, their display name and their saved words.

## Deploying

The site runs on Cloudflare Workers, with four D1 databases. `wrangler.jsonc`
describes all of it.

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
