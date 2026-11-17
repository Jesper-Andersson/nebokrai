#!/usr/bin/env python3
"""Build the Nebokrai dictionary database from the kaikki.org Ukrainian extract.

Usage:
    python3 import_wiktionary.py raw/uk.jsonl nebokrai.db [--freq FILE] [--tatoeba DIR]
        [--abbreviations FILE] [--translations FILE]

    --freq FILE           word frequency list, one "word count" per line
                          (FrequencyWords uk_full.txt, built from film subtitles)
    --tatoeba DIR         folder holding ukr_sentences.tsv.bz2, ukr-eng_links.tsv.bz2
                          and eng_sentences.tsv.bz2 from downloads.tatoeba.org
    --abbreviations FILE  abbreviations.tsv, Nebokrai's own entries
    --translations FILE   the Ukrainian translations from English Wiktionary's
                          translation tables, as extract_translations.py writes them

Input:  kaikki.org-dictionary-Ukrainian.jsonl (English Wiktionary, CC BY-SA)
Output: a SQLite database with seven tables:

    entries      one row per dictionary word (lemma) and part of speech
    senses       the English meanings of an entry
    forms        every inflected form of an entry (declension / conjugation)
    relations    the other words an entry names: synonyms, antonyms, derived
                 and related words
    search_keys  normalised lookup keys pointing at entries
    examples     example sentences with translations (from Tatoeba)
    cloze        Tatoeba sentences with one noun to fill in after a
                 preposition, for grammar practice

Only the Python standard library is used.
"""
import bz2
import collections
import hashlib
import json
import os
import random
import re
import sqlite3
import sys
import unicodedata

STRESS = "́"

SCHEMA = """
CREATE TABLE entries (
    id          INTEGER PRIMARY KEY,
    word        TEXT NOT NULL,      -- plain spelling, no stress mark: калина
    headword    TEXT NOT NULL,      -- with stress mark: кали́на
    pos         TEXT NOT NULL,      -- noun, verb, adj, ...
    tags        TEXT NOT NULL,      -- JSON list: ["feminine","inanimate"]
    head_forms  TEXT NOT NULL,      -- JSON list of key forms shown next to the headword
    roman       TEXT,               -- Wiktionary romanisation: kalýna
    ipa         TEXT,
    audio_url   TEXT,
    etymology   TEXT,
    freq        REAL NOT NULL DEFAULT 0,  -- occurrences per million words, all forms together
    freq_rank   INTEGER,                  -- 1 = most common word; NULL = not seen in the corpus
    offensive   INTEGER,                  -- 1 = marked highly offensive (marked-offensive.tsv); NULL = not
    -- wiktionary, or nebokrai for an entry written for this dictionary (abbreviations.tsv). No DEFAULT:
    -- export_sql.py cannot carry a quoted value in a CREATE statement to D1.
    source      TEXT NOT NULL
);
CREATE TABLE senses (
    id        INTEGER PRIMARY KEY,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    n         INTEGER NOT NULL,     -- order within the entry, from 1
    gloss     TEXT NOT NULL,
    tags      TEXT NOT NULL,        -- JSON list: ["uncountable"]
    examples  TEXT NOT NULL         -- JSON list of {"text","english"}
);
CREATE TABLE forms (
    id        INTEGER PRIMARY KEY,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    form      TEXT NOT NULL,        -- with stress: кали́ни
    plain     TEXT NOT NULL,        -- without stress, lowercase: калини
    tags      TEXT NOT NULL         -- JSON list: ["genitive","singular"]
);
CREATE TABLE relations (
    id        INTEGER PRIMARY KEY,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    sense_n   INTEGER,              -- the meaning it belongs to (senses.n); NULL = the whole entry
    kind      TEXT NOT NULL,        -- synonym | antonym | derived | related
    word      TEXT NOT NULL,        -- the other word, with stress where it is known: мали́й
    plain     TEXT NOT NULL,        -- its lookup form: малий
    tags      TEXT NOT NULL         -- JSON list: ["colloquial"]
);
CREATE TABLE examples (
    id          INTEGER PRIMARY KEY,
    entry_id    INTEGER NOT NULL REFERENCES entries(id),
    uk          TEXT NOT NULL,
    en          TEXT NOT NULL,
    tatoeba_id  INTEGER NOT NULL,     -- https://tatoeba.org/sentences/show/<id>, for attribution
    adapted     INTEGER NOT NULL DEFAULT 0, -- 1 when a correction changed the sentence or its English
    original    TEXT                  -- Tatoeba's Ukrainian when a correction changed it, else NULL
);
CREATE TABLE search_keys (
    key       TEXT NOT NULL,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    kind      TEXT NOT NULL         -- word | form | head | latin | latin_form | english | sound | sound_form | typo
);
-- Spellings that are not standard Ukrainian, from data/nonstandard.tsv, and what to say instead.
-- Written for Nebokrai, so it may live here; VESUM's own suggestions stay in vesum.db.
CREATE TABLE nonstandard (
    word  TEXT NOT NULL,            -- plain spelling: криша
    n     INTEGER NOT NULL,         -- order of the suggestion from 1; 0 = nothing to suggest
    use   TEXT NOT NULL,            -- plain Ukrainian word: дах ('' when n = 0)
    PRIMARY KEY (word, n)
);
"""

# Kept apart from SCHEMA so that add_cloze.py can make this one table again
# in a database already built, without giving every entry a new id.
CLOZE_SCHEMA = """
CREATE TABLE cloze (
    id          INTEGER PRIMARY KEY,
    point       TEXT NOT NULL,      -- the grammar point practised: bez-gen (без + genitive)
    n           INTEGER NOT NULL,   -- 0, 1, 2, ... within the point, so that one can be drawn at random
    entry_id    INTEGER NOT NULL REFERENCES entries(id),  -- the noun to fill in
    uk          TEXT NOT NULL,      -- the whole sentence: Кава без цукру.
    en          TEXT NOT NULL,
    start       INTEGER NOT NULL,   -- where the noun begins in `uk`, counted in characters
    length      INTEGER NOT NULL,
    form        TEXT NOT NULL,      -- the noun as it stands there, with stress: цу́кру
    number      TEXT NOT NULL,      -- singular | plural
    tatoeba_id  INTEGER NOT NULL,   -- https://tatoeba.org/sentences/show/<id>, for attribution; 0 for a
                                    -- sentence made from a frame (Я дякую мамі.), which has no author
    adapted     INTEGER NOT NULL DEFAULT 0,  -- 1 when data/tatoeba-corrections.tsv changed the sentence
    cue_start   INTEGER,            -- where the verb that asks for the case begins (дякую), for a
    cue_length  INTEGER             -- government point (add_government); NULL for a preposition's
);
CREATE UNIQUE INDEX cloze_point ON cloze(point, n);
"""

INDEXES = """
CREATE INDEX entries_word ON entries(word);
CREATE INDEX senses_entry ON senses(entry_id, n);
CREATE INDEX forms_entry ON forms(entry_id);
CREATE INDEX forms_plain ON forms(plain);
CREATE INDEX relations_entry ON relations(entry_id);
CREATE INDEX search_key ON search_keys(key, kind);
-- suggest() asks for the sound key of each typo guess by entry; without this
-- index that reads all 1.5 million keys, 540 million rows on 2026-11-15.
CREATE INDEX search_keys_entry ON search_keys(entry_id, kind);
CREATE INDEX examples_entry ON examples(entry_id);
CREATE INDEX entries_rank ON entries(freq_rank);
"""

# Ukrainian national transliteration (Cabinet of Ministers resolution 55, 2010).
# Each letter maps to (word-initial, elsewhere).
NATIONAL = {
    "а": ("a", "a"), "б": ("b", "b"), "в": ("v", "v"), "г": ("h", "h"),
    "ґ": ("g", "g"), "д": ("d", "d"), "е": ("e", "e"), "є": ("ye", "ie"),
    "ж": ("zh", "zh"), "з": ("z", "z"), "и": ("y", "y"), "і": ("i", "i"),
    "ї": ("yi", "i"), "й": ("y", "i"), "к": ("k", "k"), "л": ("l", "l"),
    "м": ("m", "m"), "н": ("n", "n"), "о": ("o", "o"), "п": ("p", "p"),
    "р": ("r", "r"), "с": ("s", "s"), "т": ("t", "t"), "у": ("u", "u"),
    "ф": ("f", "f"), "х": ("kh", "kh"), "ц": ("ts", "ts"), "ч": ("ch", "ch"),
    "ш": ("sh", "sh"), "щ": ("shch", "shch"), "ю": ("yu", "iu"),
    "я": ("ya", "ia"), "ь": ("", ""), "'": ("", ""), "’": ("", ""), "ʼ": ("", ""),
}


def strip_stress(text):
    """Remove the acute stress mark but keep й and ї intact."""
    return unicodedata.normalize("NFC", text).replace(STRESS, "")


# Characters people and dictionaries use for the Ukrainian apostrophe (п'ять):
# typewriter ', curly ‘ ’, modifier letter ʼ, and the backtick ` and acute ´
# that turn up in quick typing.
APOSTROPHES = re.compile("['‘’ʼ`´]")


def plain(text):
    """Lookup form of a Ukrainian word: no stress, lowercase, one apostrophe style."""
    text = strip_stress(text).lower()
    return APOSTROPHES.sub("'", text)


def national_translit(word):
    """калина -> kalyna (official Ukrainian romanisation)."""
    out = []
    start = True
    for ch in plain(word):
        pair = NATIONAL.get(ch)
        if pair is None:
            out.append(ch)
            start = not ch.isalpha()
            continue
        out.append(pair[0] if start else pair[1])
        start = False
    return "".join(out)


def loose_latin(text):
    """Collapse Latin spelling variants so that different romanisation habits meet.

    kalyna, kalina and kalýna all become "kalina"; khata, xata -> "hata".
    The same function is applied to the stored key and to what the user types.
    """
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z]", "", text)
    for old, new in (
        ("shch", "sc"), ("sch", "sc"), ("šč", "sc"),
        ("kh", "h"), ("ch", "c"), ("zh", "z"), ("sh", "s"), ("ts", "c"),
        ("x", "h"), ("g", "h"), ("w", "v"), ("j", "i"), ("y", "i"),
    ):
        text = text.replace(old, new)
    return re.sub(r"(.)\1+", r"\1", text)  # collapse doubled letters


def sound_key(loose):
    """Collapse a loose Latin key further, merging sounds learners mix up.

    е/и/і all become "i" and щ joins ш, so превіт meets привіт, shastya meets
    щастя and kiev meets Київ. Input is the output of loose_latin().
    """
    text = loose.replace("e", "i").replace("sc", "s")
    return re.sub(r"(.)\1+", r"\1", text)


def deletes(key):
    """Every way of removing one letter. Two keys within one typo of each other
    (a wrong, missing, extra or swapped letter) always share one of these, or
    one contains the other, which is what lets an ordinary index find typos."""
    return {key[:i] + key[i + 1:] for i in range(len(key))}


TYPO_MIN = 4  # shorter keys are one typo away from far too many words

# What the keys of a Latin (QWERTY) keyboard type on the Ukrainian layout, for
# people who forgot to switch: "ghbdsn" -> "привіт".
KEYBOARD = str.maketrans(
    "qwertyuiop[]asdfghjkl;'zxcvbnm,.`\\",
    "йцукенгшщзхїфівапролджєячсмитьбю'ґ")

# Letters from a Russian keyboard and their nearest Ukrainian spelling.
RUSSIAN_LETTERS = {"ы": "и", "э": "е", "ё": "йо", "ъ": "'"}


def from_russian_letters(text):
    return "".join(RUSSIAN_LETTERS.get(ch, ch) for ch in text)


