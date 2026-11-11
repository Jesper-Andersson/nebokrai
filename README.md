# Nebokrai

A Ukrainian learning site and dictionary, at [nebokrai.app](https://nebokrai.app).

*Небокрай* means "horizon", literally "sky's edge".

## What is here

| Path | |
|---|---|
| `data/` | Scripts that build the dictionary database from open data. Start with `data/README.md`. |
| `src/lib/search/` | The search the site will use (TypeScript). |
| `tests/` | Checks that the TypeScript search agrees with the reference search in `data/search.py`. Run with `npm test`. |
| `docs/api.md` | What the front end asks the server and what it gets back. |
| `docs/sources-and-licences.md` | Draft of the Sources page, and what each data licence requires. |
