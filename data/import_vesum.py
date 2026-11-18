#!/usr/bin/env python3
"""Build vesum.db: a form -> dictionary word lookup from VESUM.

Usage:
    python3 import_vesum.py vesum.db data/raw/dict_corp_vis.txt.bz2 [--twisters data/raw/twisters.lst]

    SOURCE           dict_corp_vis.txt.bz2 from a brown-uk/dict_uk release (see
                     DICT_UK_VERSION below); read as it is, never unpacked
    --twisters FILE  dict_uk's list of distorted words with what to say instead
                     (data/dict/twisters.lst in brown-uk/dict_uk): таможня #> митниця

VESUM (Великий електронний словник української мови, the BrUK team) lists
over 400,000 Ukrainian words with all their inflected forms. It has no
definitions; Nebokrai uses it for one thing: finding the dictionary word for a
form that Wiktionary does not know.

LICENCE: VESUM data is CC BY-NC-SA 4.0 (non-commercial). Wiktionary data is
CC BY-SA 4.0. The two cannot be merged into one dataset, so this script writes
a SEPARATE database file and nothing from it is ever copied into nebokrai.db.
Deleting vesum.db removes VESUM from the site completely.

The data is dict_uk's own export, dict_corp_vis.txt: each dictionary word on
an unindented line with its tags, then its forms indented below it:

    книжечка noun:inanim:f:v_naz
      книжечки noun:inanim:f:v_rod

Until November 2026 it came from the pymorphy3-dicts-uk package, a 2022
snapshot; Andriy Rysin pointed out how far VESUM had moved since. twisters.lst
comes from the same dict_uk release, under the same licence, so it goes into
the same file.
"""
import argparse
import bz2
import io
import json
import re
import sqlite3
import sys

from import_wiktionary import loose_latin, national_translit, plain

# The dict_uk release the files in data/raw/ come from (data/README.md has the
# download links). The Sources page cites VESUM with this version.
DICT_UK_VERSION = "6.8.6"

# VESUM's part of speech, the first tag of a word's line -> the names used in
# nebokrai.db. A participle (читаний, adjp) is an adjective and an adverbial
# participle (читаючи, advp) a verb, as they were in the pymorphy data. A
# pronoun is tagged by how it inflects plus `pron` (він noun:...:pron, мій
# adj:...:pron), so `pron` wins over the first tag.
POS = {"noun": "noun", "verb": "verb", "adj": "adj", "adjp": "adj", "advp": "verb", "adv": "adv",
       "numr": "num", "prep": "prep", "conj": "conj", "part": "particle", "intj": "intj"}

# What a word is, where VESUM says so. Search uses it to say "a surname" about
# a word that has no dictionary entry, which is most names: Шевченка, Олено.
KINDS = {"fname": "given-name", "lname": "surname", "pname": "patronymic", "abbr": "abbreviation"}
# A word outside standard Ukrainian: a Russian word, surzhyk, a misspelling.
# VESUM tags such forms `bad`; a word counts only when every one of its forms
# is, since VESUM also marks single wrong forms of ordinary words (a bad
# genitive). Search then says "not standard Ukrainian" about криша, таможня.
DISTORTED = "distorted"

# VESUM tags -> the tags Wiktionary gives a form, which is what
# src/lib/forms.ts reads to place a form in its table: книжечкою is
# noun:inanim:f:v_oru -> ["instrumental", "singular"]. A tag with no entry
# here (compb, prop, alt, ...) is dropped rather than given a made-up tag.
FORM_TAGS = {"v_naz": "nominative", "v_rod": "genitive", "v_dav": "dative", "v_zna": "accusative",
             "v_oru": "instrumental", "v_mis": "locative", "v_kly": "vocative",
             "s": "singular", "p": "plural",
             "m": "masculine", "f": "feminine", "n": "neuter",
             "1": "first-person", "2": "second-person", "3": "third-person",
             "pres": "present", "futr": "future", "past": "past", "impr": "imperative",
             "inf": "infinitive", "impers": "impersonal",
             "arch": "archaic", "slang": "slang", "coll": "colloquial",
             # A form VESUM marks as not standard Ukrainian: a wrong genitive
             # of an ordinary word, or every form of таможня. Kept, so the
             # page of a distorted word still has its table, but marked.
             "bad": "nonstandard"}
# Tags that belong to the word rather than to one form, as the tags of a
# Wiktionary entry do: a noun's gender and animacy, a verb's aspect.
WORD_TAGS = {"anim": "animate", "inanim": "inanimate", "imperf": "imperfective", "perf": "perfective",
             "ns": "plural-only"}
NOUN_GENDER = {"m": "masculine", "f": "feminine", "n": "neuter"}


def word_pos(tags):
    """The nebokrai.db part of speech for the tags of a word's own line."""
    if "pron" in tags:
        return "pron"
    return POS.get(tags[0], "other")


