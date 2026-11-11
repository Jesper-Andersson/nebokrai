# Nebokrai dictionary data

Builds the dictionary database for nebokrai.app from the English Wiktionary
extract published by kaikki.org.

## Rebuild

    mkdir -p data/raw && curl -o data/raw/uk.jsonl https://kaikki.org/dictionary/Ukrainian/kaikki.org-dictionary-Ukrainian.jsonl
    python3 data/import_wiktionary.py data/raw/uk.jsonl nebokrai.db      # about 10 seconds
    python3 data/search.py nebokrai.db kalyna                        # try a search

Only Python 3 is needed, no packages.

kaikki.org marks the per-language file as deprecated. When it disappears, filter
`raw-wiktextract-data.jsonl.gz` from https://kaikki.org/dictionary/rawdata.html
down to lines with `"lang_code": "uk"`; the format is the same.

## Tables

| Table | One row per | Rows (Nov 2026) |
|---|---|---|
| `entries` | dictionary word + part of speech | 30,982 |
| `senses` | English meaning of an entry | 47,567 |
| `forms` | inflected form (declension / conjugation cell) | 564,299 |
| `search_keys` | normalised lookup key pointing at an entry | 626,107 |

Pages that only say "genitive singular of X" are skipped (29,315), because the
same forms are already in X's own table.

## How search works (`search.py`)

1. Exact word, stress and case ignored: `калина`
2. Any inflected form: `книги` finds `книга`, `читаю` finds `читати`
3. Latin letters: `kalyna`, `kalina`, `khata`, `pryvit`. Both the stored word and
   the query go through `loose_latin()`, which irons out romanisation habits.
4. English meaning: `viburnum`, `to read`
5. Prefix match, for search-as-you-type

## Known gaps

- No frequency data yet, so results are not ranked by how common a word is.
- 1,030 nouns, verbs and adjectives have no inflection table.
- 3,599 entries have example sentences; 17,622 have audio.
- Missing words exist (for example `соловейко`). VESUM would fill these.

## Licence

Dictionary content: English Wiktionary, CC BY-SA 4.0. The site must credit
Wiktionary and share derived dictionary data under the same licence.
