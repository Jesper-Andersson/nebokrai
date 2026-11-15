# Deploying

For whoever runs nebokrai.app. Back to the [README](../README.md).

The site runs on Cloudflare Workers, with four D1 databases and a binding
that sends email. `wrangler.jsonc` describes all of it.

| Binding | Database | Holds |
|---|---|---|
| `DB` | `nebokrai-dict-<date>` | the dictionary (`nebokrai.db`) |
| `VESUM` | `nebokrai-vesum-<date>` | VESUM forms (`vesum.db`), apart for its licence |
| `USERS` | `nebokrai-users` | accounts, sessions, saved words |
| `REPORTS` | `nebokrai-reports` | "Report an issue" reports |

**Merging into `main` deploys.** Once CI's checks pass on `main`, its
`deploy` job builds the site, publishes it with `wrangler deploy` and checks
that `/` and `/word/voda` answer. Only the newest commit on `main` goes out.
The job needs two secrets on the GitHub environment `production`:
`CLOUDFLARE_API_TOKEN` (made from the "Edit Cloudflare Workers" template) and
`CLOUDFLARE_ACCOUNT_ID`. By hand, from a checkout of `main`:

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
  deployed site has no word list. No page loads it yet, so the deploys from
  CI, which has no `nebokrai.db`, go out without it. Once a page does, CI
  must get the file another way.
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
- **The report form has a bot check**, Cloudflare Turnstile. The widget's
  site key is `TURNSTILE_SITE_KEY` in `src/lib/report.ts`; its secret key is
  the secret `TURNSTILE_SECRET` (`npx wrangler secret put TURNSTILE_SECRET`).
  Without the secret the form shows no check and the server asks for none,
  which is how `npm run dev` runs. The site key works on `nebokrai.app`
  only: to try the check locally, see the test keys in `.env.example`.
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
