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
