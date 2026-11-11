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
| `examples` | Tatoeba sentence with English translation | 28,670 |
| `search_keys` | normalised lookup key pointing at an entry | 1,489,667 |

Pages that only say "genitive singular of X" are skipped (29,315), because the
same forms are already in X's own table.

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

The site runs a TypeScript version of the same search (`src/lib/search/`).
`search.py` stays the reference. After changing it or rebuilding the database,
record its answers again and run the TypeScript tests against them:

```
cd data && python3 make_search_cases.py ../nebokrai.db ../vesum.db > ../tests/search-cases.json
cd .. && npm install && npm test
```

## Lenient search ("did you mean")

When a query has no sure match, `lookup()` in `search.py` adds guesses. Two
Four extra kinds of key in `search_keys` make this possible with plain index
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