def edits_apart(a, b):
    """True if a and b differ by at most one typo: one letter wrong, missing,
    extra, or two neighbours swapped."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    if len(a) == len(b):
        return a[i + 1:] == b[i + 1:] or (a[i:i + 2] == b[i:i + 2][::-1] and a[i + 2:] == b[i + 2:])
    longer, shorter = (a, b) if len(a) > len(b) else (b, a)
    return longer[i + 1:] == shorter[i:]


def is_form_of(entry):
    """True for pages that only say 'genitive singular of X'."""
    senses = entry.get("senses") or []
    return bool(senses) and all("form_of" in s or "alt_of" in s for s in senses)


# Tags that say a "form of" page names one cell of another word's table:
# "genitive singular of калина". Gender is not among them: авторка is the
# female equivalent of автор and a word of its own.
INFLECTION_TAGS = {"nominative", "genitive", "dative", "accusative", "instrumental", "locative", "vocative",
                   "singular", "plural", "first-person", "second-person", "third-person",
                   "present", "past", "future", "imperative", "infinitive", "participle", "adverbial",
                   "short-form"}  # not "impersonal": немає is impersonal and no cell of a table


def is_word_like(entry):
    """True for a "form of" page that is a word in its own right and is kept:
    більший (comparative degree of великий), утворення (verbal noun of
    утворити), окрім (alternative form of крім), авторка, створений.

    Such a page either has an inflection table of its own, so its cases can be
    found (більшого), or names no cell of anybody's table. A verb without a
    table is a stray spelling (ходить for ходити), and affixes are not
    vocabulary; both stay skipped.
    """
    if entry.get("pos") in NOT_VOCABULARY:
        return False
    # A misspelling as an entry would be offered as a correction: "did you
    # mean будь-ласка?" for будьласка, when будь ласка is what is meant.
    if any({"misspelling", "misconstruction"} & set(s.get("tags") or []) for s in entry.get("senses") or []):
        return False
    if any(f.get("source") in ("declension", "conjugation") for f in entry.get("forms") or []):
        return True
    if entry.get("pos") == "verb" and any("form_of" in s for s in entry.get("senses") or []):
        return False  # немає, an alternative form of нема, is no such stray and is kept
    return not any(INFLECTION_TAGS & set(s.get("tags") or []) for s in entry.get("senses") or [])


# "comparative degree of вели́кий (velýkyj)": the romanisation after the word
# the page points at says nothing a reader of Cyrillic needs.
# Where a meaning follows it, "напри́клад (naprýklad, “for example”)", the
# meaning stays: "напри́клад (“for example”)". A gender or aspect mark may
# stand between the two: "постели́ти pf (postelýty)".
GLOSS_ROMAN = re.compile(r"(?<=[Ѐ-ӿ́])((?: (?:m|f|n|pl|pf|impf))?) "
                         r"\([A-Za-zÀ-ſʹʺ' -]+(\)|, )")


def without_roman(gloss):
    return GLOSS_ROMAN.sub(lambda m: m.group(1) + ("" if m.group(2) == ")" else " ("), gloss)


def form_of_kind(gloss):
    """What a kept page says it is: 'comparative degree', 'verbal noun'."""
    found = re.match(r"(.+?) of\b", gloss.lower())
    return found.group(1) if found else "other"


def word_keys(word, roman=None):
    """The search keys of a dictionary word, apart from its forms and meanings."""
    keys = {(plain(word), "word")}
    # An abbreviation is typed with and without its full stop: ст for ст.
    if word.endswith(".") and plain(word).rstrip(". "):
        keys.add((plain(word).rstrip(". "), "word"))
    keys.add((loose_latin(national_translit(word)), "latin"))
    if roman:
        keys.add((loose_latin(roman), "latin"))
    # Looser keys for "did you mean": sounds-alike, and one typo away.
    for k, kind in list(keys):
        if kind == "latin" and k:
            sk = sound_key(k)
            keys.add((sk, "sound"))
            if len(sk) >= TYPO_MIN:
                keys.update((d, "typo") for d in deletes(sk))
    return keys


def add_abbreviations(db, path):
    """Entries for the abbreviations in abbreviations.tsv, which Wiktionary has
    no page for: км, англ., ЗМІ. They are shaped like the kept "form of" pages,
    "abbreviation of кіломе́тр (“kilometre”)" with the full word as a related
    word, and marked as Nebokrai's own. A spelling that already has an entry is
    left alone. Returns the (entry id, full word) pairs for `link_kept_pages`.
    """
    links, added = [], 0
    with open(path, encoding="utf-8") as rows:
        for line in rows:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            word, pos, kind, full, english = (cell.strip() for cell in line.split("\t"))
            if db.execute("SELECT 1 FROM search_keys WHERE key=? AND kind='word'", (plain(word),)).fetchone():
                continue
            eid = db.execute(
                "INSERT INTO entries(word, headword, pos, tags, head_forms, source) VALUES (?,?,?,'[]','[]','nebokrai')",
                (word, word, pos)).lastrowid
            # The full word takes its stress from the dictionary, where it is there.
            found = db.execute("SELECT headword FROM entries WHERE word=?", (full,)).fetchall()
            shown = found[0][0] if len(found) == 1 else full
            db.execute("INSERT INTO senses(entry_id, n, gloss, tags, examples) VALUES (?,1,?,?,'[]')",
                       (eid, f"{kind} of {shown} (“{english}”)", json.dumps([kind, "alt-of"])))
            db.execute("INSERT INTO relations(entry_id, sense_n, kind, word, plain, tags) VALUES (?,1,'related',?,?,'[]')",
                       (eid, shown, plain(full)))
            keys = word_keys(word)
            keys.update((w, "english") for w in re.findall(r"[a-z]+(?:[-'][a-z]+)*", english.lower()) if len(w) > 1)
            db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)",
                           [(k, eid, kind_) for k, kind_ in keys if k])
            links.append((eid, plain(full)))
            added += 1
    return links, added


ENGLISH_WORD = re.compile(r"[a-z]+(?:[-'][a-z]+)*")
# A translation written in the letters of the Ukrainian alphabet and nothing
# else. The tables also hold whole questions ("як тебе́ зову́ть?"), notes,
# mixed scripts, and now and then a word in Russian or Belarusian letters
# (ы, э, ў), which the site's list of words by letter has no place for.
UKRAINIAN_ONLY = re.compile("[а-щьюяєіїґА-ЩЬЮЯЄІЇҐ́'’ʼ -]+")
# The `source` of an entry made from translation tables, not from a page of the
# word's own. The word page says so above its meanings.
FROM_TRANSLATIONS = "wiktionary-translations"
# What a translation says about the word itself. Anything else among its tags
# ("usually", "also") is left out. A gender is kept for a noun only and an
# aspect for a verb only: the tables also put "masculine" on adjectives, which
# have every gender.
GRAMMAR_TAGS = {
    "noun": {"masculine", "feminine", "neuter", "animate", "inanimate", "plural"},
    "name": {"masculine", "feminine", "neuter", "animate", "inanimate", "plural"},
    "verb": {"imperfective", "perfective"},
}
GENDERS = {"masculine", "feminine", "neuter"}
# English verbs that take no "to": повинно is "should", not "to should"
NO_TO = {"can", "could", "may", "might", "must", "ought", "shall", "should", "will", "would"}
# A translation's remarks on usage, kept on the meaning as Wiktionary's own are.
USAGE_TAGS = {"rare", "colloquial", "dated", "informal", "dialectal", "formal", "slang", "vulgar",
              "poetic", "obsolete", "archaic", "historical", "regional", "neologism", "derogatory",
              "nonstandard", "literary", "diminutive", "collective"}
# Words a person has read and found not to be standard Ukrainian, most of them
# Russian words or surzhyk (check_russianisms.py lists the candidates), with
# the Ukrainian word to say instead where one is known. Written by hand.
NONSTANDARD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nonstandard.tsv")


def nonstandard(path=NONSTANDARD):
    """The rows of nonstandard.tsv: [(plain spelling, part of speech or None,
    [Ukrainian words])]. A row with no part of speech holds for every one."""
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, encoding="utf-8") as lines:
        for line in lines:
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            cells = [c.strip() for c in line.split("\t")] + ["", ""]
            use = [w.strip() for w in cells[2].split("|") if w.strip()]
            rows.append((plain(cells[0]), cells[1] or None, use))
    return rows


def add_nonstandard(db, rows):
    """Store what search says instead of a non-standard word: криша -> дах.
    One row per suggested word, in the file's order; a word with nothing to
    suggest gets a row with n = 0 and no word, so search still knows it."""
    seen, out = set(), []
    for word, _, use in rows:
        if word in seen:
            continue
        seen.add(word)
        out += [(word, n, plain(u)) for n, u in enumerate(use, 1)] or [(word, 0, "")]
    db.executemany("INSERT INTO nonstandard(word, n, use) VALUES (?,?,?)", out)
    return len(seen)


def add_translations(db, path, skip: "set | frozenset" = frozenset()):
    """Use the Ukrainian translations listed on English Wiktionary's entries
    (data/extract_translations.py writes the file).

    Under "ashtray" the English Wiktionary gives попільни́чка, a word with no
    entry of its own. Such a word gets an entry made of what the tables say:
    its stress, its gender or aspect, and one meaning per English word,
    "ashtray (receptacle for ashes)". Its `source` is FROM_TRANSLATIONS,
    because it is thinner than a real entry: it has no table of forms, and it
    shows the meanings somebody happened to translate, which need not include
    the main one. Such an entry gets no frequency rank either (add_frequency).

    For a word that has an entry, the tables only add English search keys:
    комітет is listed under "board (managing committee)", so "board" finds it,
    after the words whose own entry says "board". The part of speech must
    agree, which keeps "voting" (verb) away from голосування (noun).

    Left out: anything not written in Ukrainian letters alone, inflected forms
    of words that have entries (зачинений is in the table of зачинити),
    affixes, the words in `skip` (nonstandard.tsv), and nouns and names of several words, most
    of which are ordinary word combinations (соціа́льна справедли́вість, "social
    justice") rather than dictionary words. Set phrases of other kinds are
    kept: про вся́к ви́падок, "just in case".
    """
    have = collections.defaultdict(list)   # plain spelling -> (id, pos) of its entries
    for eid, word, pos in db.execute("SELECT id, word, pos FROM entries"):
        have[plain(word)].append((eid, pos))
    forms = {key for (key,) in db.execute("SELECT DISTINCT key FROM search_keys WHERE kind='form'")}
    english = set(db.execute("SELECT entry_id, key FROM search_keys WHERE kind='english'"))

    stats = collections.Counter(translations=0, translations_not_ukrainian=0, translations_left_out=0,
                                translations_noun_phrases=0, translations_turned_down=0,
                                translations_other_pos=0)
    more_keys = []
    new = collections.defaultdict(list)    # (plain spelling, pos) -> its translations
    for line in open(path, encoding="utf-8"):
        t = json.loads(line)
        stats["translations"] += 1
        uk = unicodedata.normalize("NFC", t["uk"].strip())
        key, pos = plain(uk), t.get("pos") or ""
        # Starting with a letter: "’наєш" (y'know) is in the tables too
        if not UKRAINIAN_ONLY.fullmatch(uk) or not uk[0].isalpha():
            stats["translations_not_ukrainian"] += 1
            continue
        if (key, None) in skip or (key, pos) in skip:
            stats["translations_turned_down"] += 1
            continue
        if key in have:
            agrees = [eid for eid, entry_pos in have[key] if entry_pos == pos]
            if not agrees:
                stats["translations_other_pos"] += 1
            for eid in agrees:
                for w in set(ENGLISH_WORD.findall(t["en"].lower())):
                    if len(w) > 1 and (eid, w) not in english:
                        english.add((eid, w))
                        more_keys.append((w, eid, "english"))
            continue
        if key in forms or pos in NOT_VOCABULARY or key.startswith("-") or key.endswith("-"):
            stats["translations_left_out"] += 1
            continue
        if pos in ("noun", "name") and " " in key.strip():
            stats["translations_noun_phrases"] += 1
            continue
        # One Ukrainian word for an English phrase is most often an adverb:
        # напа́м'ять for "by heart", гла́дко for "without a hitch"
        if pos == "prep_phrase" and " " not in key:
            pos = "adv"
        new[(key, pos)].append((uk, t))
    db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)", more_keys)
    stats["english_keys_from_translations"] = len(more_keys)

    stats["entries_from_translations"] = stats["senses_from_translations"] = 0
    for (key, pos), rows in sorted(new.items()):
        # The stressed spelling, and among those the one most tables use
        spellings = collections.Counter(uk for uk, _ in rows)
        headword = max(spellings, key=lambda s: (STRESS in s, spellings[s]))
        word = strip_stress(headword)
        roman = next((t["roman"] for uk, t in rows if uk == headword and t.get("roman")), None)
        tags = {tag for _, t in rows for tag in t.get("tags") or [] if tag in GRAMMAR_TAGS.get(pos, ())}
        # Two tables that disagree on the gender (відкрива́чка, feminine and
        # masculine) say nothing sure about it. Both aspects together are a
        # real answer: such a verb is both.
        if len(tags & GENDERS) > 1:
            tags -= GENDERS
        tags = sorted(tags)
        eid = db.execute(
            "INSERT INTO entries(word, headword, pos, tags, head_forms, roman, source) VALUES (?,?,?,?,'[]',?,?)",
            (word, headword, pos, json.dumps(tags, ensure_ascii=False), roman, FROM_TRANSLATIONS)).lastrowid
        stats["entries_from_translations"] += 1

        keys = word_keys(word, roman)
        glosses = {}                       # gloss -> its remarks on usage, in the order of the file
        for _, t in rows:
            english_word = t["en"].strip()
            # Wiktionary's verbs are "to read"; the tables list them under "read"
            gloss = english_word
            if pos == "verb" and not gloss.startswith("to ") and gloss not in NO_TO:
                gloss = "to " + gloss
            said = [p for p in (t.get("sense"), t.get("note")) if p and p != "Translations"
                    and p.lower() != english_word.lower()]
            if said:
                gloss += f" ({'; '.join(said)})"
            glosses.setdefault(gloss, set()).update(tag for tag in t.get("tags") or [] if tag in USAGE_TAGS)
            # The English word alone: the words that explain which "board" is
            # meant ("managing committee") are not meanings of the Ukrainian
            keys.update((w, "english") for w in ENGLISH_WORD.findall(english_word.lower()) if len(w) > 1)
        for n, (gloss, usage) in enumerate(glosses.items(), 1):
            db.execute("INSERT INTO senses(entry_id, n, gloss, tags, examples) VALUES (?,?,?,?,'[]')",
                       (eid, n, gloss, json.dumps(sorted(usage), ensure_ascii=False)))
            stats["senses_from_translations"] += 1
        db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)",
                       [(k, eid, kind) for k, kind in keys if k])
    return dict(stats)


def link_kept_pages(db, kept):
    """Give the word a kept page points at a link back: великий lists більший
    among its related words. Only where the spelling has exactly one entry;
    with two there is no telling which was meant."""
    entries = collections.defaultdict(list)
    own = {}
    for eid, word, headword in db.execute("SELECT id, word, headword FROM entries"):
        entries[plain(word)].append(eid)
        own[eid] = (plain(word), headword)
    have = set(db.execute("SELECT entry_id, plain FROM relations"))
    back = []
    for eid, target in kept:
        source, headword = own[eid]
        targets = entries.get(target, ())
        if len(targets) != 1 or targets[0] == eid or (targets[0], source) in have:
            continue
        have.add((targets[0], source))
        back.append((targets[0], None, "related", headword, source, "[]"))
    db.executemany("INSERT INTO relations(entry_id, sense_n, kind, word, plain, tags) VALUES (?,?,?,?,?,?)", back)
    return len(back)


def add_head_keys(db):
    """Make the words on a head line findable: істори́чний names істори́чно as
    its adverb, впе́рше names упе́рше as another spelling, but neither has an
    entry or a table row of its own, so a search for them found nothing.

    Each such spelling becomes a 'head' key pointing at the entry that names
    it. Only spellings no entry and no inflected form already has: those are
    found as themselves. Run after every entry is in, so a word that has an
    entry further down the file is not keyed twice.

    An entry made from translation tables does not count: it is too thin to
    stand alone, so істори́чно finds both its own entry and істори́чний."""
    known = {k for (k,) in db.execute(
        "SELECT k.key FROM search_keys k JOIN entries e ON e.id = k.entry_id"
        " WHERE k.kind IN ('word','form') AND e.source != ?", (FROM_TRANSLATIONS,))}
    rows = set()
    for eid, head_forms in db.execute("SELECT id, head_forms FROM entries"):
        for f in json.loads(head_forms):
            p = plain(f["form"])
            if TOKEN.fullmatch(p) and p not in known:
                rows.add((p, eid))
    db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,'head')", sorted(rows))
    return len(rows)


SKIP_FORM_TAGS = {"table-tags", "inflection-template", "class", "romanization",
                  # Rows wiktextract could not parse: table notes such as
                  # "Future conjugation of бути + infinitive", not real forms.
                  "error-unrecognized-form"}
NOISE_TAGS = {"error-unknown-tag"}

# Labels wiktextract leaves in the gloss text without turning them into tags:
# канєшно has raw_glosses ["(Surzhyk) of course, certainly"] and tags [], so
# the word would look like plain standard Ukrainian. Each label here becomes
# tags the site already names; "surzhyk" and "highly-offensive" are the only
# new ones. Only usage labels are listed: topic labels ("military", "law")
# and grammar notes ("rarely transitive") stay out on purpose.
GLOSS_LABELS = {
    "surzhyk": ["surzhyk"],
    "highly offensive": ["highly-offensive"],
    **{label: ["offensive"] for label in (
        "potentially offensive", "now offensive", "now usually offensive",
        "somewhat offensive", "mildly offensive")},
    **{label: ["slang"] for label in (
        "internet slang", "chiefly internet slang", "school slang", "university slang",
        "student slang", "youth slang", "criminal slang", "prison slang", "army slang",
        "military slang", "fandom slang", "gaming slang")},
    "taboo slang": ["slang", "vulgar"],
    "chiefly taboo slang": ["slang", "vulgar"],
    "low colloquial": ["colloquial"],
    "rarely": ["rare"],
    "rare in this sense": ["rare"],
    "dialect": ["dialectal"],
    "now dialectal": ["dialectal"],
    "chiefly dialectal": ["dialectal"],
    **{label: ["derogatory"] for label in (
        "chiefly derogatory", "usually derogatory", "sometimes derogatory")},
    **{label: ["vulgar"] for label in ("somewhat vulgar", "chiefly vulgar", "slightly vulgar")},
    "somewhat proscribed": ["proscribed"],
}
GLOSS_LABEL = re.compile(r"\(([^()]*)\)")


def sense_tags(sense):
    """A sense's tags: wiktextract's own, then the usage labels it left in the
    gloss text (GLOSS_LABELS). "(Surzhyk) of course" on канєшно gives ["surzhyk"];
    "(derogatory, ethnic slur, highly offensive)" on хохол adds "highly-offensive"
    to the derogatory, ethnic and slur tags it already has."""
    tags = list(sense.get("tags") or [])
    raw = (sense.get("raw_glosses") or [""])[0]
    found = GLOSS_LABEL.match(raw)
    if found:
        for label in re.split(r",\s*|\s+or\s+", found.group(1)):
            for tag in GLOSS_LABELS.get(label.strip().lower(), []):
                if tag not in tags:
                    tags.append(tag)
    return tags


# Words the site marks as highly offensive: a slur on a people or a faith, or
# Wiktionary's "highly offensive". Written by hand, because a sense's tags say
# a word is a slur but not on whom; slurs on Russians are left unmarked. See
# the file's header for the format.
MARKED_OFFENSIVE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "marked-offensive.tsv")
MARK_CANDIDATE_TAGS = ("slur", "highly-offensive")


def marked_offensive(path=MARKED_OFFENSIVE):
    """The rows of marked-offensive.tsv: {(spelling, part of speech or None): True to mark}."""
    rows = {}
    if not os.path.exists(path):
        return rows
    with open(path, encoding="utf-8") as lines:
        for line in lines:
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            cells = [c.strip() for c in line.split("\t")] + ["", ""]
            if cells[2] not in ("mark", "leave"):
                raise ValueError(f"marked-offensive.tsv: '{cells[2]}' for {cells[0]} is neither mark nor leave")
            rows[(cells[0], cells[1] or None)] = cells[2] == "mark"
    return rows


def mark_offensive(db, rows):
    """Set entries.offensive = 1 on the entries the list marks, and return the
    words whose senses carry a slur or highly-offensive tag that the list does
    not mention either way, so a rebuild shows each new one for a decision."""
    def listed(word, pos):
        return rows.get((word, pos), rows.get((word, None)))
    marked = 0
    for (word, pos), mark in rows.items():
        if mark:
            marked += db.execute(
                "UPDATE entries SET offensive = 1 WHERE word = ? AND (? IS NULL OR pos = ?)",
                (word, pos, pos)).rowcount
    like = " OR ".join(f"s.tags LIKE '%\"{tag}\"%'" for tag in MARK_CANDIDATE_TAGS)
    unreviewed = sorted({f"{word} ({pos})" for word, pos in db.execute(
        f"SELECT DISTINCT e.word, e.pos FROM entries e JOIN senses s ON s.entry_id = e.id WHERE {like}")
        if listed(word, pos) is None})
    return marked, unreviewed


TOKEN = re.compile(r"[\u0400-\u04FF]+(?:['’ʼ-][\u0400-\u04FF]+)*")


# Letters of the alphabet, affixes and symbols are dictionary entries too, but
# they are not vocabulary, so they get no frequency rank and no examples.
NOT_VOCABULARY = ("character", "symbol", "punct", "suffix", "prefix", "interfix", "combining_form")


# Wiktionary's lists of other words, on an entry or on one of its meanings, and
# what each is called in `relations`. Coordinate terms are left out: a few
# hundred entries carry tens of thousands of them (every month under січень,
# every country under Україна), which is a list to browse, not a word's kin.
RELATIONS = {"synonyms": "synonym", "antonyms": "antonym", "derived": "derived", "related": "related"}
BOTH_WAYS = ("synonym", "antonym")
RELATION_NOISE = {"synonym", "synonym-of"}  # says again what `kind` says


def related_words(source, sense_n):
    """Rows for `relations` from the lists on an entry (sense_n None) or on one
    of its meanings: (sense_n, kind, word, plain, tags)."""
    rows = []
    for field, kind in RELATIONS.items():
        for item in source.get(field) or []:
            # A few come with their romanisation attached, "мольфар (molʹfar)", or
            # with a gender or aspect mark in Latin letters: "не́бо n", "сі́яти impf"
            word = re.sub(r"\s*\([^)]*\)$", "", unicodedata.normalize("NFC", (item.get("word") or "").strip()))
            word = re.sub(r"(?:\s+[A-Za-z.:-]+)+$", "", word)
            if not TOKEN.search(word):  # a note or a Latin-letter term, not a Ukrainian word
                continue
            tags = [t for t in item.get("tags") or [] if t not in NOISE_TAGS and t not in RELATION_NOISE]
            rows.append((sense_n, kind, word, plain(word), json.dumps(tags, ensure_ascii=False)))
    return rows


def finish_relations(db):
    """Two passes over `relations` that need every entry to be there.

    Stress: Wiktionary writes some related words without a stress mark
    (красивий). Where exactly one headword has that spelling, the word takes
    its stress (краси́вий).

    Both ways: a synonym or an antonym holds in both directions, but often only
    one side says so: великий names малий as its antonym, and малий should name
    великий. The other side gets the link too, when the spelling it points at
    has exactly one entry of the same part of speech; with two, there is no
    telling which was meant. Such a link belongs to the whole entry, since the
    meaning it would hang on is not known.
    """
    headwords = collections.defaultdict(set)   # plain spelling -> its headwords
    entries = collections.defaultdict(list)    # plain spelling -> (id, pos)
    own = {}                                    # id -> (plain spelling, pos, headword)
    for eid, word, headword, pos in db.execute("SELECT id, word, headword, pos FROM entries"):
        key = plain(word)
        headwords[key].add(headword)
        entries[key].append((eid, pos))
        own[eid] = (key, pos, headword)

    stressed = []
    for rid, word, key in db.execute("SELECT id, word, plain FROM relations"):
        if STRESS in word:
            continue
        found = headwords.get(key, ())
        if len(found) == 1:
            (headword,) = found
            # The same letters and capitals, with the stress added
            if STRESS in headword and strip_stress(headword) == word:
                stressed.append((headword, rid))
    db.executemany("UPDATE relations SET word=? WHERE id=?", stressed)

    marks = ",".join("?" * len(BOTH_WAYS))
    have = set(db.execute(f"SELECT entry_id, kind, plain FROM relations WHERE kind IN ({marks})", BOTH_WAYS))
    back = []
    for eid, kind, key in db.execute(
            f"SELECT entry_id, kind, plain FROM relations WHERE kind IN ({marks}) ORDER BY id", BOTH_WAYS).fetchall():
        source, pos, headword = own[eid]
        targets = [t for t, target_pos in entries.get(key, ()) if target_pos == pos]
        if len(targets) != 1 or targets[0] == eid or (targets[0], kind, source) in have:
            continue
        have.add((targets[0], kind, source))
        back.append((targets[0], None, kind, headword, source, "[]"))
    db.executemany("INSERT INTO relations(entry_id, sense_n, kind, word, plain, tags) VALUES (?,?,?,?,?,?)", back)

    stats = {f"relations_{kind}": n for kind, n in db.execute(
        "SELECT kind, COUNT(*) FROM relations GROUP BY kind ORDER BY kind")}
    stats.update(relations_stress_added=len(stressed), relations_backward=len(back))
    return stats


def form_index(db):
    """Map every known spelling (dictionary word or inflected form) to its entries.

    A kept "form of" page owns a spelling only where no ordinary entry does.
    створений is such a page and also a form of створити; його is one ("genitive
    of він") and a form of він; ванна is one (short for ванна кімната) beside
    the noun ванна. Counts, example sentences and practice sentences for those
    spellings stay with the entries that had them before such pages were kept,
    and the pages get what is theirs alone: створена, більший.
    """
    index = collections.defaultdict(set)
    marks = ",".join("?" * len(NOT_VOCABULARY))
    for key, eid in db.execute(
            "SELECT k.key, k.entry_id FROM search_keys k JOIN entries e ON e.id = k.entry_id"
            f" WHERE k.kind IN ('word','form') AND e.pos NOT IN ({marks})", NOT_VOCABULARY):
        index[key].add(eid)
    kept = {eid for (eid,) in db.execute(
        "SELECT e.id FROM entries e WHERE EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id)"
        " AND NOT EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id"
        "  AND s.tags NOT LIKE '%\"form-of\"%' AND s.tags NOT LIKE '%\"alt-of\"%')")}
    for key, owners in index.items():
        if owners & kept and owners - kept:
            index[key] = owners - kept
    return index


def ukrainian_counts(folder):
    """How often each spelling occurs in Tatoeba's Ukrainian sentences."""
    counts = collections.Counter()
    with bz2.open(os.path.join(folder, "ukr_sentences.tsv.bz2"), "rt", encoding="utf-8") as f:
        for line in f:
            counts.update(plain(t) for t in TOKEN.findall(line.split("\t")[-1]))
    return counts


def add_frequency(db, index, path, reference=None, max_ratio=20, lemma_weight=4, unranked: "set | frozenset" = frozenset()):
    """Rank entries by how often any of their forms occurs in the frequency list.

    The list counts spellings, not dictionary words, so each count is added to
    the entry the spelling belongs to. When several entries share a spelling,
    the entry whose dictionary form it is gets `lemma_weight` shares and the
    others one each: "зараз" counts mostly for the adverb зараз ("now"), not
    for the noun зараза ("infection"), which merely has it as a plural form.

    The subtitle list is about one third Russian. Most Russian words match no
    Ukrainian form and drop out, but some collide: Russian "мне" (to me) is
    also a form of Ukrainian м'яти (to crumple). `reference` holds counts from
    a clean Ukrainian corpus; a spelling may count for at most `max_ratio`
    times its relative frequency there, which deflates the collisions.

    The entries in `unranked` get no rank: those made from translation tables.
    With no table of forms only their dictionary form could be counted, and
    without one nothing tells a Ukrainian word from a Russian one spelled the
    same: он ("yonder") came out as the 39th most common word, on the strength
    of Russian "он" (he), and пока and меньше stood among the first 1,500.
    """
    lines = []
    for line in open(path, encoding="utf-8"):
        parts = line.split()
        if len(parts) == 2 and parts[1].isdigit():
            lines.append((plain(parts[0]), int(parts[1])))
    corpus = sum(c for _, c in lines)
    ref_total = sum(reference.values()) if reference else 0
    lemmas = collections.defaultdict(set)
    for key, eid in db.execute("SELECT key, entry_id FROM search_keys WHERE kind='word'"):
        lemmas[key].add(eid)

    totals = collections.Counter()
    matched = capped = 0
    for key, count in lines:
        owners = index.get(key, set()) - unranked
        if not owners:
            continue
        matched += count
        if reference:
            limit = max_ratio * (reference.get(key, 0) + 1) / ref_total * corpus
            if count > limit:
                count, capped = limit, capped + 1
        weights = {eid: lemma_weight if eid in lemmas.get(key, ()) else 1 for eid in owners}
        share = count / sum(weights.values())
        for eid, w in weights.items():
            totals[eid] += share * w
    ranked = sorted(totals.items(), key=lambda kv: -kv[1])
    db.executemany("UPDATE entries SET freq=?, freq_rank=? WHERE id=?",
                   [(round(c * 1e6 / corpus, 3), rank, eid)
                    for rank, (eid, c) in enumerate(ranked, 1)])
    return dict(freq_entries_ranked=len(ranked),
                freq_corpus_coverage=round(matched / corpus, 3),
                freq_spellings_capped=capped)


# English words that tell nothing about which meaning a translation has: they
# stand in nearly every sentence, or in the wording of a gloss rather than its
# sense ("to have", "someone who…"). A pronoun in a gloss ("here you go!", the
# interjection на) must not match the "you" of "Do you speak Shanghainese?".
ENGLISH_NOISE = frozenset("""
    a an the to of and or as not so if then than but
    i you he she it we they me him her us them my your his its our their
    this that these those who whom whose which what
    be am is are was were been being do does did will would can could shall should may might must
    one someone something somebody anyone anything person thing used etc e g
""".split())
# English prepositions are the meaning of a preposition's gloss (на: "on, at")
# but only wording in any other ("band of warriors in Rus" must not meet "my
# in-laws"), so they count for prepositions alone.
ENGLISH_PREPOSITIONS = frozenset("""
    in on at for with from by into onto about over under after before between
    through toward towards against without within among near off out up down
""".split())


def english_words(text, prepositions=True):
    """The words of an English gloss or sentence that can say which meaning is
    meant: lowercase, with a final s dropped so that wasps meets wasp, and with
    the notes in brackets left out ("[with accusative]")."""
    text = re.sub(r"\[[^]]*\]|\([^)]*\)", " ", text.lower())
    words = {w[:-1] if len(w) > 3 and w.endswith("s") else w for w in re.findall(r"[a-z]+", text)}
    return words - ENGLISH_NOISE - (frozenset() if prepositions else ENGLISH_PREPOSITIONS)


def starts_sentence(text, at):
    """Whether the word at `at` begins a sentence of `text`, which Tatoeba
    entries sometimes hold two of: «Іди сюди! Так, саме ти.»"""
    before = re.sub(r"[\s\"'«„“(—–-]+$", "", text[:at])
    return not before or before[-1] in ".!?…"


def sentence_readings(db, index):
    """Return a function that says which entries a word of a Tatoeba sentence
    shows, given the word as written and the sentence's English translation.

    Many spellings belong to more than one entry: осі is a form of вісь
    ("axis") and of оса ("wasp"), мати is both the noun "mother" and the verb
    "to have". A sentence is shown only for the entry it is about, decided in
    this order; when nothing decides, it is shown for none of them.

    1. A word written in lower case is no proper name: земля is not Земля.
       One written with a capital away from the start of a sentence is
       nothing but a name: «ти подобаєшся Тому» is "Tom likes you", not the
       adverb тому, and Том has no entry.
    2. A spelling left with one entry is that entry's.
    3. The translation names one meaning: "The Earth rotates on its axis"
       has "axis", which is in вісь's glosses and not in оса's. Each entry's
       first meaning is asked first: голова "head" and голова "chairman"
       both have "head" among their meanings, but only the first has it first.
       An interjection's gloss is no meaning to match ("here you go! take
       it!" for на would claim every "go to the party").
    4. The spelling is the dictionary form of exactly one of them, and that
       one is the commonest word of them: зараз is the adverb "now", not a
       plural of зараза. Being the dictionary form alone is not enough: став
       is the noun "pond" and the past tense of стати, and «він став
       знаменитим» is the verb.
    """
    lemmas = collections.defaultdict(set)
    for key, eid in db.execute("SELECT key, entry_id FROM search_keys WHERE kind='word'"):
        lemmas[key].add(eid)
    capital, freq = {}, {}
    for eid, word, f in db.execute("SELECT id, word, freq FROM entries"):
        capital[eid], freq[eid] = word[:1].isupper(), f
    first = collections.defaultdict(set)  # entry id -> words of its first gloss
    every = collections.defaultdict(set)  # entry id -> words of all its glosses
    for eid, n, gloss, pos in db.execute(
            "SELECT s.entry_id, s.n, s.gloss, e.pos FROM senses s JOIN entries e ON e.id = s.entry_id"
            " WHERE e.pos <> 'intj'"):
        words = english_words(gloss, prepositions=pos == "prep")
        every[eid] |= words
        if n == 1:
            first[eid] = words

    def readings(token, english, starts=True):
        """`starts`: the word begins its sentence, so a capital says nothing."""
        key = plain(token)
        owners = index.get(key, set())
        if not token[:1].isupper():
            owners = {e for e in owners if not capital[e]}
        elif not starts:
            owners = {e for e in owners if capital[e]}
        if len(owners) <= 1:
            return owners
        said = english_words(english)
        for glosses in (first, every):
            named = {e for e in owners if glosses[e] & said}
            if len(named) == 1:
                return named
        heads = owners & lemmas.get(key, set())
        if len(heads) == 1 and all(freq[e] <= freq[h] for h in heads for e in owners):
            return heads
        return set()

    return readings


def add_tatoeba(db, index, pairs, per_entry=3, ratings=None, fixes=None):
    """Attach up to `per_entry` short translated sentences to each entry, each
    only to the entries `sentence_readings` finds it to be about, the most
    natural first (see short_first). At most one of an entry's sentences is
    about Tom, Mary or another of Tatoeba's stock characters. A corrected
    sentence keeps Tatoeba's text in `original`, so the page can mark it."""
    readings = sentence_readings(db, index)
    candidates = collections.defaultdict(list)
    named = collections.Counter()  # entry id -> sentences about a stock character
    for sid, text, english, rating, adapted, original in short_first(pairs, ratings, fixes):
        found = {e for m in TOKEN.finditer(text)
                 for e in readings(m.group(), english, starts_sentence(text, m.start()))}
        names = bool(STOCK_NAMES.search(text)) or bool(rating and "names" in rating[2])
        for eid in found:
            if len(candidates[eid]) < per_entry and not (names and named[eid]):
                candidates[eid].append((eid, text, english, sid, int(adapted), original))
                named[eid] += names
    ensure_examples_original(db)
    db.executemany("INSERT INTO examples(entry_id, uk, en, tatoeba_id, adapted, original) VALUES (?,?,?,?,?,?)",
                   [row for rows_ in candidates.values() for row in rows_])
    return dict(tatoeba_pairs=len(pairs),
                entries_with_tatoeba=len(candidates),
                tatoeba_examples=sum(len(v) for v in candidates.values()),
                corrected_examples=sum(1 for v in candidates.values() for row in v if row[4]))


# --- Sentences with a gap, for grammar practice -----------------------------
#
# A grammar point here is a preposition with the case it asks for: без takes
# the genitive (без цукру), на the accusative for where to (на стіл) and the
# locative for where (на столі). The table is written by hand; the sentences
# that show each point are found in Tatoeba by it.
#
# The Tatoeba files are read here a second time, apart from add_tatoeba: a few
# seconds, and the two steps can then change without minding each other.
#
# Each preposition: the name its points go by, the cases practised, and the
# cases it also takes that are not practised. Those are named so that a noun
# standing in one of them is recognised and left out: у брата ("at my
# brother's") is у with the genitive, and must not be taken for the
# accusative that брата also is.
PREPOSITIONS = {
    "без": ("bez", ["genitive"], []),
    "для": ("dlia", ["genitive"], []),
    "до": ("do", ["genitive"], []),
    "від": ("vid", ["genitive"], []),
    "біля": ("bilia", ["genitive"], []),
    "після": ("pislia", ["genitive"], []),
    "крім": ("krim", ["genitive"], []),
    "серед": ("sered", ["genitive"], []),
    "проти": ("proty", ["genitive"], []),
    "замість": ("zamist", ["genitive"], []),
    "навколо": ("navkolo", ["genitive"], []),
    "через": ("cherez", ["accusative"], []),
    "про": ("pro", ["accusative"], []),
    "крізь": ("kriz", ["accusative"], []),
    "з": ("z", ["genitive", "instrumental"], []),
    "із": ("z", ["genitive", "instrumental"], []),
    "зі": ("z", ["genitive", "instrumental"], []),
    "на": ("na", ["accusative", "locative"], []),
    "у": ("u", ["accusative", "locative"], ["genitive"]),
    "в": ("u", ["accusative", "locative"], ["genitive"]),
    "за": ("za", ["accusative", "instrumental"], ["genitive"]),
    "під": ("pid", ["accusative", "instrumental"], []),
    "над": ("nad", ["instrumental"], []),
    "перед": ("pered", ["instrumental"], []),
    "між": ("mizh", ["instrumental"], ["genitive"]),
    "по": ("po", ["locative"], ["accusative"]),
    "при": ("pry", ["locative"], []),
    "завдяки": ("zavdiaky", ["dative"], []),
}
CASE_SHORT = {"genitive": "gen", "dative": "dat", "accusative": "acc", "instrumental": "ins", "locative": "loc"}
CASES = {"nominative", "genitive", "dative", "accusative", "instrumental", "locative", "vocative"}
# A point with fewer sentences than this is not offered: the same few would come round too soon.
CLOZE_MIN = 20


CORRECTIONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tatoeba-corrections.tsv")


def tatoeba_corrections(path=CORRECTIONS):
    """The hand-written corrections: id -> (Ukrainian or None to leave it out, English or None to keep it).

    A teacher's fix goes here rather than into the database, which every
    build makes again: Він пише на правильній англійській becomes Він пише
    правильною англійською.
    """
    corrections = {}
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) != 4 or not cols[0].isdigit() or not cols[1]:
                raise ValueError(f"{path}:{n}: want id, uk (or -), en (or empty) and source, tab-separated")
            sid, uk, en, _source = cols
            corrections[int(sid)] = (None if uk == "-" else uk, en or None)
    return corrections


EXCLUDED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "excluded-sentences.tsv")


