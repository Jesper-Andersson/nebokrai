#!/usr/bin/env python3
"""Build the Nebokrai dictionary database from the kaikki.org Ukrainian extract.

Usage:
    python3 import_wiktionary.py raw/uk.jsonl nebokrai.db [--freq FILE] [--tatoeba DIR]

    --freq FILE     word frequency list, one "word count" per line
                    (FrequencyWords uk_full.txt, built from film subtitles)
    --tatoeba DIR   folder holding ukr_sentences.tsv.bz2, ukr-eng_links.tsv.bz2
                    and eng_sentences.tsv.bz2 from downloads.tatoeba.org

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
import json
import os
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
    freq_rank   INTEGER                   -- 1 = most common word; NULL = not seen in the corpus
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
    tatoeba_id  INTEGER NOT NULL      -- https://tatoeba.org/sentences/show/<id>, for attribution
);
CREATE TABLE search_keys (
    key       TEXT NOT NULL,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    kind      TEXT NOT NULL         -- word | form | latin | latin_form | english | sound | sound_form | typo
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
    tatoeba_id  INTEGER NOT NULL    -- https://tatoeba.org/sentences/show/<id>, for attribution
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


SKIP_FORM_TAGS = {"table-tags", "inflection-template", "class", "romanization",
                  # Rows wiktextract could not parse: table notes such as
                  # "Future conjugation of бути + infinitive", not real forms.
                  "error-unrecognized-form"}
NOISE_TAGS = {"error-unknown-tag"}


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
    """Map every known spelling (dictionary word or inflected form) to its entries."""
    index = collections.defaultdict(set)
    marks = ",".join("?" * len(NOT_VOCABULARY))
    for key, eid in db.execute(
            "SELECT k.key, k.entry_id FROM search_keys k JOIN entries e ON e.id = k.entry_id"
            f" WHERE k.kind IN ('word','form') AND e.pos NOT IN ({marks})", NOT_VOCABULARY):
        index[key].add(eid)
    return index


def ukrainian_counts(folder):
    """How often each spelling occurs in Tatoeba's Ukrainian sentences."""
    counts = collections.Counter()
    with bz2.open(os.path.join(folder, "ukr_sentences.tsv.bz2"), "rt", encoding="utf-8") as f:
        for line in f:
            counts.update(plain(t) for t in TOKEN.findall(line.split("\t")[-1]))
    return counts


def add_frequency(db, index, path, reference=None, max_ratio=20, lemma_weight=4):
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
        owners = index.get(key)
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


def add_tatoeba(db, index, folder, per_entry=3):
    """Attach up to `per_entry` short translated sentences to each entry."""
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

    # Sentences of about five words first: long enough to show the word in use,
    # short enough for a flashcard.
    tokenised = {sid: TOKEN.findall(text) for sid, text in uk.items()}
    candidates = collections.defaultdict(list)
    for sid in sorted(uk, key=lambda i: (abs(len(tokenised[i]) - 5), i)):
        text = uk[sid]
        english = en.get(link.get(sid))
        tokens = tokenised[sid]
        if not english or not 3 <= len(tokens) <= 12:
            continue
        for eid in {e for t in tokens for e in index.get(plain(t), ())}:
            if len(candidates[eid]) < per_entry:
                candidates[eid].append((eid, text, english, sid))
    db.executemany("INSERT INTO examples(entry_id, uk, en, tatoeba_id) VALUES (?,?,?,?)",
                   [row for rows_ in candidates.values() for row in rows_])
    return dict(tatoeba_pairs=sum(1 for i in uk if link.get(i) in en),
                entries_with_tatoeba=len(candidates),
                tatoeba_examples=sum(len(v) for v in candidates.values()))


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
}
CASE_SHORT = {"genitive": "gen", "accusative": "acc", "instrumental": "ins", "locative": "loc"}
CASES = {"nominative", "genitive", "dative", "accusative", "instrumental", "locative", "vocative"}
# A point with fewer sentences than this is not offered: the same few would come round too soon.
CLOZE_MIN = 20


def tatoeba_pairs(folder):
    """Tatoeba's Ukrainian sentences that have an English translation: id -> (Ukrainian, English)."""
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
    return {sid: (text, en[link[sid]]) for sid, text in uk.items() if link.get(sid) in en}


