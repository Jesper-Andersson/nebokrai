# Search API

The contract between the front end and the dictionary data. Three endpoints, all
`GET`, all returning JSON. The code behind them is in `src/lib/search/`.
The routes are `src/routes/api/search/+server.ts` and
`src/routes/api/word/[word]/+server.ts`. The Details page (`/word/<slug>`)
reads the database directly instead of calling `/api/word`.

| Endpoint | Used by | Code |
|---|---|---|
| `/api/search?q=…` | results page | `lookup()` in `suggest.ts` |
| `/api/word/…` | Details page | `wordDetails()` in `word.ts` |
| `/api/gloss?w=…` | the card over a word in a sentence | `glossFor()` in `src/lib/gloss.ts` |

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
| `limit` | optional | Most results to return. Default 20, at most 50. A value that is not a whole number above 0 counts as 20. |

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
| `vesum_only` | Present and `true` only on VESUM-only results, and on a word Nebokrai lists as not standard Ukrainian (see below). |
| `kind` | On a VESUM-only result, what the word is, when VESUM says: `distorted` (not standard Ukrainian), `given-name`, `patronymic`, `surname` or `abbreviation`. Absent otherwise. |
| `use` | The Ukrainian words to say instead of a non-standard word, at most three, each `{ "word", "has_entry" }`: on the entry that answers it (`through.kind` is `nonstandard`), or on a result with `kind: "distorted"`, where it may be empty. Absent otherwise. See "Words that are not standard Ukrainian". |
| `through` | Present when the query led to this entry without being one of its forms: a reflexive verb with no entry (see "Reflexive verbs"), a word the entry names on its head line (see "Words on a head line"), or a word that is not standard Ukrainian and this entry the word to say instead (`kind: "nonstandard"`). |
| `old` | Present when every meaning that matched is tagged old: `dated`, `archaic` or `obsolete`, the mildest of those meanings' strongest tags. `swedish` → све́йський has `"old": "obsolete"`. Absent otherwise. |

Results arrive already sorted; show them in the order given. A result with
`old` comes after the modern results of its `match`, and one whose `match` is
`english` after the `english_mention` results too; with `match` `word`, `form`,
`head` or `latin` it keeps its place.

### `match`

| Value | Example | |
|---|---|---|
| `word` | `калина` → калина | The query is the dictionary word. |
| `form` | `книги` → книга | The query is an inflected form. `matched_forms` says which. |
| `head` | `історично` → історичний | The query has no entry, but this entry names it on its head line. `through` says how. |
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
  "word": "осташко",
  "headword": "осташко",
  "pos": "noun",
  "tags": [],
  "head_forms": [],
  "glosses": [],
  "freq_rank": null,
  "match": "form",
  "vesum_only": true,
  "kind": "surname"
}
```

There is no stress mark, no meaning and no Details page for it. The page can
say that the word exists and that it has no entry yet.

`kind` is there for the 30,000 or so words VESUM marks as a given name, a
patronymic, a surname or an abbreviation, so that the page can say "a surname
with no dictionary entry yet". The word is in lower case, as VESUM's are here.
Where a word is more than one of these, the likeliest is given, in the order
above: Максимович is a patronymic before it is a surname. A plain word
(`книжечка`) has no `kind`, and neither has any word when `vesum.db` was built
before kinds were stored.

### Words that are not standard Ukrainian

A Russian word, surzhyk or a misspelling with no entry (`таможня`, `криша`) is
answered with the entry of the Ukrainian word to say instead: an ordinary
result with `match: "form"`, an empty `matched_forms`, a `through` whose kind is
`nonstandard`, and a `use` list of all the Ukrainian words offered, this one
included (shortened):

```json
{
  "id": 42320,
  "word": "присуд",
  "headword": "при́суд",
  "pos": "noun",
  "match": "form",
  "matched_forms": [],
  "through": { "word": "приговор", "kind": "nonstandard" },
  "use": [
    { "word": "при́суд", "has_entry": true },
    { "word": "вирок", "has_entry": true },
    { "word": "о́суд", "has_entry": true }
  ]
}
```

The answering entry is the first word in `use` that has an entry (its
commonest entry, when the spelling has several). When none has, the word
comes back as a VESUM-only result instead, with `"kind": "distorted"` (ahead
of any other kind: таракан is a surname too) and whatever `use` there is,
possibly empty:

```json
{ "id": null, "word": "всевідаючий", "headword": "всевідаючий", "pos": "adj", "match": "form",
  "vesum_only": true, "kind": "distorted", "use": [] }
