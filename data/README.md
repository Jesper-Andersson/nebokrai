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
| `forms` | inflected form (declension / conjugation cell) | 564,299 |
| `examples` | Tatoeba sentence with English translation | 28,649 |
| `search_keys` | normalised lookup key pointing at an entry | 626,107 |

Pages that only say "genitive singular of X" are skipped (29,315), because the
same forms are already in X's own table.

## Frequency ranking

`entries.freq_rank` is 1 for the most common word. 19,920 entries are ranked.

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

Up to three Tatoeba sentences per entry (11,850 entries), preferring sentences
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

## Known gaps

- 1,030 nouns, verbs and adjectives have no inflection table.
- 17,622 entries have audio.
- Missing words exist (for example `соловейко`). VESUM would fill these, but
  its licence is non-commercial.

## Licence

| Source | Licence | What it requires |
|---|---|---|
| English Wiktionary (via kaikki.org) | CC BY-SA 4.0 | credit, and share derived data under the same licence |
| FrequencyWords (OpenSubtitles 2018) | CC BY-SA 4.0 | same |
| Tatoeba | CC BY 2.0 FR | credit Tatoeba, link to the sentence |