def form_tags(tags, pos):
    """(tags of the form, tags of the word) for one form's VESUM tags. A
    singular noun form says the noun's gender and not its number; in a table
    the gender would only repeat itself, so it goes with the word (книжечка is
    ["feminine", "inanimate"]) and the form gets "singular" instead. A past
    tense verb form has a gender and no number either, and gets "singular"
    the same way, as forms.ts expects for the past table."""
    tags = set(tags)
    word = {t for g, t in WORD_TAGS.items() if g in tags}
    if pos == "noun":
        word |= {t for g, t in NOUN_GENDER.items() if g in tags}
        if tags & set(NOUN_GENDER) and "p" not in tags:
            tags.add("s")
        tags -= set(NOUN_GENDER)
    elif pos == "verb" and "past" in tags and tags & set(NOUN_GENDER) and "p" not in tags:
        tags.add("s")
    if pos != "verb":
        # A personal pronoun says its person on every form (він is 3); a
        # table reads person as a verb's column, and the 2022 data had none.
        tags -= {"1", "2", "3"}
    form = [t for g, t in FORM_TAGS.items() if g in tags]
    return form, word


def paradigms(path):
    """(word, tags, [(form, tags), ...]) for each word in dict_corp_vis.txt,
    in the file's order. The word's own line is its first form, and its
    forms keep the file's order (nominative first). A `# comment` is dropped."""
    word = None
    with io.TextIOWrapper(bz2.BZ2File(path), encoding="utf-8") as f:
        for line in f:
            text = line.split("#", 1)[0].split()
            if not text:
                continue
            form, tags = text[0], text[1].split(":")
            if word is None or not line[0].isspace():
                if word is not None:
                    yield word
                word = (form, tags, [])
            word[2].append((form, tags))
    if word is not None:
        yield word


def twisters(path):
    """{lemma: [Ukrainian word, ...]} from dict_uk's twisters.lst, whose lines
    read `таможня noun:f:... #> митниця`. Only single words are kept, in the
    file's order: "що помирає" is no word to link to, and "(рідко)" is a note.
    """
    found = {}
    for line in open(path, encoding="utf-8"):
        if not line.strip() or line.startswith("#") or line[0].isspace():
            continue
        lemma = plain(line.split()[0])
        use = []
        if "#>" in line:
            for part in re.split(r"[|;,]", line.split("#>", 1)[1].split("#")[0]):
                part = plain(re.sub(r"\(.*?\)", "", part).strip())
                if part and " " not in part and part != lemma and part not in use:
                    use.append(part)
        found.setdefault(lemma, use)
    return found