def excluded_sentences(path=EXCLUDED):
    """The Tatoeba ids the site never shows, decided by hand: id -> group.

    No native speaker reads the sentences before they are shown, so a sentence
    that is political in a way a dictionary should not be (Путін у новорічну
    ніч подякував росіянам...) is listed here by id, with its group and why.
    `rate_sentences.py screen` lists the candidates by keyword; nothing is left
    out by keyword alone, so a neutral or critical sentence stays.
    """
    excluded = {}
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) != 3 or not cols[0].isdigit() or not cols[1] or not cols[2]:
                raise ValueError(f"{path}:{n}: want id, group and reason, tab-separated")
            if int(cols[0]) in excluded:
                raise ValueError(f"{path}:{n}: {cols[0]} is listed twice")
            excluded[int(cols[0])] = cols[1]
    return excluded


def tatoeba_pairs(folder, corrections=None, excluded=None):
    """Tatoeba's Ukrainian sentences that have an English translation, with the
    corrections applied and the excluded sentences left out: id -> (Ukrainian,
    English, adapted, original), where `original` is Tatoeba's Ukrainian when
    the correction changed it, else None."""
    def rows(name):
        with bz2.open(os.path.join(folder, name), "rt", encoding="utf-8") as f:
            for line in f:
                yield line.rstrip("\n").split("\t")

    uk = {int(r[0]): r[2] for r in rows("ukr_sentences.tsv.bz2") if len(r) == 3}
    link = {}
    for r in rows("ukr-eng_links.tsv.bz2"):
        link.setdefault(int(r[0]), int(r[1]))
    wanted = set(link.values())
    en = {int(r[0]): r[2] for r in rows("eng_sentences.tsv.bz2")
          if len(r) == 3 and int(r[0]) in wanted}
    pairs = {sid: (text, en[link[sid]], False, None) for sid, text in uk.items() if link.get(sid) in en}
    if corrections is None:
        corrections = tatoeba_corrections()
    for sid, (new_uk, new_en) in corrections.items():
        if sid not in pairs:
            continue  # gone from Tatoeba, or never had an English translation
        if new_uk is None:
            del pairs[sid]
        else:
            text, english, _, _ = pairs[sid]
            pairs[sid] = (new_uk, new_en or english, new_uk != text or bool(new_en and new_en != english),
                          text if new_uk != text else None)
    # Here rather than in add_tatoeba and add_cloze, so that neither can show
    # an excluded sentence and rate_sentences.py does not spend on rating one.
    for sid in excluded_sentences() if excluded is None else excluded:
        pairs.pop(sid, None)
    return pairs