```

- `word` in `use` is the stressed headword where exactly one entry has the
  spelling, else the plain spelling (вирок has two entries). Link it with
  `wordPath(word)`, stress marks removed, when `has_entry` is true; otherwise
  show it as text.
- Nebokrai's own suggestions (`data/nonstandard.tsv`) come first, then
  VESUM's, those with an entry before those without; three at most. `use` can
  be empty: VESUM marks the word but suggests nothing that is one word.
- A word must be marked in every form, or listed by Nebokrai, to count:
  VESUM also marks single wrong forms of ordinary words.
- A word in Nebokrai's list gets this result without `vesum.db` too, and then
  `pos` is `""` and only Nebokrai's own suggestions are given (`криша` → `дах`).
- With a `vesum.db` or a database built before these lists existed, the word
  comes back as a VESUM-only result, as before, with an empty `use` or no
  `kind`.

### Reflexive verbs

Wiktionary has `утворювати` and not `утворюватися`. When VESUM says the query
is a form of a reflexive verb (one ending in `-ся` or `-сь`) that has no entry,
and the verb without that ending has one, that entry is the result:

```json
{
  "id": 16002,
  "word": "утворювати",
  "match": "form",
  "matched_forms": [],
  "through": { "word": "утворюватися", "kind": "reflexive" }
}
```

(the other fields are left out here). `through.word` is the reflexive verb in
its dictionary form, whichever of its forms was searched for. The meanings are
those of the verb without `-ся`, which the reflexive verb often does not share
(`вчити` "to teach", `вчитися` "to study"), so the page says how the result was
reached and promises nothing more. A reflexive verb with an entry of its own
(`вчитися`) is found as itself, with no `through`.

### Words on a head line

An entry's head line names other words: істори́чний lists its adverb
істори́чно, впе́рше another spelling упе́рше, ходи́ти its perfective
походи́ти. About 9,600 of these have no entry and no table row of their own.
A query that is one of them, and is neither a dictionary word nor an inflected
form, finds the entry that names it, with `match: "head"`:

```json
{
  "word": "історичний",
  "match": "head",
  "through": { "word": "істори́чно", "kind": "adverb" }
}
```

`through.word` is the word as the head line writes it, with its stress.
`through.kind` is what it is to the entry: `alternative` (another spelling),
`adverb`, `adjective`, `abstract-noun`, `perfective`, `imperfective`,
`feminine`, `diminutive`, `augmentative`, `comparative`, `superlative`, or
`form` for anything else. The meanings are the entry's, not the word's, so the
page says how it was reached ("is listed as its adverb"). A word can be more
than the head line says: походити is also "to come from", a verb of its own.

An inflected form of such a word (`мінеральних`) is found through VESUM, as in
"VESUM-only results": the result is the entry that names its dictionary word
(мінера́л, for мінера́льний), with `match: "form"`, an empty `matched_forms` and
the same `through`. A spelling two entries name gives both.

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
      "offensive": false,
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
        { "uk": "…", "en": "…", "tatoeba_id": 0, "adapted": false, "original": null }
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
| `source` | `wiktionary`; `nebokrai` for an entry written for this dictionary (the abbreviations `км`, `англ.`, and English meanings of our own for common words Wiktionary has no page for, `облишити`; such an entry has no `forms`, `etymology` or `ipa`); or `wiktionary-translations` for a word with no Wiktionary page of its own, made from the translation tables of English pages (`шериф`, under "sheriff"). Credit and link accordingly: neither of the last two has a Wiktionary page. An entry from translation tables is thin: no `forms`, `etymology`, `ipa` or `freq_rank`, and each meaning is the English word with the table's note on which of its meanings is meant, `sheriff (all meanings)`. |
| `offensive` | `true` for a slur on a people or a faith, or a word Wiktionary calls highly offensive (`хохол`), from Nebokrai's hand-written `data/marked-offensive.tsv`. Show a warning with it. Slurs on Russians are `false` by choice; their meanings still carry Wiktionary's tags (`derogatory`, `ethnic`, `slur`). |
| `roman` | Wiktionary's scholarly romanisation. Can be `null`. |
| `ipa` | Pronunciation. `null` for 30% of entries, nearly all of them entries from translation tables (2% of the others). |
| `audio_url` | An mp3 on Wikimedia Commons. `null` for 61% of entries. |
| `etymology` | Plain text, sometimes several lines. `null` for 43% of entries (20% of those with a Wiktionary page). |
| `senses[].gloss` | The meaning in English. For a word Wiktionary describes through another word, the gloss says so: "comparative degree of вели́кий: bigger, larger, greater", "verbal noun of утвори́ти pf: formation", "female equivalent of а́втор (“author, authoress”)". The word it names is in `relations` as `related`, with `sense_n` set. |
| `senses[].tags` | Labels for one meaning: `transitive`, `poetic`, `colloquial`, `uncountable`, … Such a meaning also carries `form-of` or `alt-of`. |
| `senses[].examples` | Usage quotes from Wiktionary: `{ "text", "english" }`. Usually empty. |
| `forms` | One item per cell of the declension or conjugation table. Empty when the word does not inflect or has no table. |
| `examples` Chosen by a rating of how natural each sentence sounds. | Up to three Tatoeba sentences. Link `https://tatoeba.org/sentences/show/<tatoeba_id>` for credit. `adapted` is `true` when Nebokrai corrected the sentence (`data/tatoeba-corrections.tsv`); say so beside the credit. |
| `examples[].original` | `null` for a sentence as Tatoeba has it. Where a correction changed the Ukrainian (a hand-written one, or a checked one that fills a gap no other sentence could), `original` is Tatoeba's text (`…в нашомі місті…` for `…в нашому місті…`). Mark such a sentence as edited when you show it. |
| `head_forms[].has_entry` | `true` when the form is spelled like another dictionary word. Here only, not in search results. See "Words that lead to other words". |
| `relations` | The other words the entry names: synonyms, antonyms, derived words and words of the same root. Empty for about 35% of entries. |

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

## `GET /api/gloss?w=<word>&before=<word>&after=<word>`

The small card that opens over a word in an example sentence
(`src/lib/GlossWord.svelte`). Asked once, when the card first opens.

| Parameter | | |
|---|---|---|
| `w` | required | The word as the sentence has it: `склянку`. |
| `before` | optional | The word just before it, only when a space alone stands between them. |
| `after` | optional | The word just after it, on the same terms. |

Each is at most 40 characters; a longer one gets `400` with
`{ "error": "word_too_long" }`. An empty `w` answers
`{ "phrase": null, "readings": [] }`.

The word is first read together with `before`, then with `after`, because
some pairs are entries of their own. For `w=ласка&before=будь&after=склянку`:

```json
{
  "phrase": {
    "word": "будь ласка",
    "headword": "будь ла́ска",
    "pos": "phrase",
    "tags": [],
    "forms": [],
    "meaning": "please",
    "freq_rank": null
  },
  "readings": [
    { "word": "ласка", "headword": "ла́ска", "pos": "noun", "tags": ["animal-not-person", "feminine"],
      "forms": [], "meaning": "weasel (mammal, Mustela nivalis)", "freq_rank": 300 },
    { "word": "ласка", "headword": "ла́ска", "pos": "noun", "tags": ["feminine", "inanimate"],
      "forms": [], "meaning": "caress, endearment", "freq_rank": 301 }
  ]
}
```

For `w=склянку` the one reading has the form that was found, grouped as
`groupMatched()` in `src/lib/forms.ts` groups it:
`"forms": [{ "form": "скля́нку", "labels": ["accusative singular"] }]`.

| Field | Meaning |
|---|---|
| `phrase` | The pair as one entry, or `null`. Only an entry whose `word` has a space counts. |
| `readings` | Up to three entries the word is, or is a form of, most likely first. Empty when the dictionary does not know the word. |
| `word`, `headword`, `pos`, `tags` | As in `/api/search`. Link with `wordPath(word)`. |
| `forms` | Which forms the word is: empty when it is the word itself. |
| `meaning` | The first meaning, or `null` for a word only VESUM knows. |
| `freq_rank` | As in `/api/search`: the word's place among the most frequent, or `null` when it is too rare to be ranked. |
| `vesum_only` | Present and `true` when there is no entry, only a known spelling (no link then). |
| `kind` | As in `/api/search`: what a VESUM-only word is, when VESUM says. |
| `use` | As in `/api/search`: the Ukrainian words to say instead of a non-standard word. |
| `through` | As in `/api/search`: the word in the sentence, when the reading is the verb a reflexive verb is made from, the entry whose head line names the word, or the Ukrainian word for a non-standard one (`kind: "nonstandard"`). |

