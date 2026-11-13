# Nebokrai dictionary data

Builds the dictionary database for nebokrai.app from the English Wiktionary
extract published by kaikki.org.

## Rebuild

    mkdir -p data/raw && cd data/raw
    curl -o uk.jsonl https://kaikki.org/dictionary/Ukrainian/kaikki.org-dictionary-Ukrainian.jsonl
    curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/uk/uk_full.txt
    curl -O https://downloads.tatoeba.org/exports/per_language/ukr/ukr_sentences.tsv.bz2
    curl -O https://downloads.tatoeba.org/exports/per_language/ukr/ukr-eng_links.tsv.bz2
    curl -O https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2
    cd ../..
    python3 data/import_wiktionary.py data/raw/uk.jsonl nebokrai.db --freq data/raw/uk_full.txt --tatoeba data/raw
    python3 data/search.py nebokrai.db good

The build takes about 30 seconds. Only Python 3 is needed, no packages.
`--freq` and `--tatoeba` are optional; without them you get the plain dictionary.

kaikki.org marks the per-language file as deprecated. When it disappears, filter
`raw-wiktextract-data.jsonl.gz` from https://kaikki.org/dictionary/rawdata.html
down to lines with `"lang_code": "uk"`; the format is the same.

## Tables

| Table | One row per | Rows (Nov 2026) |
|---|---|---|
| `entries` | dictionary word + part of speech | 30,982 |
| `senses` | English meaning of an entry | 47,567 |
| `forms` | inflected form (declension / conjugation cell) | 529,270 |
| `relations` | other word an entry names: synonym, antonym, derived or related | 79,365 |
| `examples` | Tatoeba sentence with English translation | 28,670 |
| `search_keys` | normalised lookup key pointing at an entry | 1,489,667 |

Pages that only say "genitive singular of X" are skipped (29,315), because the
same forms are already in X's own table.

## Related words

`relations` holds the other words Wiktionary lists on an entry or on one of
its meanings (`sense_n`; empty for the entry as a whole). 18,942 entries name
at least one.

| Kind | Rows | Entries | Rows whose word has an entry |
|---|---|---|---|
| `synonym` | 30,114 | 12,584 | 22,584 |
| `antonym` | 1,497 | 1,093 | 1,277 |
| `derived` (formed from the word) | 26,716 | 7,098 | 7,933 |
| `related` (same root) | 21,038 | 6,910 | 12,688 |

Three things are done to what Wiktionary gives:

- **Cleaning.** A romanisation in brackets and a gender or aspect mark in
  Latin letters are cut off (`мольфар (molʹfar)`, `не́бо n`). A word is not
  listed under itself, nor twice under one meaning.
- **Stress.** A word written without a stress mark takes the headword's when
  exactly one headword has that spelling: `красивий` becomes `краси́вий` (887
  rows).
- **Both ways.** A synonym or an antonym is also stored on the other word's
  side when that spelling has exactly one entry of the same part of speech:
  великий names малий, so малий names великий (7,720 rows, with no meaning
  attached). With two candidates there is no telling which was meant, and
  nothing is added.

Coordinate terms are left out: 532 entries carry about 29,000 of them (every
month under січень, every country under Україна).

Whether the other word has an entry is not stored. The site looks it up when
it draws a page, so the answer cannot go stale.

## Frequency ranking

`entries.freq_rank` is 1 for the most common word. 19,928 entries are ranked.

The counts come from FrequencyWords, which counts spellings in film subtitles.
Each count is credited to the entry the spelling belongs to (читаю counts for
читати). Two corrections are applied:

- **Shared spellings.** When a spelling belongs to several entries, the entry
  whose dictionary form it is gets four shares and the others one each.
- **Russian in the subtitles.** About a third of the list is Russian. Tatoeba's
  Ukrainian sentences act as a clean reference: a spelling may count for at
  most 20 times its relative frequency there.

The ranking is good for ordering search results and picking common words. It
is not exact: subtitles over-represent spoken language, and some oddities
remain where Wiktionary's own tables are wrong.

## Example sentences

Up to three Tatoeba sentences per entry (11,857 entries), preferring sentences
of about five words. A sentence is attached to every entry that has one of its
words as a form, so a homograph can pick up a sentence meant for its twin.
`tatoeba_id` links back to the sentence for attribution.

## How search works (`search.py`)

1. Exact word, stress and case ignored: `калина`
2. Any inflected form: `книги` finds `книга`, `читаю` finds `читати`
3. Latin letters in the official romanisation: `kalyna`, `khata`
4. English meaning that is exactly the query: `good` finds `добрий`
5. Latin letters, loosely spelled: `kalina`
6. English meaning that mentions the query: `good` also finds `добро`
7. Prefix match, for search-as-you-type

Within each step, more common words come first.

A result found through an inflected form also says which form the query is
(`matched_forms`): `руки` is both руки́, the genitive singular of рука, and
ру́ки, its nominative, accusative and vocative plural. The same holds for a
form typed in Latin letters (`ruky`).

The site runs a TypeScript version of the same search (`src/lib/search/`).
`search.py` stays the reference. After changing it or rebuilding the database,
record its answers again and run the TypeScript tests against them:

```
cd data && python3 make_search_cases.py ../nebokrai.db ../vesum.db > ../tests/search-cases.json
cd .. && npm install && npm test
```

## Lenient search ("did you mean")

When a query has no sure match, `lookup()` in `search.py` adds guesses. Four
extra kinds of key in `search_keys` make this possible with plain index
lookups:

| Kind | What it is | Rows |
|---|---|---|
| `latin_form` | an inflected form in Latin letters (`knyhy`) | 301,740 |
| `sound` | the Latin key with sound-alike letters merged (е/и/і, щ/ш) | 31,089 |
| `sound_form` | the same for inflected forms | 271,568 |
| `typo` | every `sound` key with one letter removed | 256,503 |

A Cyrillic query is first written in Latin letters, so both scripts share the
same keys. Guesses are tried in order: wrong keyboard layout (`ghbdsn`),
another spelling (`привит`, `dobra nich`, Russian letters), sound-alike
(`превіт`, `kiev`), one typo (`привфт`). Typo guesses cover dictionary words
only; storing them for every inflected form would double the database.

`export_wordlist.py` writes the word list the browser uses for suggestions
while typing:

```
python3 data/export_wordlist.py nebokrai.db static/words.json
```

## VESUM form lookup (separate database)

    pip install pymorphy3 pymorphy3-dicts-uk
    python3 data/import_vesum.py vesum.db                           # about 80 seconds, 211 MB
    python3 data/search.py nebokrai.db --vesum vesum.db соловейком

VESUM lists 393,095 Ukrainian words with 3.7 million forms, but no meanings.
Search uses it only as a fallback: when a Cyrillic query matches nothing in
Wiktionary, VESUM tells us which dictionary word the form belongs to. If
Wiktionary has that word, its entry is shown (`нездійсненними` finds
`нездійсненний`). If not, search returns a bare result marked `vesum_only`
(`соловейком` finds `соловейко`, with no definition).

**VESUM must stay in its own file.** Its licence is CC BY-NC-SA 4.0
(non-commercial), Wiktionary's is CC BY-SA 4.0, and the two cannot be merged
into one dataset. Nothing from `vesum.db` is copied into `nebokrai.db`, and
deleting `vesum.db` removes VESUM from the site completely. While it is in
use, the site has to stay non-commercial.

The data comes from the `pymorphy3-dicts-uk` package, a 2022 snapshot of VESUM.

## Publishing to D1

The live site reads the dictionary from Cloudflare D1, which loads SQL text,
not a `.db` file. `export_sql.py` writes that text:

    python3 data/export_sql.py nebokrai.db data/raw/nebokrai.sql   # 125 MB, 2.1 million rows
    python3 data/export_sql.py vesum.db data/raw/vesum.sql         # 224 MB, 3.7 million rows

A rebuilt dictionary goes into a **new** database, and the site is then
pointed at it. The old one stays until the new one is seen to work, so going
back is one deploy.

    npx wrangler d1 create nebokrai-dict-<date> --location=eeur
    npx wrangler d1 execute nebokrai-dict-<date> --remote --file=data/raw/nebokrai.sql

1. Put the new database's name and id in `wrangler.jsonc` (binding `DB`).
2. `npm run deploy`.
3. Purge the cache in the Cloudflare dashboard. Search answers are cached for
   an hour and entry ids change with every rebuild, so until the purge a
   cached answer can carry an id that now belongs to another word.
4. When the site has been checked, delete the old database:
   `npx wrangler d1 delete nebokrai-dict-<old date>`.

`vesum.db` is published the same way, into its own database (binding
`VESUM`), never into the dictionary's: see the licence note above. It only
needs publishing again when `import_vesum.py` has been run again.

Loading counts as rows written, index entries included: about 4.8 million for
the dictionary and 3.7 million for VESUM. The Workers Paid plan includes 50
million a month; the free plan's 100,000 a day cannot load either.

To try a dump without touching the account, use `--local` in place of
`--remote`; the data then goes into `.wrangler/` in the repo.

## Recordings of the letters

    python3 data/letter_recordings.py [--ffmpeg path/to/ffmpeg]

The alphabet page (`/alphabet`) plays a recording of each letter: 32 files by
one speaker on Wikimedia Commons (Tabrus, 2023, CC BY-SA 4.0), every letter
but ь. As recorded, each is about two and a half seconds long for half a second
of letter, with a click of the lips before it or a breath after it in many, and
the letters differ in loudness by 12 dB. So the site plays copies of its own.
The script:

1. asks the Commons API for the files of the category and keeps the originals
   in `data/raw/letters/` (5 MB). Commons gives an unnamed script about ten
   files and then asks it to wait ten minutes, so the first run takes about
   half an hour; a file already there is not fetched again.
2. finds the letter in each recording by its loudness, cuts the rest away,
   takes the hiss down, brings every letter to the same peak and writes
   `static/audio/letters/09-zh.mp3` and the like (about 10 KB each). It prints
   each cut, and what it left out that was louder than a quiet room, to be
   looked over. `CUTS` in the script sets a letter's cut by hand where the rule
   gets it wrong.
3. writes `src/lib/alphabet/recordings.ts`: each letter's file, and the Commons
   page of its original, which the page links to.

It needs ffmpeg and no database, and stops if a file has another author or
licence, since the page credits them all in one line. The mp3 files and the
module are generated and committed: change the script, not them.

## Known gaps

- 1,030 nouns, verbs and adjectives have no inflection table.
- 17,622 entries have audio.
- Words missing from Wiktionary (for example `соловейко`) are found through
  VESUM but have no definition.

## Licence

| Source | Licence | What it requires |
|---|---|---|
| English Wiktionary (via kaikki.org) | CC BY-SA 4.0 | credit, and share derived data under the same licence |
| FrequencyWords (OpenSubtitles 2018) | CC BY-SA 4.0 | same |
| Tatoeba | CC BY 2.0 FR | credit Tatoeba, link to the sentence |
| VESUM (separate `vesum.db`) | CC BY-NC-SA 4.0 | credit, non-commercial use only, keep apart from the rows above |