# --- Sentence ratings (docs/sentence-rating.md) ------------------------------
# data/sentence-ratings.tsv says how natural each Tatoeba sentence sounds, 1 to
# 5, as rated by data/rate_sentences.py. It holds ids and a hash of the text,
# never the text, and survives a rebuild of the database.

RATINGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentence-ratings.tsv")
RATING_COLUMNS = ("tatoeba_id", "hash", "natural", "use", "flags", "owner_level", "translated",
                  "reviews", "model", "rubric")
UNRATED = 3            # what a sentence with no rating counts as, so a build before rating still works
USE_ORDER = {"common": 0, "neutral": 1, "rare": 2}
# Flags that hide a sentence whatever its score. A Russianism (на протязі, слідкувати) is hidden even when the
# rest of the sentence is fine: a learner copies the whole sentence. rejected: a native speaker reviewed it -1.
NEVER_SHOWN = {"offensive", "mistranslation", "proverb", "russianism", "rejected"}
# Tatoeba's stock characters: a quarter of the short sentences are about Tom or Mary.
STOCK_NAMES = re.compile(r"(?<![\w'’ʼ])(?:Том(?:а|у|ом|ові|е)?|Мері|Джон\w*|Аліс\w*)(?![\w'’ʼ])")


# data/sentence-fix-checks.tsv: each fix of data/sentence-fixes.tsv checked against Горох, slovnyk.ua
# and VESUM, and each meaning fix against its English (2026-11-17). "unneeded" means Tatoeba's sentence
# was right after all (спражній is a СУМ word, -сь is as good as -ся, «Ми з ним посварилися» says "I had
# a quarrel with him"): the fix is dropped and the original shown. Every other verdict keeps it.
FIX_CHECKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentence-fix-checks.tsv")
# Flags the check can refute. offensive and proverb are not about mistakes, so they stay.
REFUTED = {"error", "russianism", "calque", "mistranslation"}