Only entries that are the word, one of its forms or a word on their head line are given: a word that
starts with it (ласкаво for ласка) or mentions it in a meaning is not, nor
is a letter, a symbol or a part of a word (`у` is the preposition, not the
letter У).
An entry whose every meaning only names a form (`вихідних`, "genitive/locative
plural of вихідни́й") is left out when the word has another reading, so
`вихідних` gives вихідні, "weekend", first.
There are no "did you mean" guesses.

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

## `POST /api/hit`

Counts a page view or a search for the site's own visit numbers. The route is
`src/routes/api/hit/+server.ts`; the counting is `src/lib/server/stats.ts`.
Sent by the site's pages with `navigator.sendBeacon` (`src/lib/hit.ts`): after
each page shown, and after a search whose answer was on screen for 1.5 seconds
or one of whose results was opened.

```json
{ "kind": "view", "path": "/word/voda" }
{ "kind": "view", "path": "/word/voda", "referrer": "google.com" }
{ "kind": "search", "query": "вода", "results": 5, "suggested": 0 }
```

| Field | |
|---|---|
| `kind` | `view` or `search`. |
| `path` | `view`: the page's path, or `(not found)` for a page that answered 404. A later page of a list is counted as the list (`/words/a/2` as `/words/a`). Paths outside the site's sections, and ones that cannot be decoded, are counted together as `(other)`. |
| `query` | `search`: the text searched, at most 200 characters. Counted after normalising (lower case, no stress marks); its text is kept only up to 40 characters, for 90 days. |
| `results` | `search`: how many results the answer had; `0` counts as a search that found nothing, unless `suggested` says otherwise. |
| `suggested` | `search`: how many "did you mean" guesses the answer had. A search with no results but a guess is counted as guessed, not as one that found nothing. Left out, it is `0`. |
| `referrer` | `view`, on the first page of a visit only: the host name of the site that sent the visitor (`document.referrer`'s host, never the rest of that address), or `""` when there is none or it is this site. A leading `www.` is dropped. Anything that is not a lower-case host name with a dot, of at most 100 characters, is not counted. |

What is kept, all of it as counts per day (Kyiv's date) with nothing that
says who:

- Views, visitors, signed-in visitors, searches and searches that found
  nothing, per day, for good.
- Views per page, for 400 days.
- Search words of up to 40 characters, with how often each was searched, by
  how many visitors and how often it found nothing, for 90 days.
- Three counts made once per visitor per day, when the visitor is first
  counted that day, kept for 400 days: the referring site (`referrer`, or
  `(direct)`; only when that first count is the first page of a visit), the
  country (Cloudflare's two-letter code for the request; not counted when
  Cloudflare gives none, `XX` or `T1`), and `phone` or `desktop` (from the
  user agent; a tablet counts as a desktop). A day keeps at most 300
  different referring sites; later ones are counted together as `(other)`.
- Searches counted as guessed, per day, for 400 days.

The answer is always `204` with no body, whether or not anything was counted:
a body that is not JSON or over 1 KB, a user agent that is a program, a
browser sending `DNT: 1` or `Sec-GPC: 1`, a signed-in owner of the site
(`STATS_USER_IDS`), or more than 300 counts in 10 minutes from one address
are all dropped without an error. A browser driven by a program
(`navigator.webdriver`) does not send the request at all. No cookie is set
and the IP address is not stored (see `stats.ts`). A request whose `Origin`
names another site gets the site-wide `403 cross_site`.

## `POST /api/suggest`

A reader's suggested correction to one part of a word's page: the headword,
its stress, a meaning, a quotation under a meaning, an example sentence or a
form in the tables. The word page sends it; nothing is shown publicly until
the site's keeper has reviewed it.

```json
{
  "target": "meaning",
  "word": "вода",
  "pos": "noun",
  "headword": "вода́",
  "sense_n": 2,
  "current": "waters, body of water",
  "proposed": "waters; a body of water (sea, lake, river)",
  "note": "optional: a source, or why",
  "native": true,
  "name": "optional, for the credit",
  "turnstile": "<token of the form's bot check>"
}
```

| `target` | Also needed | What `proposed` replaces |
|---|---|---|
| `headword`, `stress` | | the headword, with its stress mark (`вода́`) |
| `meaning` | `sense_n`, `current` (the meaning as shown) | the meaning |
| `quote` | `sense_n`, `current` (the quotation as shown) | the quotation; `proposed_en` its English |
| `example` | `tatoeba_id` | the Ukrainian sentence; `proposed_en` its English |
| `form` | `form_tags` (`["genitive", "plural"]`), `current` (the form) | the form |
| `new-word` | `pos` one of `noun`, `verb`, `adjective`, `adverb`, `other`, `unknown` | nothing: it is the English meaning |

`new-word` is a word with no entry, offered where a search finds nothing.
`word` is the spelling searched for, in Ukrainian letters (with `'`, `-` and
spaces), at most 60 of them; `headword` is the same with the reader's stress
marks (at most two, each after a vowel), or the same without any. The answer
adds `others`, how many readers asked for the same word before and are still
waiting: `{ "ok": true, "id": 42, "others": 2 }`.

The entry is named by `word`, `pos` and `headword`, and the part by keys that
survive a rebuild of the dictionary, never by an entry id. The server looks the
part up and stores what the dictionary holds there as the "before"; `current`
only helps to find it. `proposed` and `proposed_en` are at most 500 characters,
`note` 1,000 and `name` 60.

A visitor who is not signed in needs `turnstile`, as on `/api/report`; a
signed-in one does not. By sending, the reader agrees that the suggestion may
be published under CC BY-SA 4.0, which the form says.

Response `200`: `{ "ok": true, "id": 41 }`.

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "invalid_target" }` | `target` is not one of the seven, or `word`, `pos` or `headword` is missing; for `new-word`, also a `word`, `pos` or `headword` outside the rules above. |
| `400` | `{ "error": "missing_proposed" }` | `proposed` is empty. |
| `400` | `{ "error": "unchanged" }` | The proposal says what the dictionary already says. |
| `403` | `{ "error": "bot_check" }` | Not signed in, and no token Cloudflare accepts. |
| `404` | `{ "error": "not_found" }` | The dictionary has no such part: the page was loaded before the data changed. |
| `409` | `{ "error": "exists" }` | `new-word` only: the dictionary has an entry for that spelling. |
| `413` | `{ "error": "too_large" }` | A text is over its limit, or the body is over 16 KB. |
| `429` | `{ "error": "too_many" }` | More than 10 suggestions in ten minutes from one address. |
| `503` | `{ "error": "bot_check_unavailable" }` | Cloudflare gave no verdict on the token; send again. |

### `POST /api/suggest/<id>`

For the site's keeper only, from the page `/suggestions`: moves suggestion
`<id>` to another status. Body: `{ "status": "accepted" }`, where the status is
`new`, `accepted`, `rejected` or `applied`, with an optional `note`. Response
`200`: `{ "ok": true }`. Anyone else, and an id that does not exist, gets
`404 not_found`; a status that is none of the four gets `400 invalid_status`.

## Licence of the data

The answers carry dictionary data, and each source keeps its own licence
(`docs/sources-and-licences.md` has the credits in full):

| What | Licence |
|---|---|
| Entries: words, meanings, forms, pronunciation | Wiktionary, CC BY-SA 4.0 (`source: "wiktionary-translations"` too); entries with `source: "nebokrai"` are Nebokrai's, same licence |
| `examples` and `example` | Tatoeba, CC BY 2.0 FR; credit with the link to the sentence |
| Results with `vesum_only: true`, their `kind`, `use` past Nebokrai's own suggestions, and `through` on a result with `match: "form"` | VESUM and dict_uk, CC BY-NC-SA 4.0: no commercial use |
| `through` on a result with `match: "head"` | Wiktionary, CC BY-SA 4.0: it is read from the entry's head line |
| `freq_rank` | FrequencyWords, CC BY-SA 4.0 |

A result with `match: "form"` and an empty `matched_forms` was found with
VESUM's help, but everything in it apart from `through` is the Wiktionary entry.

## Errors

| Status | When |
|---|---|
| `400` | `/api/search` with `q` over 100 characters. Body: `{ "error": "query_too_long" }`. |
| `400` | `/api/gloss` with a word over 40 characters. Body: `{ "error": "word_too_long" }`. |
| `404` | `/api/word/…` for a word with no entry. |
| `404` | `/api/radio/now/…` for a station that is not in the list. |
| `400` | `/api/practice` with no `points`, or more than 20. Body: `{ "error": "bad_points", "max": 20 }`. |
| `429` | `/api/search`, `/api/word/…` or `/api/gloss` asked too often. Body: `{ "error": "too_many" }`; see below. |
| `500` | Anything unexpected. Body: `{ "error": "internal" }`, with SvelteKit's `status` and `message` beside it. |

### Too many requests

The dictionary endpoints, the word pages (`/word/…`) and a search from the
address (`/?q=…`) share one limit per client, counted per minute in each
Cloudflare data centre (`src/lib/server/crawler.ts`). Over it, the answer is
`429` with `Retry-After: 60`: `{ "error": "too_many" }` from `/api/…`, one line
of plain text from a page.

| Client | Counted by | Limit |
|---|---|---|
| A program that names itself in `User-Agent` (`AhrefsBot`, `curl`, `python-requests`) | that name, from every address | 30 a minute |
| Anyone else | address (an IPv6 address by its /64) | 120 a minute |
| Googlebot from Google's network, bingbot from Microsoft's | not counted | none |

A cached answer counts too: the limit is checked before the cache is.
The search page and the details page never come near it.

## Caching

The dictionary endpoints (`/api/search`, `/api/word/…`, `/api/gloss`) answer
the same thing to every visitor, so a `200` is sent with
`Cache-Control: public, max-age=300, s-maxage=3600` and kept in Cloudflare's
cache for an hour (`src/lib/server/cache.ts`). Parameters other than the ones
each endpoint lists are ignored and do not make a separate cache entry.

`/api/radio/now/…` is kept the same way but for 15 seconds
(`max-age=15, s-maxage=15`): a station is asked at most four times a minute in
each Cloudflare data centre, however many people are listening.

`/api/coverage` is kept for a day (`max-age=86400, s-maxage=86400`), by
browsers as well: it changes only with the dictionary, and it is the largest
answer the site gives.

After `nebokrai.db` is rebuilt and uploaded, answers can be up to an hour old,
with the entry ids of the previous build. Purge the cache in the Cloudflare
dashboard to switch at once.

## Suggestions while typing (no request)

The dropdown under the search box does not call the server. The page
downloads `static/words.json` once (31,204 headwords, most common first,
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

A visitor can save words without an account: the words are then kept in the
browser's `localStorage` and the server is not involved. Signing in (Google or
GitHub) moves them to the account, so they are the same on every device. The
browser side is `src/lib/saved.svelte.ts`, the server side
`src/lib/server/users.ts`.

A saved word is `{ "word": "книга", "saved_at": 1794400000000 }`: the `word`
field of a search result, and when it was saved in milliseconds. Saved words
are given newest first. One visitor can save at most 5,000 words, and can sort
them into named [lists](#lists).

| Endpoint | Signed in? | |
|---|---|---|
| `GET /api/saved` | yes | The account's saved words, exported marks and lists: `{ "words": [...], "exported": {...}, "lists": [...] }`. |
| `PUT /api/saved/<word>` | yes | Save one word. `{ "ok": true }`, also when it was already saved. An optional body `{ "lists": ["<id>"] }` also puts it in those lists. |
| `DELETE /api/saved/<word>` | yes | Remove one word, and take it out of every list. `{ "ok": true }`, also when it was not saved. |
| `POST /api/saved/merge` | yes | Add a browser's saved words and lists to the account. |
| `POST /api/saved/exported` | yes | Mark words as exported just now. `{ "ok": true }`. |
| `PUT /api/lists/<id>` | yes | Create a list, or rename it. `{ "ok": true }`. |
| `DELETE /api/lists/<id>` | yes | Delete a list; its words stay saved. `{ "ok": true }`, also when there was no such list. |
| `POST /api/lists/<id>/words` | yes | Put saved words into a list, or take words out of it. `{ "ok": true }`. |
| `POST /api/words/summary` | no | Headword and meanings for a list of words. |
| `POST /api/words/cards` | no | What a flashcard holds, for a list of words. |
| `POST /api/words/match` | no | The dictionary word each word of an imported list is. |
| `POST /api/words/missing` | no | Words an import found in no entry, kept for adding to the dictionary. |
| `POST /api/review/sync` | yes | Send the flashcards reviewed in this browser, receive those reviewed elsewhere. |
| `GET /api/review/deck/<deck>` | no | The words of a ready-made review deck. |
| `GET /api/coverage` | no | How often each common word is used, for the coverage figure on /learn. |
| `GET /api/placement` | no | A new placement test: words to say yes or no to, and grammar sentences. |
| `POST /api/placement` | no | Score the placement test's words. |
| `DELETE /api/account` | yes | Delete the account and everything kept for it. `{ "ok": true }`. |

"Signed in" means the request carries the `session` cookie. The browser sends
it by itself to same-site requests; it is `HttpOnly`, so page scripts never
see it.

The pop-up dictionary extension (`extension/`) saves with the same session:
its background script asks `GET /api/saved` for the lists and sends
`PUT` and `DELETE /api/saved/<word>` with the cookie. Those two writes are the
only ones accepted from a browser extension's origin (`chrome-extension://…`,
`moz-extension://…`); every other write from one gets `403 cross_site`.
The extension sends both as `Content-Type: application/json`, `DELETE` included,
though the site no longer asks for it: until SvelteKit's own origin check was
turned off (`csrf.trustedOrigins` in `vite.config.ts`), a write with no content
type from an extension got that check's `403` before the site's ran.

### `POST /api/saved/merge`

Called once, on the first page load after signing in, with the words saved in
this browser while signed out and the lists they were sorted into.

Body: `{ "words": [{ "word": "книга", "saved_at": 1794400000000 }], "exported": { "книга": 1794400500000 }, "lists": [...] }`.
`exported` and `lists` are optional; `lists` has the shape described under
[Lists](#lists).

Response `200`: `{ "words": [...], "exported": {...}, "lists": [...] }`, all of
the account's saved words, marks and lists afterwards. A word already in the
account keeps its date. Items that are malformed or not dictionary words are
skipped, and so are words beyond the limit of 5,000.

A sent list joins the account by these rules, in the order sent:

- The account has a list with that `id`: the list gains the sent words and
  keeps the account's name.
- Otherwise, the account has a list with that name, in any letter case: the
  sent list folds into it, so «Їжа» made on two devices becomes one list.
- Otherwise the list is created, unless the account already has 50; then the
  list is dropped and its words stay saved.

A word is put into a list only if it is one of the account's saved words after
the merge.

### Lists

A list is `{ "id": "0b9f…", "name": "Їжа", "created_at": 1794400000000, "words": ["хліб", "сир"] }`.
Lists work like labels: a saved word can be in several lists, or in none, and
a list holds saved words only. `GET /api/saved` gives them oldest first. One
visitor can have at most 50. Signed out, the browser keeps its lists in
`localStorage`; signed in, the account holds them.

The browser chooses the `id` when the list is made (a UUID; 8 to 36 letters,
digits, `_` or `-`), so a list made while signed out is still the same list
after the merge. The rules shared by the browser and the server are in
`src/lib/lists.ts`.

`PUT /api/lists/<id>` with `{ "name": "Їжа" }` creates the list, or renames
it if the account has a list with that id. The name is stored with spaces
trimmed and runs of spaces collapsed, and has at most 40 characters. Two of
one account's lists cannot have the same name, and letter case does not make
names differ.

`POST /api/lists/<id>/words` with `{ "add": ["хліб"], "remove": ["сир"] }`
changes what is in a list; either field may be left out. Words in `add` that
are not saved are skipped without an error, and so are words in `remove` that
are not in the list. Removing a word from a list leaves it saved.

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

### `POST /api/words/match`

Which dictionary word each word of an imported list is: the Import page asks
this about the words it read from an Anki deck or a text file. The file
itself is read in the browser and never sent. Changes nothing.

Body: `{ "words": ["вода́", "автобусом", "київ", "картинка"] }`, at most 500
words. With `"suggest": true`, at most 20, and a word with no match also gets
guesses.

Response `200`:

```json
{
  "matches": {
    "вода́": { "word": "вода", "suggestions": [] },
    "автобусом": { "word": "автобус", "suggestions": [] },
    "київ": { "word": "Київ", "suggestions": [] },
    "картинка": { "word": null, "suggestions": [] }
  }
}
```

A word is matched by its own spelling first, with stress marks and letter
case set aside, and then as an inflected form of a word (`автобусом`). Failing
both, it is tried again with у and в, or і and й, swapped at the start, since
Ukrainian writes either (`вміти` finds уміти). Where
several entries share a spelling, the one spelled exactly as written wins,
then the most common. `word` is the entry's exact spelling, the one
`/api/saved` and `/api/review/sync` take. `suggestions` holds at most three
words, most likely first, and is empty unless `suggest` was asked for.

### `POST /api/words/missing`

Words an import found in no dictionary entry, sent by the Import page when
the visitor imports, so that the dictionary can grow where learners need it.
Only the words are sent: not the rest of the card, and nothing about who sent
them. A word the visitor left out of the import is not sent.

Body: `{ "words": ["картинка", "ґоблін"] }`, at most 200 words. A word with no
Cyrillic letter, an empty one or one over 100 characters is dropped.

Response `200`: `{ "stored": 2 }`, the number of words kept. Each import that
names a word counts once more for it, so the words most worth adding can be
found first. They are kept in the private reports database, never in the
dictionary's own (`src/lib/server/missing-words.ts` says how to read them).

Errors: `400 invalid_words` when `words` is not a list of at most 200;
`429 too_many` after 20 requests in ten minutes from one address.

### `POST /api/words/cards`

What the Saved page's Export menu puts on a flashcard (`src/lib/export.ts`
builds the Anki text file, the two CSVs and the JSON from it in the browser). Like
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
      "audio_url": "https://upload.wikimedia.org/wikipedia/commons/…/Uk-калина.ogg",
      "example": { "uk": "…", "en": "…", "tatoeba_id": 123456, "adapted": false }
    }
  ]
}
```

The same words, in the same order and chosen by the same rules as
`/api/words/summary`, with the entry's part of speech, grammar tags and IPA
(`null` if it has none). `audio_url` is a recording on Wikimedia Commons, or
`null`; the review page plays it and no export uses it. `example` is the
entry's first Tatoeba sentence, or `null`; credit it with a link to
`https://tatoeba.org/sentences/show/<tatoeba_id>`, and say "adapted" beside it
when `adapted` is `true`. Nothing in the answer comes from VESUM.

