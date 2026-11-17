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
    curl -L https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz \
        | python3 data/extract_translations.py > data/raw/uk_translations.jsonl
    python3 data/import_wiktionary.py data/raw/uk.jsonl nebokrai.db --freq data/raw/uk_full.txt --tatoeba data/raw \
        --abbreviations data/abbreviations.tsv --translations data/raw/uk_translations.jsonl
    python3 data/search.py nebokrai.db good

The build takes about a minute. Only Python 3 is needed, no packages.
`--freq`, `--tatoeba`, `--abbreviations` and `--translations` are optional;
without them you get the plain dictionary. The English extract is a 534 MB
download that is read as a stream and not stored; what is kept of it is 8 MB
(53,511 translations in October 2026). Its file only changes when kaikki.org
publishes a new extract, so a rebuild can reuse the one in `data/raw/`.

kaikki.org marks the per-language file as deprecated. When it disappears, filter
`raw-wiktextract-data.jsonl.gz` from https://kaikki.org/dictionary/rawdata.html
down to lines with `"lang_code": "uk"`; the format is the same.

## Tables

| Table | One row per | Rows (Nov 2026) |
|---|---|---|
| `entries` | dictionary word + part of speech | 46,607 |
| `senses` | English meaning of an entry | 65,108 |
| `forms` | inflected form (declension / conjugation cell) | 573,324 |
| `relations` | other word an entry names: synonym, antonym, derived or related | 87,295 |
| `examples` | Tatoeba sentence with English translation | 26,118 |
| `cloze` | Tatoeba sentence with one noun to fill in after a preposition | 6,965 |
| `search_keys` | normalised lookup key pointing at an entry | 1,774,768 |
| `nonstandard` | Ukrainian word to say instead of a non-standard one (`data/nonstandard.tsv`) | 156 words |

Pages that only say "genitive singular of X" are skipped (26,760), because the
same forms are already in X's own table.

