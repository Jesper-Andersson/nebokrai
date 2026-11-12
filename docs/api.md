# Search API

The contract between the front end and the dictionary data. Two endpoints, both
`GET`, both returning JSON. The code behind them is in `src/lib/search/`.
The routes are `src/routes/api/search/+server.ts` and
`src/routes/api/word/[word]/+server.ts`. The Details page (`/word/<slug>`)
reads the database directly instead of calling `/api/word`.

| Endpoint | Used by | Code |
|---|---|---|
| `/api/search?q=…` | results page | `lookup()` in `suggest.ts` |
| `/api/word/…` | Details page | `wordDetails()` in `word.ts` |

Saved words and accounts have endpoints of their own, described at the end
under [Saved words and accounts](#saved-words-and-accounts). The radio has one,
which has nothing to do with the dictionary:
[`GET /api/radio/now/<station>`](#get-apiradionowstation).

All text is UTF-8. Ukrainian words in a URL must be percent-encoded
(`encodeURIComponent` does this).

## `GET /api/search?q=<query>&limit=<n>`

| Parameter | | |
|---|---|---|
| `q` | required | What the user typed: Ukrainian, Latin letters or English. At most 100 characters. |
| `limit` | optional | Most results to return. Default 20, at most 50. |

A longer `q` gets `400` with `{ "error": "query_too_long" }`. The search box
has the same limit (`MAX_QUERY_LENGTH` in `src/lib/limits.ts`), so a visitor
never sees this.

Response `200`:

```json
{
  "query": "kalyna",
  "results": [
    {
      "id": 1132,
      "word": "калина",
      "headword": "кали́на",
      "pos": "noun",
      "tags": ["feminine", "inanimate"],
      "head_forms": [{ "form": "кали́ни", "tags": ["genitive"] }],
      "glosses": ["guelder rose, snowball tree, viburnum"],
      "freq_rank": 16580,
      "match": "latin"
    }
  ],
  "suggestions": []
}
```

| Field | Meaning |
|---|---|
| `id` | Entry id. `null` for a VESUM-only result (see below). |
| `word` | Plain spelling. Link to its Details page with `wordPath(word)` from `slug.ts`: `/word/kalyna`. |
| `headword` | Spelling with the stress mark (U+0301 after the stressed vowel). About 6% of entries have no stress mark. |
| `pos` | Part of speech: `noun`, `verb`, `adj`, `adv`, `name`, `pron`, `num`, `prep`, `conj`, `particle`, `intj`, `phrase`, and a few rare ones. |
| `tags` | Grammar labels for the word itself: gender and animacy for nouns, aspect for verbs. Can be empty. |
| `head_forms` | Key forms to show beside the headword: genitive for nouns, the aspect partner for verbs, comparative for adjectives. Zero to about seven. |
| `glosses` | English meanings, most important first. One to dozens. |
| `freq_rank` | 1 = most common word. `null` = too rare to rank. |
| `match` | Why this result matched, see the next table. |
| `matched_forms` | Present when `match` is `form` or `latin_form`: which forms of the word the query spells, see "Which form was found". |
| `vesum_only` | Present and `true` only on VESUM-only results. |

Results arrive already sorted; show them in the order given.

### `match`

| Value | Example | |
|---|---|---|
| `word` | `калина` → калина | The query is the dictionary word. |
| `form` | `книги` → книга | The query is an inflected form. `matched_forms` says which. |
| `latin` | `kalyna` → калина | Latin letters in the official romanisation. |
| `english` | `good` → добрий | One of the meanings is exactly the query. |
| `latin_form` | `knyhy` → книга | An inflected form in Latin letters. |
| `latin_loose` | `kalina` → калина | Latin letters, spelled approximately. |
| `english_mention` | `good` → добро | A meaning contains the query words. |
| `prefix` | `кал` → календар | The word starts with the query. For search-as-you-type. |

### Which form was found

A result whose `match` is `form` or `latin_form` carries `matched_forms`: the
rows of the word's table that the query spells, in the order of the table,
each with its stress and its tags (read them as in "Reading `forms`" below).
One spelling is often several forms, and they can be stressed apart. For
`руки` (and for `ruky`), рука answers:

```json
"matched_forms": [
  { "form": "ру́ки", "tags": ["nominative", "plural"] },
  { "form": "руки́", "tags": ["genitive", "singular"] },
  { "form": "ру́ки", "tags": ["accusative", "plural"] },
  { "form": "ру́ки", "tags": ["plural", "vocative"] }
]
```

`groupMatched()` in `src/lib/forms.ts` turns the list into what a search card
shows: "ру́ки nominative, accusative, vocative plural · руки́ genitive singular".

The list is empty when the form was found through VESUM (next section) and the
dictionary has the word: VESUM tells which word a form belongs to, not which
form it is. A VESUM-only result has no `matched_forms` at all.

### VESUM-only results

When a Ukrainian query matches nothing in the dictionary, the form is looked up
in VESUM. If VESUM knows which word it belongs to but the dictionary has no
entry for that word, the result looks like this:

```json
{
  "id": null,
  "word": "соловейко",
  "headword": "соловейко",
  "pos": "noun",
  "tags": [],
  "head_forms": [],
  "glosses": [],
  "freq_rank": null,
  "match": "form",
  "vesum_only": true
}
```

There is no stress mark, no meaning and no Details page for it. The page can
say that the word exists and that it has no entry yet.

### Suggestions ("did you mean")

`suggestions` is filled only when no result is a sure match: the results are
empty, or contain nothing better than words that start with the query or
meanings that mention it. Each suggestion has the same fields as a result,
and its `match` says how the guess was made:

| Value | Example | |
|---|---|---|
| `layout` | `ghbdsn` → привіт | Typed with the keyboard on the Latin layout. |
| `respelled` | `привит` → привіт, `dobra nich` → добраніч, `книгы` → книга | The same word under another spelling habit, with or without spaces, or with Russian letters. |
| `sound` | `превіт` → привіт, `shastya` → щастя, `kiev` → Київ | Letters that sound alike: е/и/і, щ/ш. |
| `typo` | `привфт` → привіт, `молако` → молоко | One letter wrong, missing, extra, or two swapped. |

At most five, most certain first. Example for `/api/search?q=превіт`:

```json
{
  "query": "превіт",
  "results": [],
  "suggestions": [
    {
      "id": 3258,
      "word": "привіт",
      "headword": "приві́т",
      "pos": "noun",
      "tags": ["inanimate", "masculine"],
      "head_forms": [{ "form": "приві́ту", "tags": ["genitive"] }],
      "glosses": ["greeting"],
      "freq_rank": 227,
      "match": "sound"
    }
  ]
}
```

(`head_forms` is shortened here.) `respelled` and `sound` also recognise
inflected forms (`кнегу` → книга). `typo` covers dictionary words only.

### Nothing found

`200` with `"results": []` and `"suggestions": []`. An empty or missing `q`
gives the same.

## `GET /api/word/<word>`

`<word>` is the `word` field from a search result. Stress marks and capital
letters in it are ignored.

Response `200`:

```json
{
  "word": "небокрай",
  "entries": [
    {
      "id": 13512,
      "word": "небокрай",
      "headword": "небокра́й",
      "pos": "noun",
      "tags": ["inanimate", "masculine"],
      "head_forms": [
        { "form": "небокра́ю", "tags": ["genitive"], "has_entry": true },
        { "form": "небокра́ї", "tags": ["nominative", "plural"], "has_entry": false },
        { "form": "небокра́їв", "tags": ["genitive", "plural"], "has_entry": false }
      ],
      "roman": "nebokráj",
      "ipa": "[nebɔˈkrai̯]",
      "audio_url": null,
      "etymology": "From не́бо (nébo) + -о- (-o-) + кра́й (kráj).",
      "freq_rank": 13765,
      "senses": [
        {
          "n": 1,
          "gloss": "horizon (part of the sky which appears to meet the earth in the distance)",
          "tags": [],
          "examples": []
        },
        { "n": 2, "gloss": "synonym of не́бо n (nébo, “sky”)", "tags": ["poetic"], "examples": [] }
      ],
      "forms": [
        { "form": "небокра́й", "tags": ["nominative", "singular"] },
        { "form": "небокра́ї", "tags": ["nominative", "plural"] },
        { "form": "небокра́ю", "tags": ["genitive", "singular"] }
      ],
      "examples": [
        { "uk": "…", "en": "…", "tatoeba_id": 0 }
      ],
      "relations": [
        { "kind": "synonym", "sense_n": 1, "word": "горизо́нт", "tags": [], "has_entry": true },
        { "kind": "synonym", "sense_n": 1, "word": "о́брій", "tags": [], "has_entry": true },
        { "kind": "synonym", "sense_n": null, "word": "кругозі́р", "tags": [], "has_entry": true }
      ]
    }
  ]
}
```

(`forms`, `examples` and `relations` are shortened here.)

`entries` is a list because one spelling can be several words: `привіт` is a
noun and an interjection, `стан` has five noun entries. They are ordered most
common first.

| Field | Meaning |
|---|---|
| `roman` | Wiktionary's scholarly romanisation. Can be `null`. |
| `ipa` | Pronunciation. `null` for about 1.5% of entries. |
| `audio_url` | An mp3 on Wikimedia Commons. `null` for 43% of entries. |
| `etymology` | Plain text, sometimes several lines. `null` for 18% of entries. |
| `senses[].tags` | Labels for one meaning: `transitive`, `poetic`, `colloquial`, `uncountable`, … |
| `senses[].examples` | Usage quotes from Wiktionary: `{ "text", "english" }`. Usually empty. |
| `forms` | One item per cell of the declension or conjugation table. Empty when the word does not inflect or has no table. |
| `examples` | Up to three Tatoeba sentences. Link `https://tatoeba.org/sentences/show/<tatoeba_id>` for credit. |
| `head_forms[].has_entry` | `true` when the form is spelled like another dictionary word. Here only, not in search results. See "Words that lead to other words". |
| `relations` | The other words the entry names: synonyms, antonyms, derived words and words of the same root. Empty for about 39% of entries. |

### Words that lead to other words

Each item of `relations` is one other word:

| Field | Meaning |
|---|---|
| `kind` | `synonym`, `antonym`, `derived` (formed from this word: великий → великодушний) or `related` (of the same root: великий → Великдень). |
| `sense_n` | The meaning it belongs to (`senses[].n`), or `null` when it belongs to the entry as a whole. |
| `word` | The other word, with its stress mark where it is known (about 96% of them). Can be a phrase. |
| `tags` | Remarks on the other word: its usage (`colloquial`, `rare`, `dialectal`) or its grammar (`feminine`, `perfective`). Usually empty. |
| `has_entry` | `true` when the dictionary has that word. Link to it with `wordPath(word)`; show the rest as plain text. |

They come in Wiktionary's order, a meaning's words before the entry's. A
synonym or an antonym also appears on the other word's side: великий names
малий, so малий names великий, with `sense_n` `null` when Wiktionary did not
say so itself. The page shows synonyms and antonyms under their meaning and
the other two kinds in a section of their own.

`has_entry` on a head form says the same thing about a form beside the
headword. The page links a form that has it unless the form carries a case:
the perfective `прочита́ти` of читати is a word of its own, while a genitive
that happens to be spelled like another word is still this word's genitive.

A database built before relations were stored has no `relations` table; the
endpoint then answers with an empty list for every entry.

### Reading `forms`

Each form carries the labels that place it in the table; the page groups them.

- **Nouns:** a case (`nominative`, `genitive`, `dative`, `accusative`,
  `instrumental`, `locative`, `vocative`) and a number (`singular`, `plural`).
  7 forms for singular-only words, 14 or more otherwise.
- **Adjectives:** a case, then `masculine`, `neuter`, `feminine` or `plural`.
  Masculine and neuter often share a cell (both tags on one form). The
  accusative also has `animate` or `inanimate`.
- **Verbs:** `infinitive`; `present` or `future` with a person
  (`first-person`, …) and number; `imperative`; `past` with a gender and
  number; participles (`adverbial`, `passive`, `impersonal`).

Two forms can share the same labels. That means the cell has two variants
(`небокра́ю` and `небокра́єві`, both dative singular); show both.

### Not found

`404` with `{ "error": "not_found", "word": "…" }`.

## `GET /api/radio/now/<station>`

The song a station of the radio is playing. `<station>` is an `id` from
`STATIONS` in `src/lib/radio.ts`, for example `promin`. The route is
`src/routes/api/radio/now/[id]/+server.ts`; the reading is `nowPlaying()` in
`src/lib/radio-now.ts`. Used by the radio player (`src/lib/radio.svelte.ts`),
every 20 seconds while a music station plays.

```json
{ "station": "promin", "title": "PRIANA - Молода" }
```

| Field | |
|---|---|
| `station` | The id asked for. |
| `title` | What the station says is playing, usually `artist - song`, at most 150 characters. `null` when it does not say: speech, adverts, or a station that did not answer within 4 seconds. |

`title` is the station's own text, shown as it is. It comes from the stream
(the title sent to players that ask for it) or, for a station with `playlist`
in `radio.ts`, from the list its own player reads. The server asks the
station; the visitor's browser does not.

`null` is a normal answer, not an error: the player then shows no song.

A `<station>` that is not in the list gets `404` with
`{ "error": "not_found", "station": "…" }`.

## Licence of the data

The answers carry dictionary data, and each source keeps its own licence
(`docs/sources-and-licences.md` has the credits in full):

| What | Licence |
|---|---|
| Entries: words, meanings, forms, pronunciation | Wiktionary, CC BY-SA 4.0 |
| `examples` and `example` | Tatoeba, CC BY 2.0 FR; credit with the link to the sentence |
| Results with `vesum_only: true` | VESUM, CC BY-NC-SA 4.0: no commercial use |
| `freq_rank` | FrequencyWords, CC BY-SA 4.0 |

A result with `match: "form"` and an empty `matched_forms` was found with
VESUM's help, but everything in it is the Wiktionary entry.

## Errors

| Status | When |
|---|---|
| `400` | `limit` is not a number. |
| `400` | `/api/search` with `q` over 100 characters. Body: `{ "error": "query_too_long" }`. |
| `404` | `/api/word/…` for a word with no entry. |
| `404` | `/api/radio/now/…` for a station that is not in the list. |
| `500` | Anything unexpected. Body: `{ "error": "internal" }`. |

## Caching

The two dictionary endpoints answer the same thing to every visitor, so a
`200` is sent with
`Cache-Control: public, max-age=300, s-maxage=3600` and kept in Cloudflare's
cache for an hour (`src/lib/server/cache.ts`). Parameters other than `q` and
`limit` are ignored and do not make a separate cache entry.

`/api/radio/now/…` is kept the same way but for 15 seconds
(`max-age=15, s-maxage=15`): a station is asked at most four times a minute in
each Cloudflare data centre, however many people are listening.

After `nebokrai.db` is rebuilt and uploaded, answers can be up to an hour old,
with the entry ids of the previous build. Purge the cache in the Cloudflare
dashboard to switch at once.

## Suggestions while typing (no request)

The dropdown under the search box does not call the server. The page
downloads `static/words.json` once (29,020 headwords, most common first,
about 175 KB compressed) and matches locally:

```ts
import { buildIndex, suggestLocal } from '$lib/search/client-suggest';

const index = buildIndex(await (await fetch('/words.json')).json()); // once
suggestLocal(index, 'pryv', 5);
// [{ headword: 'приві́т', word: 'привіт', match: 'prefix' }, …]
```

`match` is `prefix`, `layout`, `sound` or `typo`, as above. It knows
dictionary words only, not inflected forms or English, so pressing Enter
should still go to `/api/search`. Building the index takes about 0.15 s; one
suggestion call takes a few milliseconds.

`words.json` is made by `python3 data/export_wordlist.py nebokrai.db static/words.json`.

## Saved words and accounts

A visitor can save words without an account: the list is then kept in the
browser's `localStorage` and the server is not involved. Signing in (Google or
GitHub) moves the list to the account, so it is the same on every device. The
browser side is `src/lib/saved.svelte.ts`, the server side
`src/lib/server/users.ts`.

A saved word is `{ "word": "книга", "saved_at": 1794400000000 }`: the `word`
field of a search result, and when it was saved in milliseconds. Lists are
newest first. One list holds at most 5,000 words.

| Endpoint | Signed in? | |
|---|---|---|
| `GET /api/saved` | yes | The account's list and its exported marks: `{ "words": [...], "exported": {...} }`. |
| `PUT /api/saved/<word>` | yes | Save one word. `{ "ok": true }`, also when it was already saved. |
| `DELETE /api/saved/<word>` | yes | Remove one word. `{ "ok": true }`, also when it was not saved. |
| `POST /api/saved/merge` | yes | Add a browser's list to the account. |
| `POST /api/saved/exported` | yes | Mark words as exported just now. `{ "ok": true }`. |
| `POST /api/words/summary` | no | Headword and meanings for a list of words. |
| `POST /api/words/cards` | no | What a flashcard holds, for a list of words. |
| `DELETE /api/account` | yes | Delete the account and everything kept for it. `{ "ok": true }`. |

"Signed in" means the request carries the `session` cookie. The browser sends
it by itself to same-site requests; it is `HttpOnly`, so page scripts never
see it.

### `POST /api/saved/merge`

Called once, on the first page load after signing in, with the words saved in
this browser while signed out.

Body: `{ "words": [{ "word": "книга", "saved_at": 1794400000000 }], "exported": { "книга": 1794400500000 } }`.
`exported` is optional.

Response `200`: `{ "words": [...], "exported": {...} }`, the account's whole
list and marks afterwards. A word already in the account keeps its date. Items
that are malformed or not dictionary words are skipped, and so are words beyond
the limit of 5,000.

### Exported marks

`exported` maps a word to when it was last exported to a file from the Saved
page, in milliseconds: `{ "книга": 1794400500000 }`. Signed out, the browser
keeps the marks in `localStorage`; signed in, the account holds them.

`POST /api/saved/exported` with `{ "words": ["книга", "небокрай"] }` marks
those words with the server's time. Only words in the account's list are
marked; others are skipped without an error. A mark stays when its word is
later removed from the list, so `exported` can name words that `words` does
not, and a word saved again is still marked. When two marks meet (a merge, a
second export), the later date is kept.

### `POST /api/words/summary`

What the Saved page shows beside each word. A `POST` only because the list can
be longer than a URL allows; it changes nothing.

Body: `{ "words": ["книга", "небокрай"] }`, at most 500 words.

Response `200`:

```json
{
  "words": [
    { "word": "книга", "headword": "кни́га", "pos": "noun", "glosses": ["book (elevated)"] },
    { "word": "небокрай", "headword": "небокра́й", "pos": "noun", "glosses": ["horizon (part of the sky which appears to meet the earth in the distance)", "synonym of не́бо n (nébo, “sky”)"] }
  ]
}
```

In the order asked. A word with no entry is left out. `word` must be the exact
spelling (`Київ`, not `київ`). A spelling with several entries is summarised
by its most common one. `pos` is that entry's part of speech, as in a search
result. `glosses` holds the first meanings, at most three.

### `POST /api/words/cards`

What the Saved page's Export menu puts on a flashcard (`src/lib/export.ts`
builds the Anki text file, the CSV and the JSON from it in the browser). Like
the summary, it changes nothing.