With `"recall": true` in the body, as the review page sends it, each card also
has a `recall` field: what typing the word needs (`src/lib/review/recall.ts`).

```json
"recall": {
  "forms": ["вода", "води", "вод", "воді", "водам", "воду", "водою", "водами", "водах", "водо"],
  "gap": {
    "start": 27, "length": 4, "plain": "води", "also": [],
    "readings": [
      { "form": "во́ди", "tags": [["nominative", "plural"], ["accusative", "plural"]] },
      { "form": "води́", "tags": [["genitive", "singular"]] }
    ]
  }
}
```

`forms` is every spelling of the word, the dictionary form first, as `plain()`
writes them (no stress, lower case). `gap` is where `example.uk` has the word,
in UTF-16 code units, or `null` if the card has no sentence or the sentence has
the word in no form the dictionary lists. `plain` is the word as the sentence
has it, `also` its other spellings of the same form (брату beside братові), and
`readings` what that spelling can be, grouped by stress; a vocative reading is
left out where there is another. The exports never ask for it.

### Flashcard review

The review page (`/review`) schedules flashcards in the browser with FSRS-6
(`src/lib/review/fsrs.ts`); the server never works out a schedule. Signed out,
the cards are kept in `localStorage`. Signed in, the account holds them too,
and one call keeps the two in step.