A "form of" page that is a word in its own right is kept (2,555): `більший`
("comparative degree of великий"), `найкращий`, `утворення` ("verbal noun of
утворити"), `окрім` ("alternative form of крім"), `авторка`, `створений`, `ст.`.
Such a page has an inflection table of its own, so its cases are found too
(`більшого`), or it names no cell of another word's table. `is_word_like` in
`import_wiktionary.py` decides; misspellings, affixes and verb spellings without a
table stay skipped. For a kept page:

- the gloss is Wiktionary's, without the romanisation: "comparative degree of
  вели́кий: bigger, larger, greater";
- the label part of the gloss is not searchable in English (`comparative` does not
  list every comparative); a meaning after a colon or in quotation marks is;
- the word it points at is a `related` row on it, and it is one on that word
  when the spelling has exactly one entry (`великий` names `більший`);
- a participle, which Wiktionary files as a verb, gets `adj`, since it declines
  as one and the table shown is chosen by part of speech;
- it owns a spelling only where no ordinary entry does, so frequency counts,
  example sentences and practice sentences of existing entries are unchanged
  (`створений` stays a form of `створити`; `створена` belongs to the page).
`meta.stats` has the numbers as `kept_form_of` and `kept_kinds`.

`data/abbreviations.tsv` holds abbreviations that Wiktionary has no page for
(`км`, `англ.`, `ЗМІ`, 58 rows), written for Nebokrai. `--abbreviations` turns
each into an entry shaped like a kept page ("abbreviation of кіломе́тр
(“kilometre”)", the full word as a related word) with `entries.source` set to
`nebokrai`; every other entry has `wiktionary`. A row whose spelling already has
an entry is skipped (55 were added in November 2026). To add one, add a row and
rebuild. An abbreviation written with a full stop is found without it too:
`ст` finds `ст.`.

## Translation tables

An English Wiktionary entry lists translations of each of its meanings: under
"sheriff" stands шери́ф, under "ashtray" попільни́чка. `extract_translations.py`
pulls the Ukrainian ones out of the English extract, and `--translations` puts
them to two uses.

**Words with no entry of their own get one** (13,015 entries, 14,894 meanings in
November 2026), with `entries.source` set to `wiktionary-translations`. The
tables give the stress, often the gender or aspect, and one meaning per English
word, written `sheriff (all meanings)`: the English word, then the table's note
on which of its meanings is meant. A verb's meaning starts with "to", as
Wiktionary's own do. The word page says above the meanings where they come
from. These entries are thinner than the others:

- They have no inflection table. A form such as `гімназії` is still found when
  VESUM is there, which knows it belongs to гімназія.
- They show the meanings somebody happened to translate, not necessarily the
  main one: мужик stands under "mujik (Russian peasant)" only.
- The part of speech is the English word's, which is nearly always right and
  now and then wrong. Where two tables give a word different genders, it gets
  none.
- They have no frequency rank. Only the dictionary form could be counted, and
  nothing would tell a Ukrainian word from a Russian one spelled the same in
  the subtitle list: он ("yonder") came out as the 39th most common word. They
  follow the ranked words in search results and stay out of the common words,
  the review decks and the word of the day. 788 of them have an example
  sentence.
- Search-as-you-type fills its window from the other entries first, and
  reaches these only when the others leave room: without that, `кал` lost
  календа́р to a hundred rarer words.

**Words that have an entry get more English search keys** (7,731 keys).
комітет is listed under "board (managing committee)", so `board` finds it as a
meaning that mentions the query, after the words whose own entry says "board".
The part of speech must agree, which keeps "voting" (verb) away from
голосування (noun); 792 translations were dropped for that.

Left out:

- anything not written in Ukrainian letters alone (505 translations: whole
  questions, mixed scripts, Russian or Belarusian letters);
- inflected forms of words with entries (зачинений is in the table of
  зачинити), affixes and symbols (717);
- nouns and names of several words (4,621), most of which are ordinary word
  combinations (`соціальна справедливість`). Set phrases of other kinds are
  kept: `про всяк випадок`, "just in case";
- the words in `data/nonstandard.tsv` (174 translations of 156 words in
  November 2026), a hand-written list of words that are not standard
  Ukrainian, most of them Russian words or surzhyk.

## Words that are not standard Ukrainian

`data/nonstandard.tsv` is Nebokrai's own list, one word per row: the spelling,
the part of speech (empty for every one) and, where known, the Ukrainian word
or words to say instead, separated by `|`. Each row does two things:

- `--translations` gives the word no entry, however many tables list it;
- the importer stores the suggestions in the `nonstandard` table, and search
  answers the word with "not standard Ukrainian" and links to them: `криша`
  gives `дах`. VESUM's own suggestions follow (see "VESUM form lookup").

Write a suggestion only where VESUM has none worth linking to, and write it
yourself: VESUM's, dict_uk's and LanguageTool's lists are under other licences
and must not be copied into this file, which goes into `nebokrai.db`.

`check_russianisms.py` lists the candidates for the list; read its report and
copy into `nonstandard.tsv` only what you have checked yourself. The
report draws on VESUM, so it must not be committed or loaded anywhere, and
`--out` refuses a folder git tracks. `--vesum` needs pymorphy3, like
`import_vesum.py`:

    python3 data/check_russianisms.py nebokrai.db --vesum --freq data/raw/uk_full.txt --tatoeba data/raw \
        --out data/raw/russianisms.tsv

A word in the head line of another entry keeps its `head` key beside an entry
from the tables: `походити` finds both its own entry and ходити, which names it.

## Related words

`relations` holds the other words Wiktionary lists on an entry or on one of
its meanings (`sense_n`; empty for the entry as a whole). 23,357 entries name
at least one, counting the rows added both ways.

| Kind | Rows | Entries | Rows whose word has an entry |
|---|---|---|---|
| `synonym` | 32,380 | 14,309 | 26,490 |
| `antonym` | 1,637 | 1,218 | 1,478 |
| `derived` (formed from the word) | 27,222 | 7,207 | 9,202 |
| `related` (same root) | 26,073 | 10,657 | 18,502 |

Three things are done to what Wiktionary gives:

- **Cleaning.** A romanisation in brackets and a gender or aspect mark in
  Latin letters are cut off (`мольфар (molʹfar)`, `не́бо n`). A word is not
  listed under itself, nor twice under one meaning.
- **Stress.** A word written without a stress mark takes the headword's when
  exactly one headword has that spelling: `красивий` becomes `краси́вий` (1,070
  rows).
- **Both ways.** A synonym or an antonym is also stored on the other word's
  side when that spelling has exactly one entry of the same part of speech:
  великий names малий, so малий names великий (9,757 rows, with no meaning
  attached). With two candidates there is no telling which was meant, and
  nothing is added.

Coordinate terms are left out: 532 entries carry about 29,000 of them (every
month under січень, every country under Україна).

Whether the other word has an entry is not stored. The site looks it up when
it draws a page, so the answer cannot go stale.

## Frequency ranking

`entries.freq_rank` is 1 for the most common word. 21,095 entries are ranked;
the entries from translation tables never are.

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

Up to three Tatoeba sentences per entry (11,463 entries), preferring sentences
of about five words. `tatoeba_id` links back to the sentence for attribution.

`tatoeba-corrections.tsv` corrects sentences that read badly, as a teacher
pointed out: Він пише на правильній англійській becomes Він пише правильною
англійською. Each line is a Tatoeba id, the corrected Ukrainian (or `-` to leave
the sentence out), a new English translation or nothing, and who suggested it.
The corrections apply to `examples` and `cloze` alike at every build, and win
over the ratings and the checked fixes below. A corrected sentence has
`adapted = 1`, so its credit says "edited" as CC BY 2.0 FR asks, and
`original` keeps Tatoeba's Ukrainian when the correction changed it, which the
word page shows behind the mark. `add_examples.py` and `add_cloze.py` apply
them to a built database without new entry ids.

Many spellings belong to more than one entry: `осі` is a form of `вісь`
("axis") and of `оса` ("wasp"), `мати` is the noun "mother" and the verb "to
have". `sentence_readings` in `import_wiktionary.py` gives a sentence only to
the entry it is about, and to none when nothing decides:

- a word in lower case is no name, and one with a capital away from the start
  of the sentence is nothing but a name (`ти подобаєшся Тому` is Tom);
- the English translation has a word from one entry's glosses only, the first
  meaning asked first ("on its axis" is `вісь`; `голова` "head" before
  `голова` "chairman");
- the spelling is the dictionary form of one entry, and that entry is the
  commonest of them (`зараз` "now", not a plural of `зараза`; `став` "pond"
  does not take «він став знаменитим», since `стати` is commoner).

Until November 2026 a sentence went to every entry with one of its words as a
form (28,670 sentences for 11,857 entries). Of the 4,111 fewer, most were such
mix-ups (`віна` "dowry" had sentences with `він`); the rest are spellings that
nothing decides, such as the two entries `коса` or `що` the conjunction and the
pronoun. Of 80 decisions on shared spellings read in November 2026, three
were wrong (`Тому`, `став`, `сів`); the rules about capitals and the
commonest entry were added for them, and 40 more read after that were right.

To change the rules without a full build, which would give every entry a new
id:

    python3 data/add_examples.py nebokrai.db data/raw --show оса вісь мати

It makes the table again and prints the sentences of the words named.

### Rated sentences

Tatoeba's quality varies: some sentences are translated from English word by
word, a few use Russian forms (`на протязі`, `прийняв участь`), and a quarter of
the short ones are about Tom or Mary. `data/sentence-ratings.tsv` rates each
sentence for naturalness (1 to 5), everyday use and flags such as `calque` or
`mistranslation`; `docs/sentence-rating.md` has the scale. The file holds
Tatoeba ids and a hash of each text, never the text, so it survives a rebuild
and a rating lapses when Tatoeba edits its sentence.

The build reads it when it is there (`load_ratings`): examples are taken most
natural first, then the commonest, then by length; a rated sentence below 3, or
flagged offensive, mistranslated, a Russianism, a proverb or rejected by a native reviewer,
is never shown; at most one of an entry's examples is about a stock character;
and `cloze` keeps only rated sentences of 4 or more. Sentences not rated yet
count as 3, so a build without the file gives the same examples as before,
apart from the stock-character rule.

`data/rate_sentences.py` makes the file. `check` runs the free checks
(`data/russianisms.tsv`, letters Ukrainian does not use, unknown words) and
spends nothing; `rate` sends 50 sentences at a time through the Claude Code
CLI (`claude -p`), so a Claude subscription does the rating with no API key, and
saves after each request so a run stopped by a usage limit resumes; `submit` and
`collect` do the same through the Message Batches API instead and need
`pip install anthropic` and an API key; `gold-sample` and `gold` compare the
judge with a native speaker. Every run also writes `rating-review.tsv` beside
the downloads, lowest scores first with the judge's rephrasing, for reading.

    python3 data/rate_sentences.py check data/raw --db nebokrai.db
    python3 data/rate_sentences.py rate data/raw --db nebokrai.db --model claude-opus-5-5 --pilot 500
    python3 data/rate_sentences.py rate data/raw --db nebokrai.db --model claude-opus-5-5 --all

The pilot (November 2026, Claude Opus 5.5): 500 sentences in 78 seconds,
three requests at a time; 356 rated 5, 100 rated 4, 31 rated 3, 4 rated 2 and
9 rated 1. The 1s were typos (`зажди`, `Можня`, `ім'єю`), the 2s Russianisms
(`поступити до університету`, `у якості`). 139 were about a stock character.

The sentences the site showed were then rated with Claude Haiku 5.5 through a
prompt tuned against those Opus ratings (`rate --shown`), and replaced in rounds:
rebuild the examples with the ratings, rate the new picks, repeat. Six rounds
took hidden examples from 2,473 to none.

### Corrected sentences

Where a word's only sentences were hidden, its sentences may come back
corrected. `data/sentence-fixes.tsv` holds each correction with the Tatoeba id
and the hash of Tatoeba's text, so a fix lapses when Tatoeba edits the
sentence; each was checked by Claude Opus 5.5 (natural, same meaning as the
English, still holds the word). `short_first` offers a fixed sentence only
after every sentence that needs none, so a fix fills a gap and never displaces
a real one; `examples.original` then keeps Tatoeba's text, and the word page
marks the sentence "edited" and shows the original. Grammar practice never uses
a fixed sentence. November 2026: 621 fixes; 123 more proposed fixes turned out
to be Tatoeba's text unchanged and went back as ordinary rated sentences.

## Sentences with a gap (`cloze`)

The grammar practice (`/practice`) asks for a noun in the case its preposition
takes: `Кава без ___ (цукор)` wants `цукру`. `add_cloze` in
`import_wiktionary.py` finds such sentences among the same Tatoeba pairs, by a
table written by hand (`PREPOSITIONS`): 27 spellings of 24 prepositions, each
with the cases it takes. A grammar point is a preposition and one case,
named `bez-gen`, `na-acc`, `na-loc` and so on.

A sentence is kept only when nothing about the gap is in doubt:

- the word after the preposition is a form of exactly one entry, a noun or a
  name (`п'яти` after `біля` is the numeral, not the heel `п'ята`);
- of the cases the preposition takes, that spelling is only one (`сестри`
  after `у` could be genitive singular or accusative plural, so it is left);
- the noun has more than one spelling (`метро` does not);
- it is written with a capital only if the dictionary's word is (`Томом` is
  the name, which has no entry, not the noun `том`).

At most five sentences are kept for one noun at one point, and a point with
fewer than 20 sentences is dropped. November 2026: 6,965 sentences at 24
points, from 23 (`серед` + genitive) to 1,015 (`у`/`в` + locative); five points fell short
(`крім`, `крізь`, `навколо`, `при`, `замість`). `meta.cloze_points` holds the
count for each point, so the site can draw a sentence by its number (`n`)
without counting.

To change the points or the rules without a full build, which would give
every entry a new id:

    python3 data/add_cloze.py nebokrai.db data/raw --sample 50

It makes the table again and prints 50 sentences to read through. Of 105 read
this way in November 2026, all had the right case; two took a name for a
common noun, which the rule about capitals now leaves out. The point's names
are also listed in `src/lib/practice/points.ts`, and `npm test` fails when the
two lists differ.

## How search works (`search.py`)

1. Exact word, stress and case ignored: `калина`
2. Any inflected form: `книги` finds `книга`, `читаю` finds `читати`
3. Latin letters in the official romanisation: `kalyna`, `khata`
4. English meaning that is exactly the query: `good` finds `добрий`
5. Latin letters, loosely spelled: `kalina`
6. English meaning that mentions the query: `good` also finds `добро`
7. Prefix match, for search-as-you-type; entries from translation tables only
   when the others leave room

Within each step, more common words come first.

An old word, one whose matched meanings are all tagged archaic, obsolete or
dated, comes after the modern words of its step, and an old exact English
meaning after the English mentions: `swedish` gives шве́дський first and the
obsolete све́йський last. The commonness count is of spellings, so an old word
would otherwise borrow the rank of a modern homograph (світ "light" from світ
"world") or of a Russian word (ум). Steps 1 to 3 are left alone: whoever types
свейський or sveiskyi means that word. "historical" does not count as old,
because хрестоно́сець (crusader) is the modern word for a thing of the past.

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

## Words on a head line

An entry's head line names other words (`head_forms`): істори́чний its adverb
істори́чно, впе́рше another spelling упе́рше. Where such a word has no entry
and no table row of its own, `add_head_keys()` gives it a `head` key pointing
at the entry that names it: 9,649 rows. They are added after every entry is
in, so a word with an entry further down the file is found as itself. An
entry from translation tables does not count as such an entry: `походити` has
one and keeps its key to ходити. Search looks them up together with words and
forms, which they never share a spelling with otherwise, and says how
the entry was reached (`through` in `docs/api.md`). They take no part in
frequency counting or example sentences, which go by words and forms only.

## Lenient search ("did you mean")

When a query has no sure match, `lookup()` in `search.py` adds guesses. Four
extra kinds of key in `search_keys` make this possible with plain index
lookups:

| Kind | What it is | Rows |
|---|---|---|
| `latin_form` | an inflected form in Latin letters (`knyhy`) | 322,545 |
| `sound` | the Latin key with sound-alike letters merged (е/и/і, щ/ш) | 46,926 |
| `sound_form` | the same for inflected forms | 290,752 |
| `typo` | every `sound` key with one letter removed | 392,403 |

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
    curl -o data/raw/twisters.lst \
        https://raw.githubusercontent.com/brown-uk/dict_uk/1140395379c34dcc5992df5b6006ed1842355fc7/data/dict/twisters.lst
    python3 data/import_vesum.py vesum.db --twisters data/raw/twisters.lst   # about 80 seconds, 212 MB
    python3 data/search.py nebokrai.db --vesum vesum.db книжечку

`--twisters` is optional; without it there are no suggestions for non-standard
words, only the mark. The link pins the dict_uk commit the site was built from
(9 November 2026).

VESUM lists 393,095 Ukrainian words with 3.7 million forms, but no meanings.
Search uses it only as a fallback: when a Cyrillic query matches nothing in
Wiktionary, VESUM tells us which dictionary word the form belongs to. If
Wiktionary has that word, its entry is shown (`нездійсненними` finds
`нездійсненний`). If not, search returns a bare result marked `vesum_only`
(`книжечку` finds `книжечка`, with no definition).

Three things soften that bare result:

- `vesum_kinds` holds what VESUM says a word is: given name (5,095 words),
  patronymic (1,026), surname (22,632) or abbreviation (1,988). A bare result
  for such a word carries it as `kind`, and the page says "a surname with no
  dictionary entry yet" (`осташка` finds `осташко`).
- `vesum_kinds` also marks 13,172 words `distorted`: not standard Ukrainian.
  A word counts when VESUM tags every one of its forms `Dist` (it also tags
  single wrong forms of ordinary words) or when dict_uk's `twisters.lst` lists
  it. `vesum_suggest` holds what to say instead, from `twisters.lst`, one
  single word per row (13,321 rows for 6,509 words; phrases are left out). A
  bare result for such a word has `kind: "distorted"` and `use`: таможня gives
  ми́тниця, приговор при́суд, вирок and о́суд. `distorted` comes before every
  other kind, so таракан is the Russian word before it is a surname.
- A reflexive verb with no entry leads to the verb it is made from, when that
  one has an entry: `утворюються` finds `утворювати`, marked as reached
  `through` `утворюватися`. This happens while searching; no reflexive verb is
  written into `nebokrai.db`, which would be copying from VESUM.

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
2. Merge that change into `main`, which deploys it, or run `npm run deploy`.
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

## Finding missing words

Two scripts say which words ordinary Ukrainian text uses that the dictionary
has no entry for. The first fetches text, the second counts:

    python3 data/fetch_text.py wiki-titles text/wiki "Хліб" "Міст" "Податок"
    python3 data/fetch_text.py rss text/news https://www.pravda.com.ua/rss/view_news/ --limit 30
    python3 data/missing_words.py nebokrai.db text out

`fetch_text.py` saves one `.txt` per article, in one folder per source, from
Ukrainian Wikipedia (by title, search or category), an RSS feed or plain web
pages. It waits between requests and backs off when a site answers 429.

`missing_words.py` needs `pymorphy3`, like `import_vesum.py`. It looks every
word up as a headword or a listed form, gives the rest their dictionary form
through VESUM, and sorts them: ordinary words by kind (noun, reflexive verb,
verbal noun, participle), given names, surnames, abbreviations, proper nouns
VESUM does not tag, Russian, and spellings nobody recognises. It writes:

| File | What it is |
|---|---|
| `remaining-words.tsv` | every unknown word: category, counts, the spellings met, an example |
| `backlog.tsv` | ordinary words met in three or more texts, the most widespread first: what to define next |
| `stoplist.tsv` | spellings not worth reporting again: names seen once, Russian, fragments |

Pass an earlier run's list back with `--stoplist` and a new pile of text
reports only what is new. `--labels` takes a file that says what the untagged
proper nouns are (place, person, organisation); the script's help has the format.

In November 2026, 616 articles (1.05 million running words) left 124,537
unknown: about two thirds ordinary words, a sixth names, the rest
abbreviations, compounds and noise. The backlog had 4,358 words.

**The output is derived from VESUM** (CC BY-NC-SA 4.0) and from other people's
articles. It is a working list: never commit it, never load it into
`nebokrai.db`. The script refuses an output folder that git tracks.

## Known gaps

- 1,161 nouns, verbs and adjectives from Wiktionary's own pages have no
  inflection table, nor have any of the 13,015 entries from translation tables.
- 18,410 entries have audio.
- Words missing from both Wiktionary's pages and its translation tables (for
  example `почитати`, `походжати`) are found through VESUM but have no
  definition. `книжечка` and `походити` now have one, from the tables.

## Licence

| Source | Licence | What it requires |
|---|---|---|
| English Wiktionary (via kaikki.org) | CC BY-SA 4.0 | credit, and share derived data under the same licence |
| FrequencyWords (OpenSubtitles 2018) | CC BY-SA 4.0 | same |
| Tatoeba | CC BY 2.0 FR | credit Tatoeba, link to the sentence |
| VESUM (separate `vesum.db`) | CC BY-NC-SA 4.0 | credit, non-commercial use only, keep apart from the rows above |