def unneeded_fixes(path=FIX_CHECKS):
    """tatoeba id -> hash of Tatoeba's text, for each fix the dictionary check found unneeded."""
    if not path or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8", newline="") as f:
        rows = f.read().splitlines()[1:]
    out = {}
    for line in rows:
        sid, digest, verdict = line.split("\t")[:3]
        if verdict == "unneeded":
            out[int(sid)] = digest
    return out


def text_hash(text):
    """Short hash of a sentence, so that a rating is dropped when Tatoeba edits the sentence."""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def load_ratings(path=RATINGS, checks=None):
    """tatoeba id -> row of data/sentence-ratings.tsv as a dict; empty when there is no file.

    A sentence whose fix a dictionary check found unneeded (data/sentence-fix-checks.tsv)
    was hidden for a mistake it does not have: its error, russianism, calque and mistranslation flags
    are dropped and it counts as at least a 3, so Tatoeba's own text is shown again."""
    if not path or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8", newline="") as f:
        lines = f.read().splitlines()
    if not lines:
        return {}
    head = lines[0].split("\t")
    rows = {}
    for line in lines[1:]:
        row = dict(zip(head, line.split("\t")))
        rows[int(row["tatoeba_id"])] = row
    for sid, digest in unneeded_fixes(FIX_CHECKS if checks is None else checks).items():
        row = rows.get(sid)
        if row and row.get("hash") == digest and row.get("natural"):
            row["natural"] = str(max(int(row["natural"]), UNRATED))
            row["flags"] = ",".join(f for f in row.get("flags", "").split(",") if f and f not in REFUTED)
    return rows


def rating_of(ratings, sid, text):
    """(natural, use, flags) of a sentence, or None when it has no rating for this exact text."""
    row = ratings.get(sid)
    if not row or row.get("hash") != text_hash(text) or not row.get("natural"):
        return None
    flags = frozenset(f for f in row.get("flags", "").split(",") if f)
    return int(row["natural"]), row.get("use") or "neutral", flags


# data/sentence-fixes.tsv: our corrections of hidden sentences, each checked by a second model
# (docs/sentence-rating.md, section 7). Keyed by Tatoeba id and the hash of Tatoeba's text, so a
# fix lapses when Tatoeba edits the sentence. A fix is our edit of a CC BY sentence: the site marks it.
FIXES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentence-fixes.tsv")


def load_fixes(path=FIXES, checks=None):
    """tatoeba id -> (hash of Tatoeba's text, corrected text, naturalness of the correction),
    leaving out the fixes data/sentence-fix-checks.tsv found unneeded."""
    if not path or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8", newline="") as f:
        rows = f.read().splitlines()[1:]
    unneeded = unneeded_fixes(FIX_CHECKS if checks is None else checks)
    out = {}
    for line in rows:
        sid, digest, fixed, natural = line.split("\t")[:4]
        if unneeded.get(int(sid)) != digest:
            out[int(sid)] = (digest, fixed, int(natural))
    return out