A card is the schedule of one word:

```json
{
  "word": "калина", "due": 1794573000000, "stability": 2.3065, "difficulty": 2.1181,
  "state": 2, "step": 0, "reps": 2, "lapses": 0, "added_at": 1794400000000, "last_review": 1794400200000
}
```

Times are in milliseconds, on the browser's clock. `stability` is the number
of days after which the chance of recalling the word has fallen to 90%,
`difficulty` runs from 1 to 10. `state` is 1 (learning), 2 (review) or 3
(relearning); `step` is the learning step the card is on. `reps` counts
answers, `lapses` the times a card in review was forgotten. A word that has
never been answered has no card.

#### `POST /api/review/sync`

Body: `{ "cards": [...], "since": 1794400000000, "settings": {...}, "device": "…", "days": {...}, "progress": {...} }`,
every field optional, at most 500 cards and 400 days.

Response `200`: `{ "cards": [...], "settings": {...}, "days": {...}, "progress": {...}, "now": 1794400300000 }`.

- `cards` sent are stored. When the account already has a card for the word,
  the copy with the later `last_review` is kept (with the same `last_review`,
  the one with more `reps`), so sending a card twice, or late, does no harm.
  Malformed cards and words not in the dictionary are skipped; a grammar
  point's card (below, `grammar:bez-gen`) is kept as a word's is. A
  `last_review` later than the server's clock is taken as now. An account
  holds at most 10,000 cards; new ones beyond that are skipped.