Body: `{ "words": ["калина", "небокрай"] }`, at most 500 words.

Response `200`:

```json
{
  "words": [
    {
      "word": "калина",
      "headword": "кали́на",
      "glosses": ["viburnum, guelder rose (shrub or berries)"],
      "pos": "noun",
      "tags": ["feminine", "inanimate"],
      "ipa": "[kɐˈɫɪnɐ]",
      "example": { "uk": "…", "en": "…", "tatoeba_id": 123456 }
    }
  ]
}
```

The same words, in the same order and chosen by the same rules as
`/api/words/summary`, with the entry's part of speech, grammar tags and IPA
(`null` if it has none). `example` is the entry's first Tatoeba sentence, or
`null`; credit it with a link to `https://tatoeba.org/sentences/show/<tatoeba_id>`.
Nothing in the answer comes from VESUM.

### Signing in and out

These are pages the browser visits, not JSON endpoints.

| Address | |
|---|---|
| `GET /login/google`, `GET /login/github` | Redirects to the provider. `404` when that provider has no credentials here. |
| `GET /auth/callback/<provider>` | Where the provider sends the visitor back. Starts the session and redirects to `/saved`, or to `/saved?login=failed`. |
| `POST /logout` | A form post. Ends the session and redirects to `/`. |

### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "invalid_json" }` | The body is not JSON. |
| `400` | `{ "error": "invalid_words" }` | `/api/words/summary` and `/api/words/cards`: `words` is not a list, or has more than 500 items. |
| `401` | `{ "error": "signed_out" }` | No session, or it has ended. |
| `403` | `{ "error": "cross_site" }` | A `POST`, `PUT`, `PATCH` or `DELETE` whose `Origin` header names another site. Applies to every address on the site (`src/hooks.server.ts`). |
| `413` | `{ "error": "too_large" }` | The body is over the limit: 128 KB for `/api/words/summary` and `/api/words/cards`, 1 MB for `/api/saved/merge`. |
| `404` | `{ "error": "not_found" }` | `PUT /api/saved/<word>` for a word with no entry. |
| `409` | `{ "error": "full" }` | `PUT /api/saved/<word>` when the list already holds 5,000 words. |