def short_first(pairs, ratings=None, fixes=None):
    """Sentences of 3 to 12 words that may be shown, the most natural first, then the
    commonest, then those of about five words, as add_tatoeba takes them:
    (id, Ukrainian, English, rating, adapted, original). `rating` is None for a
    sentence not rated yet; `original` is Tatoeba's Ukrainian where a correction
    changed it, else None.

    A hand-written correction (data/tatoeba-corrections.tsv) is already applied in
    `pairs` and wins over everything here. A rated sentence below 3, or flagged
    offensive, mistranslated, a Russianism or a proverb (whose English is an
    equivalent, not a translation of its words), is left out. Such a sentence with
    a checked fix (data/sentence-fixes.tsv) comes back corrected, after every
    sentence that needs none, so a fix only fills a gap and never displaces a
    real sentence."""
    ratings, fixes = ratings or {}, fixes or {}
    candidates = []  # (tier, rating, sid, text, english, adapted, original): tier 1 is a gap-filling fix
    for sid, (text, english, adapted, original) in pairs.items():
        rating = rating_of(ratings, sid, text)
        if adapted and rating is None:
            rating = (5, "neutral", frozenset())  # a teacher read and corrected it: the best evidence there is
        if rating and (rating[0] < UNRATED or rating[2] & NEVER_SHOWN):
            fix = fixes.get(sid)
            if fix and not adapted and fix[0] == text_hash(text):
                candidates.append((1, (fix[2], rating[1], frozenset()), sid, fix[1], english, True, text))
            continue
        candidates.append((0, rating, sid, text, english, adapted, original))

    def order(c):
        tier, rating, sid, text = c[:4]
        natural, use, _ = rating or (UNRATED, "neutral", ())
        return tier, -natural, USE_ORDER.get(use, 1), abs(len(TOKEN.findall(text)) - 5), sid

    for tier, rating, sid, text, english, adapted, original in sorted(candidates, key=order):
        if english and 3 <= len(TOKEN.findall(text)) <= 12:
            yield sid, text, english, rating, adapted, original


def ensure_examples_original(db):
    """Give an older database's `examples` the `original` column (added November 2026)."""
    if "original" not in {r[1] for r in db.execute("PRAGMA table_info(examples)")}:
        db.execute("ALTER TABLE examples ADD COLUMN original TEXT")


# The де/куди sentences of grammar practice were read and picked by hand
# (src/lib/practice/where.ts, by Tatoeba id). A person's choice outranks the
# automated rating and the per-noun limit, so add_cloze always keeps them.
WHERE_TS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "lib", "practice", "where.ts")


def hand_picked_cloze(path=WHERE_TS):
    """The Tatoeba ids listed in where.ts's WHERE table; empty when the file is not there."""
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        text = f.read()
    start = text.find("export const WHERE")
    if start < 0:
        return set()
    block = text[start:text.find("\n};", start)]
    return {int(n) for n in re.findall(r"^\s*(\d+),", block, re.M)}


def add_cloze(db, index, pairs, per_noun=5, ratings=None):
    """Fill `cloze`: sentences where a preposition is followed by a noun in a case only it explains.

    A sentence is kept only when nothing about the gap is in doubt:

    - the word after the preposition is a form of exactly one entry, a noun
      (п'яти after біля is the numeral five far oftener than the heel п'ята);
    - of the cases the preposition takes, that spelling is only one (сестри
      after у could be genitive singular or accusative plural, so it is left);
    - the noun changes at all (метро has one spelling for every case);
    - it is written with a capital only if the dictionary's word is (Томом is
      the name Том, which has no entry, and not the noun том, "volume").

    Up to `per_noun` sentences are kept for one noun at one point, so that no
    point is mostly about Том. Returns the counts, with the sentences of each
    point under "cloze_points".
    """
    nouns = {}    # entry id -> spelling -> [(case, number, form with stress)]
    capital = {}  # entry id -> whether its word is written with a capital
    for eid, word, form, key, tags in db.execute(
            "SELECT e.id, e.word, f.form, f.plain, f.tags FROM forms f JOIN entries e ON e.id = f.entry_id"
            " WHERE e.pos IN ('noun', 'name')"):
        capital[eid] = word[:1].isupper()
        tags = json.loads(tags)
        number = "plural" if "plural" in tags else "singular" if "singular" in tags else None
        spellings = nouns.setdefault(eid, {})
        for case in CASES.intersection(tags):
            if number:
                spellings.setdefault(key, []).append((case, number, form))

    picked = hand_picked_cloze()
    kept = collections.defaultdict(list)       # point -> rows
    per = collections.Counter()                # (point, entry) -> sentences kept
    # No `fixes` here: practice keeps to Tatoeba's sentences and the hand-written corrections
    for sid, text, english, rating, adapted, original in short_first(pairs, ratings):
        if rating and rating[0] < 4 and sid not in picked:
            continue  # practice wants sentences worth copying; unrated ones pass until rated
        if any(ord(ch) > 0xFFFF for ch in text):
            continue  # `start` must mean the same to Python and to JavaScript
        found = list(TOKEN.finditer(text))
        for before, word in zip(found, found[1:]):
            preposition = PREPOSITIONS.get(plain(before.group()))
            if not preposition or text[before.end():word.start()] != " ":
                continue
            name, practised, also = preposition
            key = plain(word.group())
            owners = index.get(key, ())
            if len(owners) != 1:
                continue
            (eid,) = owners
            spellings = nouns.get(eid)
            if not spellings or len(spellings) < 2 or word.group()[:1].isupper() != capital[eid]:
                continue
            here = [(case, number, form) for case, number, form in spellings.get(key, ())
                    if case in practised or case in also]
            cases = {case for case, _, _ in here}
            numbers = {number for _, number, _ in here}
            if len(cases) != 1 or len(numbers) != 1 or not cases <= set(practised):
                continue
            case, number, form = here[0]
            point = f"{name}-{CASE_SHORT[case]}"
            if per[point, eid] >= per_noun and sid not in picked:
                continue
            per[point, eid] += 1
            kept[point].append((eid, text, english, word.start(), len(word.group()), form, number, sid, adapted))

    points = {point: len(rows) for point, rows in sorted(kept.items()) if len(rows) >= CLOZE_MIN}
    db.executemany(
        "INSERT INTO cloze(point, n, entry_id, uk, en, start, length, form, number, tatoeba_id, adapted)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [(point, n, *row) for point in points for n, row in enumerate(kept[point])])
    return dict(cloze_sentences=sum(points.values()), cloze_points=points,
                cloze_points_too_small=sorted(set(kept) - set(points)))


# --- Case government: the case a verb asks for --------------------------------
#
# дякувати asks for the dative (дякую мамі), користуватися for the
# instrumental (користуюся телефоном), чекати на for the accusative (чекаю на
# автобус). The patterns are listed by hand in src/lib/practice/government.ts,
# which the practice page reads too; here each gets sentences in `cloze`, under
# its id, as a preposition's point does: first Tatoeba's, then sentences made
# from a frame (subject, verb, preposition, noun: Ми дякуємо сусідові.) up to
# CLOZE_MIN. A frame's nouns are named in the same file.

GOVERNMENT_TS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "..", "src", "lib", "practice", "government.ts")
GOV_CASES = {"gen": "genitive", "dat": "dative", "acc": "accusative", "ins": "instrumental", "loc": "locative"}
# Prepositions after which the noun could stand in either of two cases, so the case can be practised
GOV_TWO_CASES = {"на", "у", "з", "за", "під"}
# Every spelling of a preposition
GOV_SPELLINGS = {"у": {"у", "в"}, "з": {"з", "із", "зі"}}
# Words that end the stretch after a verb: what follows them belongs to another phrase
GOV_CONJUNCTIONS = {"і", "й", "та", "а", "але", "що", "щоб", "як", "бо", "чи", "або", "ні", "коли", "якщо",
                    "поки", "ніж", "аби", "хоч", "хоча", "де", "куди", "звідки", "тому", "тоді"}
# Words that may stand between a verb and its noun without changing anything: мені це подобається
GOV_FILLERS = {"не", "ні", "це", "дуже", "теж", "також", "ще", "вже", "так", "ж", "же", "б", "би", "лише",
               "тільки", "справді", "завжди", "ніколи", "часто", "зараз", "сьогодні", "тут", "там"}
# Pronouns that are modifiers and not the noun: мій брат, цей потяг
GOV_MODIFIER_PRONOUNS = {"мій", "твій", "свій", "наш", "ваш", "їхній", "його", "її", "їх", "цей", "той",
                         "весь", "увесь", "кожен", "кожний", "якийсь", "інший", "сам", "самий", "такий"}
GOV_SUBJECTS = {  # the subject of a frame: its forms' tags, and its English
    "я": ({"first-person", "singular"}, "I"), "ти": ({"second-person", "singular"}, "you"),
    "він": ({"third-person", "singular"}, "he"), "ми": ({"first-person", "plural"}, "we"),
    "ви": ({"second-person", "plural"}, "you"), "вони": ({"third-person", "plural"}, "they"),
}
GOV_WINDOW = 3  # words looked at past the verb
# Nouns of time, passed over as the noun of a pattern: у неділю, на хвилину, за годину say when, not what
GOV_TIME = {"понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота", "неділя", "січень", "лютий",
            "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень",
            "листопад", "грудень", "ранок", "вечір", "ніч", "день", "тиждень", "місяць", "рік", "година",
            "хвилина", "секунда", "час", "момент", "мить", "раз", "вихідні", "хвилинка", "годинка"}


def government_patterns(path=GOVERNMENT_TS):
    """The patterns of government.ts and its noun sets: ([pattern dict], {set name: [(word, English)]}).

    Read from the TypeScript source, as hand_picked_cloze reads where.ts, so the
    list is written once. Ids are made as government.ts makes them."""
    if not os.path.exists(path):
        return [], {}
    with open(path, encoding="utf-8") as f:
        text = f.read()

    def block(name):
        start = text.index(f"export const {name} = `") + len(f"export const {name} = `")
        return text[start:text.index("`", start)]

    patterns, lesson = [], ""
    for line in block("GOVERNMENT_LIST").splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("["):
            lesson = line[1:-1]
            continue
        cols = [c.strip() for c in line.split("|")]
        lemmas, prep, case, asks, en, nouns, example = cols[:7]
        flags = cols[7].split() if len(cols) > 7 else []
        prep = "" if prep == "-" else prep
        words = lemmas.split()
        patterns.append(dict(
            id="-".join([national_translit(words[0])] + ([national_translit(prep)] if prep else []) + [case]),
            lemmas=words, prep=prep, case=case, asks=asks, en=en,
            nouns=[] if nouns == "-" else [n[1:] for n in nouns.split()],
            example=example, before="before" in flags, single="single" in flags, listed="listed" in flags,
            lesson="" if lesson == "page" else lesson))

    sets, name = {}, None
    for line in block("NOUN_SETS").splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("@"):
            name, line = line[1:].split(" = ", 1)
            sets[name] = []
        for item in line.split(","):
            if item.strip():
                word, english = item.split(":", 1)
                sets[name].append((word.strip(), english.strip()))
    return patterns, sets


def euphonic(before, prep, after):
    """у or в, з, із or зі as the sounds around it ask; the same rule as euphonic() in government.ts."""
    vowels = "аеєиіїоуюя"
    end = before.lower()[-1:] if before else ""
    first, second = (after.lower() + "  ")[:2]
    second = second.strip()
    if prep in ("у", "в"):
        if first in "вф" or second == "в":
            return "у"
        if end not in vowels and first not in vowels:
            return "у"
        return "в"
    if prep in ("з", "із", "зі"):
        hiss = "зсцчшжщ"
        if first in hiss and second and second not in vowels:
            return "зі"
        if first in hiss or (end not in vowels and first not in vowels):
            return "із"
        return "з"
    return prep


def english_verb(en, subject):
    """The English of a pattern said by `subject`: be grateful -> we are grateful; work -> he works."""
    head, _, rest = en.partition(" ")
    if head == "be":
        head = {"I": "am", "he": "is"}.get(subject, "are")
    elif subject == "he":
        head = head + ("es" if head.endswith(("s", "sh", "ch", "x", "o")) else "s")
    return f"{head} {rest}".strip()