- `cards` returned are the account's cards stored at or after `since`, which
  is the `now` of an earlier answer; `0` asks for all of them. Without
  `since` the list is empty: a browser with more than 500 cards to send
  leaves it out of every request but the last.
- `settings` is `{ "new_per_day": 10, "decks": ["saved", "common-500"], "paused": ["common-1000"],
  "goal_days": 4, "plan": "After my morning coffee", "updated_at": 1794400000000 }`: how many new words a
  day, which decks new words come from (every word started is reviewed whichever decks these are), which
  decks are paused (`saved` or a deck of common words: their words are neither reviewed nor new until
  resumed, unless also in a deck not paused; settings without `paused` have none),
  on how many days a week the visitor means to practise (1 to 7; `0` is no goal), and their if-then plan
  in their own words (one line, at most 80 characters; `""` is none). Settings without `goal_days` or
  `plan`, or with a malformed one, are read as having no goal or no plan. A deck is
  `saved` (every saved word), `list:<id>` (one of the visitor's lists, by the
  list's id; at most 50 are kept) or a deck of common words. Whether a list
  still exists is not checked here: a deleted list is a deck with no words,
  and the browser drops it the next time the decks are changed. Of the copy sent
  and the account's, the one with the later `updated_at` is kept, and
  returned; `null` when the account has none.
- `days` counts the reviews done on each day, for the review page's calendar
  and streak: `{ "2026-11-12": 34 }`. A day is the visitor's own date, and
  starts at 04:00. Each browser counts only its own reviews and sends them
  under `device`, a name it makes up for itself once (a UUID; 8 to 64 letters,
  digits, `-` or `_`). What it sends replaces what it sent before for those
  days, so a count sent twice is counted once, and a smaller count (an answer
  undone) is taken as it is. Days sent without a valid `device` are ignored.
- `days` returned are the sums for the account's other browsers, without the
  rows of `device`: the browser adds its own. Empty without `since`.
- `progress` holds the learner's progress outside the cards, a record per kind
  (`src/lib/review/progress.ts`), each optional. Each record sent is joined
  with the account's copy, never simply replaced by it, and `progress`
  returned is every record the account has as it now stands (`{}` when none),
  with or without `since`. A record that is malformed is left out; times later
  than the server's clock are taken as now.
  - `placement`: `{ "results": [{ "at": 1794400000000, "size": 1240, "start": 1001, "reliable": true,
    "placed": ["where", "where-to"] }], "updated_at": 1794400000000 }`. The placement test's
    results, newest first, at most 3; the first is the one in force, and `[]` is none (every result
    undone). `start` is where new common words begin (1 to 2,001), `placed` the lessons placed out, by
    id; an unreliable result has `start` 1 and none placed. Of two copies the one with the later
    `updated_at` is kept whole, so an undo or a retake wins like any change.
  - `alphabet`: `{ "letters": { "ж": { "box": 3, "seen": 8, "right": 7 } }, "skipped": false,
    "cleared_at": 0, "updated_at": 1794400000000 }`. The alphabet trainer's letters, as `/alphabet`
    keeps them. Joined letter by letter, the copy asked more often (`seen`) winning; a copy last changed
    before the other's `cleared_at` (every letter forgotten) loses its letters. `skipped` (the learner
    reads Cyrillic already) comes from the copy changed later.
  - `reading`: `{ "texts": { "kit-i-mysha": { "band": 500, "at": 1794400000000 } }, "updated_at": … }`.
    The texts read to the end, by id (lower-case letters, digits and `-`), each with its band (500,
    1000, 2000 or 5000) and when it was first read. Joined as a union, the earlier `at` kept; at most
    2,000. Nothing writes it yet: it waits for graded reading.

A card stays when its word is removed from the saved list, as an exported
mark does.

#### `GET /api/review/deck/<deck>`

`<deck>` is `common-500`, `common-1000` or `common-2000`.

Response `200`: `{ "deck": "common-500", "words": ["не", "я", "в", …] }`. The
commonest spellings in order, as `/common-words` counts them: places 1 to 500,
501 to 1,000 and 1,001 to 2,000. Cached like a search. The `saved` deck is the
visitor's own list and has no address here.

#### `GET /api/coverage`

How often each common word is used, for the line on /learn that says how much
of everyday Ukrainian the visitor's known words cover. The sum is done in the
browser over its own flashcards (`src/lib/coverage.ts`), so this answer is the
same for everyone. Cached for a day (see Caching).

Response `200`:

```json
{ "words": ["не", "я", "в", …], "freq": [27800, 16500, 13500, …], "total": 612009 }
```

- `words`: spellings, commonest first, in the order of `/common-words` and the
  decks; the first 500 are `common-500`. A spelling with several entries
  (мати, a verb and a noun) is one word.
- `freq`: uses per million words of film and TV subtitles, beside each
  spelling, summed over its entries and rounded to three significant figures.
- `total`: the same summed over every ranked word, words used less than once per
  million included, though they are left out of the lists.

Names, capitalised spellings and what is not a word (letters, signs, affixes)
are left out of both sides. About 11,600 words, 270 KB, 63 KB compressed.

### Placement test

About five minutes that say where a learner who knows some Ukrainian already
should start (`src/lib/placement.ts`). It moves starting points only: where new
common words begin, and lessons marked as placed out. It never makes a card,
and nothing is stored on the server: the browser keeps the result as the
`placement` record and an account gets it with the next `POST /api/review/sync`.
Signed in or not alike.

