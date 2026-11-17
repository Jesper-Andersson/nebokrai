#!/usr/bin/env python3
"""Build vesum.db: a form -> dictionary word lookup from VESUM.

Usage:
    pip install pymorphy3 pymorphy3-dicts-uk
    python3 import_vesum.py vesum.db [--twisters data/raw/twisters.lst]

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

The data is read from the pymorphy3-dicts-uk package, which is VESUM compiled
for the pymorphy3 library. twisters.lst comes from VESUM's own source, dict_uk,
under the same licence, so it goes into the same file.
"""
import argparse
import json
import re
import sqlite3
import sys

import pymorphy3

from import_wiktionary import loose_latin, national_translit, plain

# pymorphy part-of-speech tags -> the names used in nebokrai.db
POS = {"NOUN": "noun", "VERB": "verb", "INFN": "verb", "GRND": "verb", "ADJF": "adj",
       "ADJS": "adj", "COMP": "adj", "PRTF": "adj", "PRTS": "adj", "ADVB": "adv",
       "NUMR": "num", "NPRO": "pron", "PREP": "prep", "CONJ": "conj", "PRCL": "particle",
       "INTJ": "intj", "PRED": "adv"}

# What a word is, where VESUM says so. Search uses it to say "a surname" about
# a word that has no dictionary entry, which is most names: Шевченка, Олено.
KINDS = {"Name": "given-name", "Surn": "surname", "Patr": "patronymic", "Abbr": "abbreviation"}
# A word outside standard Ukrainian: a Russian word, surzhyk, a misspelling.
# VESUM tags such forms Dist; a word counts only when every one of its forms
# is, since VESUM also marks single wrong forms of ordinary words (a bad
# genitive). Search then says "not standard Ukrainian" about криша, таможня.
DISTORTED = "distorted"

# pymorphy grammemes -> the tags Wiktionary gives a form, which is what
# src/lib/forms.ts reads to place a form in its table: книжечкою is
# ablt,femn -> ["instrumental", "singular"]. A grammeme with no entry here
# (compb, Abbr, Name, ...) is dropped rather than given a made-up tag.
FORM_TAGS = {"nomn": "nominative", "gent": "genitive", "datv": "dative", "accs": "accusative",
             "ablt": "instrumental", "loct": "locative", "voct": "vocative",
             "sing": "singular", "plur": "plural",
             "masc": "masculine", "femn": "feminine", "neut": "neuter",
             "1per": "first-person", "2per": "second-person", "3per": "third-person",
             "pres": "present", "futr": "future", "past": "past", "impr": "imperative",
             "infn": "infinitive", "Impe": "impersonal",
             "Arch": "archaic", "Slng": "slang", "Infr": "informal",
             # A form VESUM marks as not standard Ukrainian: a wrong genitive
             # of an ordinary word, or every form of таможня. Kept, so the
             # page of a distorted word still has its table, but marked.
             "Dist": "nonstandard"}
# Grammemes that belong to the word rather than to one form, as the tags of a
# Wiktionary entry do: a noun's gender and animacy, a verb's aspect.
WORD_TAGS = {"anim": "animate", "inan": "inanimate", "impf": "imperfective", "perf": "perfective",
             "Pltm": "plural-only", "Sgtm": "singular-only"}
NOUN_GENDER = {"masc": "masculine", "femn": "feminine", "neut": "neuter"}


def form_tags(tag, pos):
    """(tags of the form, tags of the word) for one pymorphy tag. A singular
    noun form says the noun's gender and not its number; in a table the
    gender would only repeat itself, so it goes with the word (книжечка is
    ["feminine", "inanimate"]) and the form gets "singular" instead. A past
    tense verb form has a gender and no number either, and gets "singular"
    the same way, as forms.ts expects for the past table."""
    grammemes = set(str(tag).replace(" ", ",").split(","))
    word = {t for g, t in WORD_TAGS.items() if g in grammemes}
    if pos == "noun":
        word |= {t for g, t in NOUN_GENDER.items() if g in grammemes}
        if grammemes & set(NOUN_GENDER) and "plur" not in grammemes:
            grammemes.add("sing")
        grammemes -= set(NOUN_GENDER)
    elif pos == "verb" and "past" in grammemes and grammemes & set(NOUN_GENDER) and "plur" not in grammemes:
        grammemes.add("sing")
    form = [t for g, t in FORM_TAGS.items() if g in grammemes]
    return form, word


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


def build(dst, twisters_path=None):
    morph = pymorphy3.MorphAnalyzer(lang="uk")
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
    # (lemma, pos, pymorphy paradigm id) -> [word id, word tags]. The words
    # come in alphabetical order, not paradigm by paradigm; pymorphy's index
    # of the form within its paradigm gives the order (nominative first).
    words, tagsets, rows_p = {}, {}, []
    for p in morph.iter_known_word_parses():
        parses += 1
        pos = POS.get(str(p.tag.POS), "other")
        lemma = plain(p.normal_form)
        batch.add((plain(p.word), lemma, pos))
        _, _, paradigm_id, index = p.methods_stack[0]
        word = words.setdefault((lemma, pos, paradigm_id), [len(words) + 1, set()])
        tags, word_tags = form_tags(p.tag, pos)
        word[1] |= word_tags
        tagset = tagsets.setdefault(json.dumps(tags, ensure_ascii=False), len(tagsets) + 1)
        rows_p.append((word[0], index + 1, p.word.lower(), tagset))
        if len(rows_p) >= 500_000:
            db.executemany("INSERT INTO vesum_paradigms VALUES (?,?,?,?)", rows_p)
            rows_p.clear()
        for grammeme, kind in KINDS.items():
            if grammeme in p.tag:
                kinds.add((lemma, kind))
        count = forms_of.setdefault(lemma, [0, 0])
        count[0] += 1
        count[1] += "Dist" in p.tag
        if len(batch) >= 500_000:
            db.executemany("INSERT OR IGNORE INTO vesum_forms VALUES (?,?,?)", batch)
            batch.clear()
    db.executemany("INSERT OR IGNORE INTO vesum_forms VALUES (?,?,?)", batch)
    db.executemany("INSERT INTO vesum_paradigms VALUES (?,?,?,?)", rows_p)
    db.executemany("INSERT INTO vesum_words VALUES (?,?,?,?,?)", (
        (wid, loose_latin(national_translit(lemma)), lemma, pos, json.dumps(sorted(word_tags)))
        for (lemma, pos, _), (wid, word_tags) in words.items()))
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
        ("source", "VESUM (brown-uk/dict_uk) via pymorphy3-dicts-uk"
                   + ("; twisters.lst from brown-uk/dict_uk" if twisters_path else "")),
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
    ap.add_argument("--twisters")
    args = ap.parse_args()
    for k, v in build(args.database, args.twisters).items():
        print(f"{k:>11}: {v}")