def short_first(pairs):
    """Sentences of 3 to 12 words, those of about five first, as add_tatoeba takes them: (id, Ukrainian, English)."""
    length = {sid: len(TOKEN.findall(text)) for sid, (text, _) in pairs.items()}
    for sid in sorted(pairs, key=lambda i: (abs(length[i] - 5), i)):
        text, english = pairs[sid]
        if english and 3 <= length[sid] <= 12:
            yield sid, text, english


def add_cloze(db, index, pairs, per_noun=5):
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

    kept = collections.defaultdict(list)       # point -> rows
    per = collections.Counter()                # (point, entry) -> sentences kept
    for sid, text, english in short_first(pairs):
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
            if per[point, eid] >= per_noun:
                continue
            per[point, eid] += 1
            kept[point].append((eid, text, english, word.start(), len(word.group()), form, number, sid))

    points = {point: len(rows) for point, rows in sorted(kept.items()) if len(rows) >= CLOZE_MIN}
    db.executemany(
        "INSERT INTO cloze(point, n, entry_id, uk, en, start, length, form, number, tatoeba_id)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(point, n, *row) for point in points for n, row in enumerate(kept[point])])
    return dict(cloze_sentences=sum(points.values()), cloze_points=points,
                cloze_points_too_small=sorted(set(kept) - set(points)))


def build(src, dst, freq=None, tatoeba=None):
    db = sqlite3.connect(dst)
    db.executescript("DROP TABLE IF EXISTS search_keys; DROP TABLE IF EXISTS forms;"
                     "DROP TABLE IF EXISTS relations;"
                     "DROP TABLE IF EXISTS senses; DROP TABLE IF EXISTS examples;"
                     "DROP TABLE IF EXISTS cloze;"
                     "DROP TABLE IF EXISTS meta; DROP TABLE IF EXISTS entries;")
    db.executescript(SCHEMA + CLOZE_SCHEMA)
    stats = dict(lines=0, skipped_form_of=0, entries=0, senses=0, forms=0,
                 with_table=0, with_audio=0, with_examples=0)

    for line in open(src, encoding="utf-8"):
        stats["lines"] += 1
        e = json.loads(line)
        if is_form_of(e):
            stats["skipped_form_of"] += 1
            continue

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

        sounds = e.get("sounds") or []
        ipa = next((s["ipa"] for s in sounds if "ipa" in s), None)
        audio = next((s.get("mp3_url") or s.get("ogg_url") for s in sounds
                      if s.get("mp3_url") or s.get("ogg_url")), None)

        cur = db.execute(
            "INSERT INTO entries(word, headword, pos, tags, head_forms, roman, ipa,"
            " audio_url, etymology) VALUES (?,?,?,?,?,?,?,?,?)",
            (word, headword, e["pos"], json.dumps(tags, ensure_ascii=False),
             json.dumps(head_forms, ensure_ascii=False), roman, ipa, audio,
             e.get("etymology_text")))
        eid = cur.lastrowid
        stats["entries"] += 1
        stats["with_audio"] += bool(audio)

        keys = {(plain(word), "word")}
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

        n = 0
        had_example = False
        related = []
        for s in e.get("senses") or []:
            if "form_of" in s or "alt_of" in s:
                continue
            gloss = "; ".join(s.get("glosses") or [])
            if not gloss:
                continue
            n += 1
            examples = [{"text": x.get("text"), "english": x.get("english") or x.get("translation")}
                        for x in s.get("examples") or [] if x.get("text")]
            had_example |= bool(examples)
            db.execute("INSERT INTO senses(entry_id, n, gloss, tags, examples) VALUES (?,?,?,?,?)",
                       (eid, n, gloss, json.dumps(s.get("tags") or [], ensure_ascii=False),
                        json.dumps(examples, ensure_ascii=False)))
            stats["senses"] += 1
            related += related_words(s, n)
            for w in set(re.findall(r"[a-z]+(?:[-'][a-z]+)*", gloss.lower())):
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
    stats.update(finish_relations(db))
    if freq or tatoeba:
        index = form_index(db)
        if freq:
            reference = ukrainian_counts(tatoeba) if tatoeba else None
            stats.update(add_frequency(db, index, freq, reference))
        if tatoeba:
            stats.update(add_tatoeba(db, index, tatoeba))
            stats.update(add_cloze(db, index, tatoeba_pairs(tatoeba)))
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
    args = ap.parse_args()
    for k, v in build(args.source, args.database, args.freq, args.tatoeba).items():
        print(f"{k:>16}: {v}")