#### `GET /api/placement`

Response `200`:

```json
{
  "words": ["вікно", "кнашка", "дякувати", …],
  "grammar": [{ "lesson": "where", "gaps": [{ "point": "u-loc", "uk": "…", … }, { "point": "na-loc", … }] }, …]
}
```

- `words`: part 1, 80 words in random order: 12 drawn from each of five bands
  of the commonest spellings (places 1–500, 501–1,000, 1,001–2,000,
  2,001–3,000 and 3,001–5,000, as `/common-words` counts them) and 20 made-up
  words that look Ukrainian. Which is which is not said; the learner answers
  each "I know it" or "Not sure".
- `grammar`: part 2, every lesson of `/practice` in order: the nine about
  cases after prepositions (`where` … `above-below`), then the ten of verbs'
  patterns (`gov-na-acc` … `gov-za-ins`). A preposition lesson has two
  sentences of its own rules (a lesson of one rule has it twice), a verbs'
  lesson one: 28 in all, as `GET /api/practice` gives them (a verb's sentence
  with `cue_start` and `cue_length`). Each is answered by choosing among
  `choices`, or, for a who item, between its two nouns. A lesson is placed
  out when all its sentences are right. The two groups stop apart: after two
  lessons in a row with a mistake, the rest of that group is not asked
  (`placeLessons`), and the verbs are still asked after the prepositions
  stop. A lesson with no sentences in the dictionary is left out.

The made-up words come from the dictionary build (`meta.placement_pseudo`,
`data/README.md`). Any that VESUM knows as a word are dropped when the test is
served, so a learner is never marked wrong for knowing a real word.

Sent with `Cache-Control: no-store`. `503` with `{ "error": "unavailable" }`
when the dictionary was built before the made-up words were, or has fewer
than 20 left: without them a guess cannot be told from a word known.

#### `POST /api/placement`

Body: `{ "answers": [{ "word": "вікно", "yes": true }, …] }`, at most 80.

Response `200`:

```json
{
  "bands": [{ "from": 1, "to": 500, "asked": 12, "yes": 12, "known": 1 }, …],
  "pseudo": { "asked": 20, "yes": 1 },
  "size": 1240,
  "start": 1001,
  "reliable": true
}
```

- `bands`: for each band, the words asked and the yes among them, and `known`,
  the share of yes corrected for false alarms: with h the share of yes in the
  band and f the share of yes to made-up words, max(0, (h − f) / (1 − f)).
- `size`: the sum of each band's `known` times its width, rounded to tens: the
  words estimated known among the commonest 5,000.
- `start`: the first place of the first band whose `known` is under 0.8, at
  most 2,001 (one past the last deck of common words); 1 when not reliable.
- `reliable`: false when more than 40% of the made-up words had a yes, or fewer
  than 10 were answered. An unreliable result places nothing.

An answer for a word that is neither a common spelling nor a made-up word, or
for a word answered already, is left out. Sent with `Cache-Control: no-store`.
`400` with `{ "error": "invalid_answers", "max": 80 }` when `answers` is not a
list, is empty or has more than 80 items.

### Grammar practice

The practice page (`/practice`) asks for a noun in the case its preposition
takes. A grammar point is a preposition with one case, named by both:
`bez-gen` (без + genitive), `na-acc` and `na-loc` (на + accusative, на +
locative). The points are listed in `src/lib/practice/points.ts`; the cases
are `nom`, `gen`, `dat`, `acc`, `ins` and `loc`.

A verb's pattern is a point too: the case a verb or an adjective asks of the
noun after it (case government), named by the verb, its preposition if it
has one, and the case: `diakuvaty-dat` (дякувати + кому?),
`chekaty-na-acc` (чекати + на кого? на що?), `korystuvatysia-ins`
(користуватися + чим?). The patterns are listed once, in
`src/lib/practice/government.ts`, which `data/import_wiktionary.py` reads
too. Their sentences are found in Tatoeba where they can be and made from a
frame up to twenty (`Ми дякуємо сусідові.`, `tatoeba_id` `0`).

Three points are numbers with the form of the noun they count: `one-nom`
(1, 21, 31: the nominative singular, 21 рік), `few-nom` (2, 3, 4, 22: the
nominative plural, 22 роки) and `many-gen` (5 to 20, 25: the genitive
plural, 25 років). Their sentences are not found but made, from a list of
nouns and short frames in `src/lib/practice/numbers.ts` and the forms the
dictionary has: `У мене 5 книг.`

#### `GET /api/practice?points=<point>,<point>,…`

One sentence for each point named, in the order named, each drawn at random
from the point's sentences. A point named twice gets two different
sentences. At most 20 points; a point that is unknown or has no sentences is
passed over, so the answer can be shorter than the request.

Response `200`:

```json
{
  "gaps": [
    {
      "point": "bez-gen",
      "uk": "Я не можу цього зробити без допомоги.",
      "en": "I can't do this without help.",
      "start": 28, "length": 8,
      "answer": "допомо́ги", "also": [],
      "number": "singular",
      "word": "допомога", "headword": "допомо́га",
      "choices": ["допомо́зі", "допомо́гу", "допомо́ги", "допомо́га"],
      "forms": ["допомога", "допомоги", "допомог", "допомозі", "допомогам", "допомогу", "допомогою", "допомогами", "допомогах", "допомого"],
      "tatoeba_id": 5866649,
      "adapted": false
    }
  ]
}
```

- `start` and `length` say where the noun stands in `uk`, in UTF-16 code
  units (`uk.slice(start, start + length)`). `answer` is that noun with its
  stress mark; `word` and `headword` are its dictionary form, which the page
  shows beside the gap.
- `choices` are up to four forms of the noun with stress, in random order,
  `answer` among them. The others are forms that are not the case asked for,
  of the same number where the noun has enough; a form that is only the
  vocative is offered last.
- `also` lists other spellings of the same case and number, without stress
  and in lower case, where the noun has them (the locative of стіл is both
  столі and столу). They are as right as `answer` and never among the wrong
  `choices`.
- `forms` is every spelling of the noun, without stress and in lower case: a
  typed answer found there and not right is the right word in the wrong form.
- `number` is `singular` or `plural`.
- `adapted` is `true` when Nebokrai corrected the Tatoeba sentence
  (`data/tatoeba-corrections.tsv`); the credit then says "adapted". A sentence
  made here (`tatoeba_id` `0`) leaves it out.

A number's sentence has the same shape, with these differences:

```json
{
  "point": "few-nom",
  "uk": "У мене 2 сестри.",
  "en": "I have 2 sisters.",
  "start": 9, "length": 6,
  "answer": "сестри́", "also": [],
  "number": "plural",
  "word": "сестра", "headword": "сестра́",
  "choices": ["сестрі́", "се́стер", "сестра́", "сестри́"],
  "forms": ["сестра", "сестри", "сестер", "сестрі", "сестрам", "сестру", "сестрою", "сестрами", "сестрах", "сестро"],
  "tatoeba_id": 0
}
```

- `tatoeba_id` is `0`: the sentence is made here and has no author to credit.
- `number` is part of what is asked, so the page does not show it.
- `choices` are always four: beside `answer`, the forms a learner hesitates
  among (the nominative singular and plural, the genitive singular and
  plural), then any other.
- After 2, 3 and 4 `answer` has the letters of the nominative plural and the
  stress of the genitive singular (дві сестри́, два бра́ти), which is not
  always the stress the forms table gives the plural (се́стри, брати́).

A verb's pattern has the same shape, plus where its verb stands, so that the
page can set it in bold:

```json
{
  "point": "zavazhaty-dat",
  "uk": "Я заважаю дочці.",
  "en": "I disturb my daughter.",
  "start": 10, "length": 5,
  "answer": "дочці́", "also": [],
  "number": "singular",
  "word": "дочка", "headword": "дочка́",
  "choices": ["до́чки", "дочка́", "дочці́", "дочку́"],
  "forms": ["дочка", "дочки", "дочок", "дочці", "дочкам", "дочку", "дочкою", "дочками", "дочках", "дочко"],
  "tatoeba_id": 0,
  "adapted": false,
  "cue_start": 2, "cue_length": 7
}
```

- `cue_start` and `cue_length` say where the verb stands in `uk`, as `start`
  and `length` do for the noun. Absent on every other point, and on all
  points while the database's `cloze` table predates them.
- The verb may come after the noun: `Мені подобається…` has the gap first.
- `choices` put the likeliest wrong cases first: for the dative the
  accusative, then the genitive and the nominative; for the genitive the
  accusative and the nominative; for the instrumental the nominative and the
  accusative; after на or у with the accusative the locative; after з with
  the instrumental the genitive. A preposition's points follow the same order.
- A personal pronoun may be the gap (`Том довіряє нам.`): its `choices` and
  `forms` are that pronoun's own (нам, нас, нами, ми), never another's.
- `tatoeba_id` `0` marks a sentence made from a frame, with no credit.

A point of у, на or під can be named with `:where` (`u-acc:where`,
`na-loc:where`, `pid-ins:where`, and the same for `u-loc`, `na-acc`,
`pid-acc`). Its sentence is then one of a list picked by hand in
`src/lib/practice/where.ts`, where the question де? (locative or
instrumental: where something is) or куди? (accusative: where it goes)
plainly fits, and it comes back with the same shape plus `"kind": "where"`
and `partner`: the noun in the case of the other question, with stress
(`"partner": "вершині"` beside `"answer": "вершину"`), left out where the
dictionary has no such form.
The page shows that sentence whole and asks which question it answers; the
answer follows from `point`. Any other point named with `:where` is drawn as
if it were not marked, and a point asked more often than it has such
sentences gives each once.

The point `who-acc` asks which of two nouns does what the verb says. Its
sentences are made, as the numbers' are, from a verb and two living beings
in `src/lib/practice/roles.ts`, the doer first or last at random:

```json
{
  "point": "who-acc",
  "uk": "Собаку бачить кіт.",
  "en": "The cat sees the dog.",
  "start": 0, "length": 6,
  "answer": "соба́ку", "also": [],
  "number": "singular",
  "word": "собака", "headword": "соба́ка",
  "choices": [],
  "forms": ["собака", "собаки", "собаці", "собаку", "…"],
  "tatoeba_id": 0,
  "kind": "who",
  "roles": { "verb": "see", "doer": { "word": "кіт", "headword": "кіт", "start": 14, "length": 3 } }
}
```

- `start`, `length`, `answer` and `word` are the noun done to, in the
  accusative: its ending is what tells. `roles.doer` is the one that does
  it, in the dictionary form, and where it stands in `uk`.
- `roles.verb` names the verb's question in the page's strings ("Who sees
  whom?"). `choices` is empty: the page offers the two nouns as `кіт →
  собака` and `собака → кіт`, the first right.

Sent with `Cache-Control: no-store`: asking again must give other sentences.
`400` with `{ "error": "bad_points", "max": 20 }` when `points` is missing,
empty or names more than 20. An empty `gaps` for a preposition's point means
the dictionary was built before the sentences were (`data/README.md`,
"Sentences with a gap"); the numbers' points need only the dictionary.

A point's schedule is a review card whose `word` is `grammar:<point>`
(`"word": "grammar:bez-gen"`). It is worked out in the browser as a
flashcard's is, kept with the flashcards and sent through
`POST /api/review/sync`; a sentence answered adds one to the day's count
there. One round of practice is one review of each point it asked.

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
| `400` | `{ "error": "invalid_words" }` | `/api/words/summary` and `/api/words/cards`: `words` is not a list, or has more than 500 items. `POST /api/lists/<id>/words`: `add` or `remove` is not a list, or has more than 5,000 items. |
| `400` | `{ "error": "invalid_list" }` | `PUT /api/lists/<id>`: the id does not have the shape above, or the name is empty or longer than 40 characters. |
| `401` | `{ "error": "signed_out" }` | No session, or it has ended. |
| `403` | `{ "error": "cross_site" }` | A `POST`, `PUT`, `PATCH` or `DELETE` whose `Origin` header names another site, or that has no `Origin` header and either no `Content-Type` or a form's (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`). Applies to every address on the site (`mayWrite` in `src/lib/server/request.ts`), but for `PUT` and `DELETE /api/saved/<word>` from a browser extension. |
| `400` | `{ "error": "invalid_cards" }` | `/api/review/sync`: `cards` is not a list, or has more than 500 items. |
| `413` | `{ "error": "too_large" }` | The body is over the limit: 128 KB for `/api/words/summary` and `/api/words/cards`, 384 KB for `/api/review/sync`, 16 KB for `/api/placement`, 2 MB for `/api/saved/merge`, 1 MB for `/api/saved/exported` and `/api/lists/<id>/words`. |
| `404` | `{ "error": "not_found" }` | `PUT /api/saved/<word>` for a word with no entry. `POST /api/lists/<id>/words` for a list the account does not have. `GET /api/review/deck/<deck>` for a deck that does not exist. |
| `409` | `{ "error": "full" }` | `PUT /api/saved/<word>` when 5,000 words are already saved. `PUT /api/lists/<id>` for a new list when the account already has 50. |
| `409` | `{ "error": "name_taken" }` | `PUT /api/lists/<id>` when another of the account's lists has that name. |