def add_government(db, index, pairs, per_noun=5, ratings=None):
    """Fill `cloze` with the sentences of each case-government pattern (government.ts).

    A Tatoeba sentence is kept for a pattern when:

    - one of its words is a form of the pattern's verb or adjective that no other
      word has (дати is also the plural of дата, so its forms are passed over);
    - within the next three words, with nothing between them but words that
      describe the noun (мою, цю, дуже), comes the pattern's preposition, if it
      has one, and then a noun or a personal pronoun; a comma, a conjunction
      or another preposition ends the search (дякую за допомогу is not дякувати
      + кому?);
    - that noun's case is certain among the cases that could stand there, and
      is the one the pattern asks for (мамі after дякую: the locative needs a
      preposition, so only the dative is left).

    For a pattern whose noun comes first (Мені подобається), the three words
    before the verb are looked at instead.

    Then made-up sentences fill each pattern up to CLOZE_MIN, from the nouns
    government.ts names for it. Returns per pattern how many were found and
    how many made, and `government_points`, the sentence counts.
    """
    patterns, sets = government_patterns()
    practised = [p for p in patterns if p["lesson"] and (not p["prep"] or p["prep"] in GOV_TWO_CASES)]
    if not practised:
        return dict(government_points={}, government_found={}, government_made={})

    pos = {}
    for eid, p in db.execute("SELECT id, pos FROM entries"):
        pos[eid] = p
    words = collections.defaultdict(list)  # dictionary word -> entry ids (verbs and adjectives)
    for eid, word in db.execute("SELECT id, word FROM entries WHERE pos IN ('verb', 'adj')"):
        words[word].append(eid)
    noun_ids = collections.defaultdict(list)  # word -> noun entry ids, the most frequent first
    capital = {}
    word_of = {}
    for eid, word in db.execute("SELECT id, word FROM entries WHERE pos IN ('noun', 'name') ORDER BY freq DESC, id"):
        noun_ids[word].append(eid)
        capital[eid] = word[:1].isupper()
        word_of[eid] = word
    # The nouns a pattern marked `listed` may take: грати у is a game only among its own nouns (у неділю is a day)
    listed = {p["id"]: {w for name in p["nouns"] for w, _ in sets.get(name, [])} for p in practised if p["listed"]}

    # The spellings of every noun: entry -> spelling -> [(case, number, form)], as add_cloze has them
    nouns = collections.defaultdict(dict)
    for eid, form, key, tags in db.execute(
            "SELECT e.id, f.form, f.plain, f.tags FROM forms f JOIN entries e ON e.id = f.entry_id"
            " WHERE e.pos IN ('noun', 'name')"):
        tags = json.loads(tags)
        number = "plural" if "plural" in tags else "singular" if "singular" in tags else None
        for case in CASES.intersection(tags):
            if number:
                nouns[eid].setdefault(key, []).append((case, number, form))

    # The personal pronouns. Each one's page holds the table of all of them (мені is
    # under ти as well), so a form is given to the pronoun whose row it is in: the
    # one with the same person, number and gender. spelling -> [(case, number, form, entry)]
    pronouns = collections.defaultdict(list)
    pron_ids = {word: eid for eid, word in db.execute("SELECT id, word FROM entries WHERE pos = 'pron'")}
    rows = collections.defaultdict(list)  # (pronoun entry, row) -> [(case, number, form, spelling)]
    for eid, form, key, tags in db.execute(
            "SELECT e.id, f.form, f.plain, f.tags FROM forms f JOIN entries e ON e.id = f.entry_id"
            " WHERE e.pos = 'pron' AND f.tags LIKE '%\"personal\"%'"):
        tags = set(json.loads(tags))
        case = CASES & tags
        if len(case) != 1:
            continue
        row = frozenset(tags - CASES)
        rows[eid, row].append((next(iter(case)), "plural" if "plural" in row else "singular", form, key))
    seen = set()
    for (eid, row), forms in rows.items():
        nominative = [key for case, _, _, key in forms if case == "nominative"]
        owner = pron_ids.get(nominative[0]) if nominative else None
        if owner is None or (owner, row) in seen:
            continue
        seen.add((owner, row))
        for case, number, form, key in forms:
            if (case, number, form, owner) not in pronouns[key]:
                pronouns[key].append((case, number, form, owner))

    def readings(key, eid):
        """The (case, number, form) a spelling can be, as a noun or as a personal pronoun."""
        if eid is None:
            return [(c, n, f) for c, n, f, _ in pronouns[key]]
        return nouns[eid].get(key, [])

    def noun_at(token):
        """(entry, spelling) of a noun or personal pronoun, None for a word that describes a noun, False otherwise."""
        key = plain(token)
        if key in GOV_FILLERS or key in GOV_MODIFIER_PRONOUNS:
            return None
        if key in pronouns:
            owners = {o for _, _, _, o in pronouns[key]}
            if len(owners) == 1:
                return next(iter(owners)), key, True
            return False
        owners = index.get(key, set())
        if len(owners) == 1:
            (eid,) = owners
            if pos.get(eid) in ("noun", "name") and len(nouns.get(eid, {})) > 1:
                if token[:1].isupper() != capital.get(eid, False):
                    return False  # Томом is the name, not том
                return eid, key, False
        if owners and all(pos.get(o) in ("adj", "det", "adv", "particle", "num") for o in owners):
            return None
        return False

    prepositions = set(PREPOSITIONS) | {w for (w,) in db.execute("SELECT word FROM entries WHERE pos = 'prep'")}
    verb_tokens = {}  # pattern id -> spellings of its verb
    for p in practised:
        own = {eid for lemma in p["lemmas"] for eid in words.get(lemma, [])}
        others = {eid for p2 in practised for lemma in p2["lemmas"] if lemma in p["lemmas"]
                  for eid in words.get(lemma, [])}
        keys = set()
        for eid in own:
            for key, tags in db.execute("SELECT plain, tags FROM forms WHERE entry_id = ?", (eid,)):
                if " " in key or "passive" in json.loads(tags):
                    continue
                if index.get(key, set()) <= (own | others):
                    keys.add(key)
        verb_tokens[p["id"]] = keys
    by_token = collections.defaultdict(list)
    for p in practised:
        for key in verb_tokens[p["id"]]:
            by_token[key].append(p)

    kept = collections.defaultdict(list)
    per = collections.Counter()
    for sid, text, english, rating, adapted, original in short_first(pairs, ratings):
        if rating and rating[0] < 4:
            continue
        if any(ord(ch) > 0xFFFF for ch in text):
            continue
        found = list(TOKEN.finditer(text))
        done = set()
        for i, verb in enumerate(found):
            for p in by_token.get(plain(verb.group()), ()):
                if p["id"] in done:
                    continue
                spellings = GOV_SPELLINGS.get(p["prep"], {p["prep"]}) if p["prep"] else set()
                wanted = GOV_CASES[p["case"]]
                # What could stand there: after a preposition the cases it takes; else any case
                # a noun has without one, the nominative only before the verb (Мама подобається)
                if p["prep"]:
                    taken, also = PREPOSITIONS[p["prep"]][1], PREPOSITIONS[p["prep"]][2]
                    possible = set(taken) | set(also)
                else:
                    possible = {"genitive", "dative", "accusative", "instrumental"} | (
                        {"nominative"} if p["before"] else set())
                step = -1 if p["before"] else 1
                at, seen_prep, hit = i, False, None
                for _ in range(GOV_WINDOW):
                    nxt = at + step
                    if nxt < 0 or nxt >= len(found):
                        break
                    a, b = (found[nxt], found[at]) if step < 0 else (found[at], found[nxt])
                    if text[a.end():b.start()] != " ":
                        break  # a comma, a dash or a full stop between
                    at = nxt
                    token = found[at].group()
                    key = plain(token)
                    if step > 0 and key in spellings and not seen_prep:
                        seen_prep = True
                        continue
                    if key in prepositions or key in GOV_CONJUNCTIONS:
                        break
                    noun = noun_at(token)
                    if noun is None:
                        continue
                    if noun is not False:
                        eid, nkey, is_pronoun = noun
                        if token[:1].isupper() and is_pronoun and not starts_sentence(text, found[at].start()):
                            break
                        hit = (found[at], eid if not is_pronoun else None, nkey, eid)
                    break
                if not hit or bool(spellings) != seen_prep:
                    continue
                word, lookup, nkey, eid = hit
                if lookup is not None and (word_of.get(eid) in GOV_TIME
                                           or (p["id"] in listed and word_of.get(eid) not in listed[p["id"]])):
                    continue
                here = [(c, n, f) for c, n, f in readings(nkey, lookup) if c in possible]
                if {c for c, _, _ in here} != {wanted} or len({n for _, n, _ in here}) != 1:
                    continue
                if per[p["id"], eid] >= per_noun:
                    continue
                per[p["id"], eid] += 1
                done.add(p["id"])
                case, number, form = here[0]
                kept[p["id"]].append((eid, text, english, word.start(), len(word.group()), form, number, sid,
                                      adapted, verb.start(), len(verb.group())))

    found_counts = {p["id"]: len(kept[p["id"]]) for p in practised}
    made = {p["id"]: 0 for p in practised}
    for p in practised:
        need = CLOZE_MIN - len(kept[p["id"]])
        if need <= 0:
            continue
        frames = government_frames(db, p, sets, noun_ids, per, per_noun)
        random.Random(p["id"]).shuffle(frames)
        for row in frames[:need]:
            kept[p["id"]].append(row)
            made[p["id"]] += 1

    points = {pid: len(rows) for pid, rows in sorted(kept.items()) if len(rows) >= CLOZE_MIN}
    db.executemany(
        "INSERT INTO cloze(point, n, entry_id, uk, en, start, length, form, number, tatoeba_id, adapted,"
        " cue_start, cue_length) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(pid, n, *row) for pid in points for n, row in enumerate(kept[pid])])
    return dict(government_points=points, government_found=found_counts, government_made=made)


def government_frames(db, p, sets, noun_ids, per, per_noun):
    """The sentences a pattern's frame makes, one per subject and noun, each a cloze row.

    Я дякую мамі. Ми чекаємо на автобус. Ми вдячні сусідові. Це подобається мамі.
    The verb is in the present tense of the imperfective; an adjective is in the
    plural, after ми, ви or вони. A noun already in `per_noun` found sentences is
    left out, so that no noun takes over a pattern."""
    lemma = p["lemmas"][0]
    head = db.execute("SELECT id, pos FROM entries WHERE word = ? AND pos IN ('verb', 'adj') ORDER BY freq DESC, id",
                      (lemma,)).fetchone()
    if not head:
        return []
    eid, kind = head
    forms = [(f, k, set(json.loads(t))) for f, k, t in db.execute(
        "SELECT form, plain, tags FROM forms WHERE entry_id = ?", (eid,))]

    def form_with(*tags):
        """The longest spelling with all `tags` (користуюся over користуюсь, дякуємо over дякуєм)."""
        found = [k for _, k, t in forms if set(tags) <= t and " " not in k]
        return max(found, key=len) if found else None

    case = GOV_CASES[p["case"]]
    subjects = ["я", "ти", "він"] if p["single"] else ["ми", "ви", "вони"] if kind == "adj" else ["я", "ми", "ви", "вони"]
    rows = []
    for word, english in (w for name in p["nouns"] for w in sets.get(name, [])):
        noun = None
        # A noun named in the plural (карти, шахи) is looked up by that form
        ids = noun_ids.get(word) or [nid for (nid,) in db.execute(
            "SELECT DISTINCT f.entry_id FROM forms f JOIN entries e ON e.id = f.entry_id"
            " WHERE f.plain = ? AND e.pos = 'noun' AND f.tags LIKE '%\"nominative\"%' AND f.tags LIKE '%\"plural\"%'",
            (word,))]
        numbers = ("plural",) if word not in noun_ids else ("singular", "plural")
        for nid in ids:
            noun_forms = [(f, k, set(json.loads(t))) for f, k, t in db.execute(
                "SELECT form, plain, tags FROM forms WHERE entry_id = ?", (nid,))]
            for number in numbers:
                hit = [(f, k) for f, k, t in noun_forms if {case, number} <= t and "vocative" not in t]
                # A locative that is not also the dative where there is one: поясненні, not поясненню
                other = {k for _, k, t in noun_forms if "dative" in t} if case == "locative" else set()
                hit.sort(key=lambda h: h[1] in other)
                if hit:
                    noun = (nid, hit[0][0], hit[0][1], number)
                    break
            if noun:
                break
        if not noun or per[p["id"], noun[0]] >= per_noun:
            continue
        nid, form, key, number = noun
        shown = key
        if p["before"]:
            verb = form_with("present", "third-person", "singular")
            for neg, en in (("", "likes it"), ("не ", "doesn't like it")):
                uk = f"Це {neg}{verb} {shown}."
                start = uk.index(shown, len("Це "))
                rows.append((nid, uk, f"{english[:1].upper()}{english[1:]} {en}.", start, len(shown), form, number,
                             0, 0, len(f"Це {neg}"), len(verb)))
            continue
        for subject in subjects:
            tags, en_subject = GOV_SUBJECTS[subject]
            if kind == "adj":
                verb = form_with("nominative", "plural")
            else:
                verb = form_with("present", *tags)
            if not verb:
                continue
            head_uk = f"{subject[:1].upper()}{subject[1:]} {verb}"
            prep = euphonic(verb, p["prep"], key) if p["prep"] else ""
            uk = f"{head_uk} {prep + ' ' if prep else ''}{shown}."
            start = len(uk) - 1 - len(shown)
            en_said = english_verb(p["en"], en_subject).replace("{}", english)
            rows.append((nid, uk, f"{en_subject[:1].upper()}{en_subject[1:]} {en_said}.", start, len(shown), form,
                         number, 0, 0, len(subject) + 1, len(verb)))
    return rows


def build(src, dst, freq=None, tatoeba=None, abbreviations=None, translations=None):
    db = sqlite3.connect(dst)
    db.executescript("DROP TABLE IF EXISTS search_keys; DROP TABLE IF EXISTS forms;"
                     "DROP TABLE IF EXISTS relations;"
                     "DROP TABLE IF EXISTS senses; DROP TABLE IF EXISTS examples;"
                     "DROP TABLE IF EXISTS cloze; DROP TABLE IF EXISTS nonstandard;"
                     "DROP TABLE IF EXISTS meta; DROP TABLE IF EXISTS entries;")
    db.executescript(SCHEMA + CLOZE_SCHEMA)
    stats = dict(lines=0, skipped_form_of=0, kept_form_of=0, entries=0, senses=0, forms=0,
                 with_table=0, with_audio=0, with_examples=0)
    kept_kinds = collections.Counter()
    kept_links = []  # (entry id, plain spelling of the word its page points at)

    for line in open(src, encoding="utf-8"):
        stats["lines"] += 1
        e = json.loads(line)
        kept = False
        if is_form_of(e):
            if not is_word_like(e):
                stats["skipped_form_of"] += 1
                continue
            kept = True
            stats["kept_form_of"] += 1

        word = e["word"]
        forms = e.get("forms") or []
        canonical = next((f for f in forms if "canonical" in f.get("tags", [])), None)
        headword = unicodedata.normalize("NFC", canonical["form"]) if canonical else word
        tags = [t for t in (canonical or {}).get("tags", []) if t != "canonical"]
        roman = next((f["form"] for f in forms if "romanization" in f.get("tags", [])), None)

        # Key forms from the headword line (genitive, aspect partner, ...).
        head_forms = [
            {"form": unicodedata.normalize("NFC", f["form"]),
             "tags": [t for t in f.get("tags", []) if t not in NOISE_TAGS]}
            for f in forms
            if f.get("source") != "declension" and f.get("source") != "conjugation"
            and f is not canonical
            and not (set(f.get("tags", [])) & SKIP_FORM_TAGS)
        ]

        # Wiktionary files a participle under its verb's part of speech, but it
        # declines as an adjective (ство́рений, ство́рена, ство́реного), and the
        # table shown for it is chosen by part of speech.
        pos = e["pos"]
        if kept and pos == "verb" and any(f.get("source") == "declension" for f in forms):
            pos = "adj"

        sounds = e.get("sounds") or []
        ipa = next((s["ipa"] for s in sounds if "ipa" in s), None)
        audio = next((s.get("mp3_url") or s.get("ogg_url") for s in sounds
                      if s.get("mp3_url") or s.get("ogg_url")), None)

        cur = db.execute(
            "INSERT INTO entries(word, headword, pos, tags, head_forms, roman, ipa,"
            " audio_url, etymology, source) VALUES (?,?,?,?,?,?,?,?,?,'wiktionary')",
            (word, headword, pos, json.dumps(tags, ensure_ascii=False),
             json.dumps(head_forms, ensure_ascii=False), roman, ipa, audio,
             e.get("etymology_text")))
        eid = cur.lastrowid
        stats["entries"] += 1
        stats["with_audio"] += bool(audio)

        keys = word_keys(word, roman)

        n = 0
        had_example = False
        related = []
        for s in e.get("senses") or []:
            names_a_word = "form_of" in s or "alt_of" in s
            if names_a_word and not kept:
                continue
            gloss = "; ".join(s.get("glosses") or [])
            if not gloss:
                continue
            n += 1
            indexed = gloss
            if names_a_word:
                gloss = without_roman(gloss)
                if n == 1:
                    kept_kinds[form_of_kind(gloss)] += 1
                # "comparative degree of великий" is a label, not a meaning: the
                # English query "comparative" should not list every such word.
                # What follows a colon or stands in quotation marks is a meaning:
                # "...of нема: there is no", "...of годи́на (“hour”)".
                indexed = gloss.partition(":")[2] + " " + " ".join(re.findall(r"“([^”]*)”", gloss))
                # The word the page points at is its closest kin.
                for row in related_words({"related": (s.get("form_of") or []) + (s.get("alt_of") or [])}, n):
                    related.append(row)
                    kept_links.append((eid, row[3]))
            examples = [{"text": x.get("text"), "english": x.get("english") or x.get("translation")}
                        for x in s.get("examples") or [] if x.get("text")]
            had_example |= bool(examples)
            db.execute("INSERT INTO senses(entry_id, n, gloss, tags, examples) VALUES (?,?,?,?,?)",
                       (eid, n, gloss, json.dumps(sense_tags(s), ensure_ascii=False),
                        json.dumps(examples, ensure_ascii=False)))
            stats["senses"] += 1
            related += related_words(s, n)
            for w in set(re.findall(r"[a-z]+(?:[-'][a-z]+)*", indexed.lower())):
                if len(w) > 1:
                    keys.add((w, "english"))
        stats["with_examples"] += had_example

        # The other words this entry names. One named for a meaning is not
        # repeated for the whole entry, and the entry does not name itself.
        related += related_words(e, None)
        seen = set()
        for sense_n, kind, other, other_plain, other_tags in related:
            if other_plain == plain(word) or (sense_n, kind, other_plain) in seen:
                continue
            if sense_n is None and any((m, kind, other_plain) in seen for m in range(1, n + 1)):
                continue
            seen.add((sense_n, kind, other_plain))
            db.execute("INSERT INTO relations(entry_id, sense_n, kind, word, plain, tags) VALUES (?,?,?,?,?,?)",
                       (eid, sense_n, kind, other, other_plain, other_tags))

        table = [f for f in forms if f.get("source") in ("declension", "conjugation")
                 and not (set(f.get("tags", [])) & SKIP_FORM_TAGS)]
        stats["with_table"] += bool(table)
        for f in table:
            form = unicodedata.normalize("NFC", f["form"])
            if not form or form == "-":
                continue
            ftags = [t for t in f.get("tags") or [] if t not in NOISE_TAGS]
            if form.startswith("impersonal: "):  # "impersonal: чи́тано"
                form = form[len("impersonal: "):]
                ftags = sorted(ftags + ["impersonal"])
            p = plain(form)
            db.execute("INSERT INTO forms(entry_id, form, plain, tags) VALUES (?,?,?,?)",
                       (eid, form, p, json.dumps(ftags, ensure_ascii=False)))
            stats["forms"] += 1
            if " " not in p:
                keys.add((p, "form"))
                # The same form as typed in Latin letters (knyhy), and by sound.
                lk = loose_latin(national_translit(p))
                if lk and (lk, "latin") not in keys:
                    keys.add((lk, "latin_form"))
                    if (sound_key(lk), "sound") not in keys:
                        keys.add((sound_key(lk), "sound_form"))

        db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)",
                       [(k, eid, kind) for k, kind in keys if k])

    db.executescript(INDEXES)
    stats["kept_kinds"] = dict(kept_kinds.most_common())
    if abbreviations:
        links, stats["abbreviations_added"] = add_abbreviations(db, abbreviations)
        stats["entries"] += stats["abbreviations_added"]
        stats["senses"] += stats["abbreviations_added"]
        kept_links += links
    turned_down = nonstandard()
    stats["nonstandard_words"] = add_nonstandard(db, turned_down)
    if translations:
        found = add_translations(db, translations, {(word, pos) for word, pos, _ in turned_down})
        stats.update(found)
        stats["entries"] += found["entries_from_translations"]
        stats["senses"] += found["senses_from_translations"]
    stats["marked_offensive"], stats["offensive_unreviewed"] = mark_offensive(db, marked_offensive())
    stats["kept_linked_back"] = link_kept_pages(db, kept_links)
    stats["head_keys"] = add_head_keys(db)
    stats.update(finish_relations(db))
    if freq or tatoeba:
        index = form_index(db)
        if freq:
            reference = ukrainian_counts(tatoeba) if tatoeba else None
            thin = {eid for (eid,) in db.execute("SELECT id FROM entries WHERE source=?", (FROM_TRANSLATIONS,))}
            stats.update(add_frequency(db, index, freq, reference, unranked=thin))
        if tatoeba:
            pairs = tatoeba_pairs(tatoeba)
            ratings = load_ratings()
            stats["rated_sentences"] = len(ratings)
            stats.update(add_tatoeba(db, index, pairs, ratings=ratings, fixes=load_fixes()))
            stats.update(add_cloze(db, index, pairs, ratings=ratings))
            stats.update(add_government(db, index, pairs, ratings=ratings))
            stats["cloze_points"].update(stats["government_points"])
    db.execute("CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT)")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("source", "English Wiktionary via kaikki.org (wiktextract)"),
        ("license", "CC BY-SA 4.0"),
        ("frequency_source", "FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0" if freq else ""),
        ("examples_source", "Tatoeba, CC BY 2.0 FR" if tatoeba else ""),
        # How many sentences each grammar point has: /api/practice draws among them at random.
        ("cloze_points", json.dumps(stats.get("cloze_points", {}))),
        ("stats", json.dumps(stats)),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    return stats


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Build the Nebokrai dictionary database.")
    ap.add_argument("source")
    ap.add_argument("database")
    ap.add_argument("--freq")
    ap.add_argument("--tatoeba")
    ap.add_argument("--abbreviations", help="data/abbreviations.tsv: Nebokrai's own entries for abbreviations")
    ap.add_argument("--translations",
                    help="data/raw/uk_translations.jsonl from extract_translations.py: entries for words "
                         "with no Wiktionary page of their own")
    args = ap.parse_args()
    for k, v in build(args.source, args.database, args.freq, args.tatoeba, args.abbreviations,
                      args.translations).items():
        print(f"{k:>16}: {v}")
