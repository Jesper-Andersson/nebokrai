# Rate example sentences for naturalness

## At a glance

- **What:** give every Tatoeba sentence we could show a score for how natural and everyday its Ukrainian is, and pick
  examples and cloze sentences by that score instead of by length alone.
- **Why:** `add_tatoeba` takes the shortest sentences first, so quality is whatever Tatoeba has. Many are translated
  from English word by word, and a quarter of the short ones are about Tom or Mary.
- **Files:** a new `data/rate_sentences.py`, a tracked `data/sentence-ratings.tsv`, and the selection in
  `add_tatoeba` and `add_cloze` (`data/import_wiktionary.py`). No change to search, the API shape or the site.

## Decisions

All five accepted as proposed (user, 2026-11-16).

- **D1. Scores live in a tracked TSV** (`data/sentence-ratings.tsv`), keyed by Tatoeba id and a hash of the text.
  - It survives a rebuild of `nebokrai.db`, costs nothing to re-read, and holds no sentence text.
  - Alternative: a `ratings.db` beside the others (untracked, so lost with the machine).
- **D2. An LLM judge does the bulk rating** (Claude, batch API), checked against a small native-speaker gold set.
  - Alternative: heuristics only. Cheaper, but they cannot hear a calque.
- **D3. Rate only what could be shown:** the 167,169 sentences of 3 to 12 words that have an English translation
  (of 182,711 pairs). Today 19,637 of them are in use.
- **D4. Below 3 is never shown;** 3 is shown only when an entry has nothing better.
- **D5. VESUM is not used for scoring.** A score derived from it would carry VESUM's licence into the TSV.

## The scale

Two separate judgements, because a sentence can be perfect Ukrainian and still useless to a learner.

**Naturalness** (would a native speaker say or write this, in these words?)

| Score | Meaning | Example |
|---|---|---|
| 5 | Exactly what a native would say | Поквапся, бо спізнишся на останній потяг. |
| 4 | Natural, maybe a little bookish or stiff | Я не потребую вашого захисту. |
| 3 | Correct, but a native would phrase it differently | Чесно кажучи, ти дратівлива. |
| 2 | Calque, Russianism or surzhyk; understandable | З поетів не виходять дуже добрі коректори. |
| 1 | Ungrammatical, misspelt or nonsense | (none yet; take one from the pilot) |

**Everyday use** (how likely a learner is to meet or need this): `common`, `neutral`, `rare` (proverb, technical,
literary, odd situation).

**Flags**, any number of them, each one word:

- `calque`: built on English or Russian word order or idiom.
- `russianism`: a Russian word or form (на протязі, приймати участь, являтися for "to be"). Never shown, whatever
  the score (user, 2026-11-16): a learner copies the whole sentence.
- `error`: spelling, agreement, case or punctuation mistake.
- `mistranslation`: the English says something else (Ворог установив маріонетковий режим у ляльковому театрі /
  "The enemy established a puppet state in Dogestan").
- `offensive`: slurs, crude sexual content, cruelty. Never shown, whatever the score.
- `proverb`: an idiom whose English is an equivalent, not a translation (Хороший товар сам себе хвалить /
  "Good wine needs no bush"). Kept out of examples and cloze: the English translates none of its words.
- `rejected` (set by the script, not the judge): a native speaker reviewed it -1 on Tatoeba. Never shown.
- `names`: the sentence is about Tom, Mary or another Tatoeba stock character. Not a fault; used to keep variety.
- `fragment`: not a whole sentence, or two run together.

## 1. Free signals from Tatoeba

Tatoeba's weekly export has more than the three files we read. These cost nothing and come first.

1.1 Download `sentences_detailed`, `sentences_base`, `users_sentences` and `user_languages` once per rebuild.
  - Check each file's columns against the live export before relying on them; record them in `data/README.md`.
1.2 Owner's level in Ukrainian (`user_languages`, 0 to 5): a sentence by a level-5 speaker is a strong prior.
1.3 Original or translated (`sentences_base`): a Ukrainian sentence translated from English is likelier a calque.
1.4 Reviews (`users_sentences`: -1, 0, +1). Any -1 from a native speaker drops the sentence outright.
1.5 Keep these as columns in the TSV; they are inputs, not the score.

## 2. Cheap text checks

2.1 A short list of Russianisms and calques in `data/russianisms.tsv` (wrong form, right form, source):
  на протязі → протягом, приймати участь → брати участь, являється → є, слідуючий → наступний.
2.2 Letters that are not Ukrainian (ы, э, ъ, ё) mean `error` or Russian text.
2.3 Words absent from every form in `nebokrai.db` (after `plain()`) are counted; three or more is a warning.
  - Two was noise: comparatives (голосніший) and short words (зі) are missing from the forms.
2.4 These set flags; they never set the naturalness score on their own.

## 3. The judge