def build(dst, source, twisters_path=None):
    db = sqlite3.connect(dst)
    db.executescript("""
        DROP TABLE IF EXISTS vesum_forms;
        DROP TABLE IF EXISTS meta;
        CREATE TABLE vesum_forms (
            form   TEXT NOT NULL,   -- lowercase, no stress: калиною
            lemma  TEXT NOT NULL,   -- dictionary word: калина
            pos    TEXT NOT NULL,   -- noun, verb, adj, ...
            PRIMARY KEY (form, lemma, pos)
        ) WITHOUT ROWID;
        DROP TABLE IF EXISTS vesum_kinds;
        CREATE TABLE vesum_kinds (
            lemma  TEXT NOT NULL,   -- dictionary word, as in vesum_forms: шевченко
            kind   TEXT NOT NULL,   -- given-name | surname | patronymic | abbreviation | distorted
            PRIMARY KEY (lemma, kind)
        ) WITHOUT ROWID;
        DROP TABLE IF EXISTS vesum_suggest;
        CREATE TABLE vesum_suggest (
            lemma  TEXT NOT NULL,   -- a distorted word, as in vesum_forms: таможня
            n      INTEGER NOT NULL,-- order of the suggestion, from 1
            use    TEXT NOT NULL,   -- a Ukrainian word to say instead, plain: митниця
            PRIMARY KEY (lemma, n)
        ) WITHOUT ROWID;
        -- One row per paradigm: a word page reads these. A lemma can have
        -- more than one (швидкий, the adjective and the noun).
        DROP TABLE IF EXISTS vesum_words;
        CREATE TABLE vesum_words (
            id     INTEGER PRIMARY KEY,
            latin  TEXT NOT NULL,   -- loose romanisation, as search_keys kind 'latin': knizecka
            lemma  TEXT NOT NULL,   -- dictionary word, as in vesum_forms: книжечка
            pos    TEXT NOT NULL,
            tags   TEXT NOT NULL    -- JSON list, the word's own: ["feminine","inanimate"]
        );
        CREATE INDEX vesum_words_latin ON vesum_words(latin);
        -- For an address in Cyrillic and for a dictionary entry borrowing a
        -- table: without it each of those reads all 415,878 rows on D1.
        CREATE INDEX vesum_words_lemma ON vesum_words(lemma, pos);
        -- Each distinct list of form tags once; there are about seventy.
        DROP TABLE IF EXISTS vesum_tagsets;
        CREATE TABLE vesum_tagsets (
            id     INTEGER PRIMARY KEY,
            tags   TEXT NOT NULL    -- JSON list in Wiktionary's words: ["instrumental","singular"]
        );
        DROP TABLE IF EXISTS vesum_paradigms;
        CREATE TABLE vesum_paradigms (
            word   INTEGER NOT NULL,-- vesum_words.id
            n      INTEGER NOT NULL,-- order within the paradigm, nominative first
            form   TEXT NOT NULL,   -- as VESUM spells it, no stress: книжечкою
            tagset INTEGER NOT NULL,-- vesum_tagsets.id
            PRIMARY KEY (word, n)
        ) WITHOUT ROWID;
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    """)
    batch, kinds, parses = set(), set(), 0
    forms_of = {}   # lemma -> [forms, distorted forms]
    # One vesum_words row per word line of the file, in the file's order. A
    # form takes the part of speech of its word's line: the forms of молода
    # (a bride) are tagged as an adjective's, but the word is a noun.
    words, tagsets, rows_p = [], {}, []
    for wid, (head, head_tags, forms) in enumerate(paradigms(source), 1):
        pos = word_pos(head_tags)
        lemma = plain(head)
        word_tags = set()
        for n, (form, tags) in enumerate(forms, 1):
            parses += 1
            batch.add((plain(form), lemma, pos))
            ftags, wtags = form_tags(tags, pos)
            word_tags |= wtags
            tagset = tagsets.setdefault(json.dumps(ftags, ensure_ascii=False), len(tagsets) + 1)
            rows_p.append((wid, n, form.lower(), tagset))
            for tag, kind in KINDS.items():
                if tag in tags:
                    kinds.add((lemma, kind))
            count = forms_of.setdefault(lemma, [0, 0])
            count[0] += 1
            count[1] += "bad" in tags
        words.append((wid, loose_latin(national_translit(lemma)), lemma, pos, json.dumps(sorted(word_tags))))
        if len(rows_p) >= 500_000:
            db.executemany("INSERT INTO vesum_paradigms VALUES (?,?,?,?)", rows_p)
            rows_p.clear()
        if len(batch) >= 500_000:
            db.executemany("INSERT OR IGNORE INTO vesum_forms VALUES (?,?,?)", batch)
            batch.clear()
    db.executemany("INSERT OR IGNORE INTO vesum_forms VALUES (?,?,?)", batch)
    db.executemany("INSERT INTO vesum_paradigms VALUES (?,?,?,?)", rows_p)
    db.executemany("INSERT INTO vesum_words VALUES (?,?,?,?,?)", words)
    db.executemany("INSERT INTO vesum_tagsets VALUES (?,?)", ((i, t) for t, i in tagsets.items()))
    kinds |= {(lemma, DISTORTED) for lemma, (total, distorted) in forms_of.items() if distorted == total}
    suggest = []
    if twisters_path:
        for lemma, use in twisters(twisters_path).items():
            kinds.add((lemma, DISTORTED))
            suggest += [(lemma, n, word) for n, word in enumerate(use, 1)]
    db.executemany("INSERT OR IGNORE INTO vesum_kinds VALUES (?,?)", kinds)
    db.executemany("INSERT INTO vesum_suggest VALUES (?,?,?)", suggest)
    rows = db.execute("SELECT count(*) FROM vesum_forms").fetchone()[0]
    lemmas = db.execute("SELECT count(DISTINCT lemma) FROM vesum_forms").fetchone()[0]
    word_rows = db.execute("SELECT count(*) FROM vesum_words").fetchone()[0]
    paradigm_rows = db.execute("SELECT count(*) FROM vesum_paradigms").fetchone()[0]
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("source", f"VESUM (brown-uk/dict_uk v{DICT_UK_VERSION}, dict_corp_vis.txt)"
                   + ("; twisters.lst from brown-uk/dict_uk" if twisters_path else "")),
        ("version", DICT_UK_VERSION),
        ("license", "CC BY-NC-SA 4.0 - non-commercial; keep separate from nebokrai.db"),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    return dict(parses=parses, rows=rows, lemmas=lemmas, words=word_rows, paradigms=paradigm_rows, kinds=len(kinds),
                distorted=sum(1 for _, kind in kinds if kind == DISTORTED), suggestions=len(suggest))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build vesum.db from VESUM.", usage=__doc__)
    ap.add_argument("database")
    ap.add_argument("source")
    ap.add_argument("--twisters")
    args = ap.parse_args()
    for k, v in build(args.database, args.source, args.twisters).items():
        print(f"{k:>11}: {v}")