3.1 `data/rate_sentences.py` sends sentences in batches of about 50, each with its English and its Tatoeba signals.
3.2 The prompt holds the scale above, the flag list and the worked examples in this spec (more added from the
  gold set); the reply is JSON per sentence: `{id, natural, use, flags, better}`.
  - `better` is an optional native rephrasing. It is kept for review only and never shown (it is not Tatoeba's).
3.3 Each row records the model id and a `rubric` version; a rubric change re-rates everything, a new sentence
  only itself (matched by text hash, so an edited Tatoeba sentence is rated again).
3.4 `rate` sends each request through the Claude Code CLI (`claude -p`), so a subscription does the work with no
  API key; `submit`/`collect` use the Batches API with `ANTHROPIC_API_KEY` from `.env` instead.
3.5 Run a pilot of 500 sentences first and report the cost before rating the rest.

## 4. Calibration

4.1 A gold set of 300 sentences, drawn evenly across Tatoeba-owner levels and lengths, rated by one or two native
  speakers in a plain spreadsheet (score, use, flags).
4.2 The judge passes when it is within one point of the human on 90 % of the gold set and agrees on `offensive`
  and `mistranslation` every time. Otherwise change the prompt and re-run the gold set only.
4.3 Every report from `/report` about an example adds that sentence to the gold set.

## 5. Choosing examples with the score

5.1 `add_tatoeba` orders candidates by naturalness, then everyday use, then the current length rule, instead of
  length alone; still up to three per entry.
5.2 At most one of an entry's three examples may be about a stock character: the `names` flag, or a regex on
  Том, Мері, Джон, Аліса, so the rule works before rating too.
5.3 `add_cloze` drops rated sentences below 4; unrated ones still pass, or cloze would be empty until rated.
5.4 A sentence with no rating yet is treated as 3, so a rebuild before rating still works.
5.5 The build prints `rated_sentences`. Not done yet: entries that lost or gained an example, mean score shown.

## 6. Licences

6.1 Scores and flags are our own data about Tatoeba sentences (CC BY 2.0 FR); the TSV holds ids, not text.
6.2 Add a line to `docs/sources-and-licences.md` saying examples are filtered by an automated rating.

## 7. Replacing and fixing hidden sentences (user, 2026-11-16)

7.1 Replace first: rebuild examples with the ratings, rate the new picks, repeat until every shown sentence is
  rated. Real Tatoeba sentences, almost free.
7.2 Fix only the leftovers: words still short of examples get the judge's rewording of their hidden sentence,
  kept only when Opus confirms it is natural, means what the English says, and still holds the word.
7.3 A fixed sentence is our edit of a CC BY sentence: the site must mark it as edited and still credit the
  original on Tatoeba, and `docs/sources-and-licences.md` must stop saying sentences are shown unchanged.
7.4 Every fix checked against dictionaries (user, 2026-11-17), because a pilot of 20 found only 5 real mistakes:
  Горох, slovnyk.ua and VESUM, and the 180 meaning fixes against their English; verdicts in
  `data/sentence-fix-checks.tsv`. 241 of 570 were unneeded (97 a fair translation already, 62 style, 39 refuted
  by a dictionary entry, 34 grammar both ways right, 9 typography only); those show Tatoeba's text again.
  325 needed, 4 unsure. The verdicts beyond a dictionary entry are still a model's judgement; a native speaker
  has not read them.

## 8. Follow-up: send fixes back to Tatoeba (to figure out)

The best fix costs nothing and helps everyone: the sentence corrected on Tatoeba itself, picked up by the next
import. Open questions:

- Whether Tatoeba has any write API, or only its website (its public API looked read-only; unverified).
- Who may change a sentence: normally its owner. For someone else's, the usual route is a comment on the sentence
  or a correction proposed to its owner; orphaned sentences can be adopted. Check Tatoeba's current guidelines.
- Whether a list of suggestions (id, current text, proposed text, reason) is welcome by the Ukrainian
  contributors or Tatoeba's admins, and in what form. Contact them before sending anything in bulk.
- Suggestions must come from checked fixes only (7.2), never straight from the rating run.

## Verification

- [x] `python3 data/rate_sentences.py check data/raw --db nebokrai.db` runs without the API (2026-11-16: 84
  possible Russianisms, 11 sentences typed with Russian letters, such as хотыв and маэ).
- [x] `add_examples.py` on a copy of the database, before any rating: 10,365 entries keep examples; sentences about
  a stock character fall from 3,571 to 2,721; examples from 24,559 to 24,308; cloze unchanged at 7,845.
- [x] `rate --pilot 500` (2026-11-16, Opus 5.5 through `claude -p`): 500 rows in 78 s; scores 5: 356, 4: 100,
  3: 31, 2: 4, 1: 9; API price equivalent $0.90, so about $300 and 7 h for all 167,000.
- [x] Haiku tuned against 1,093 Opus ratings (550 random, 543 picked by the free checks as likely bad), even ids to
  tune and odd ids to test. "Caught" = Haiku also hides what Opus would hide. Held-out half, Latin-i cases aside:
  plain prompt 70 % caught, 3 % of good ones hidden; checklist, score written last and flagged error or
  russianism capped at 2: 85 % caught, 5 % hidden. High effort and 10 per request did not help.
  - The uploader's declared level predicts nothing: sentences by level-5 users were rated no better.
  - 240 sentences have a Latin i (or o, a…) inside a Cyrillic word (Вiн): they look right but break word matching.
- [ ] `rate --all`, in the background, resuming after usage limits.
- [ ] The gold-set comparison prints agreement of 90 % or more within one point.
- [ ] A rebuild prints the old and new example counts; no entry's examples include an `offensive` sentence.
- [ ] `sqlite3 nebokrai.db "SELECT uk FROM examples ORDER BY random() LIMIT 30"` reads well to a native speaker.
- [ ] `npm test` passes with no skips (search is untouched, but the word-details tests read examples).
- [ ] `npm run check` ends with `0 ERRORS 0 WARNINGS`.
